"""
Maven ecosystem adapter for Universal Dependency Platform.

Handles parsing of Maven pom.xml files and dependency resolution.
"""

import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Optional

import httpx
from udp.core.config import settings
from udp.domain.models import Package

from .base import DependencyInfo, EcosystemAdapter, EcosystemType
from .factory import register_ecosystem_adapter

logger = logging.getLogger(__name__)


@register_ecosystem_adapter(EcosystemType.MAVEN, ["xml"])
class MavenAdapter(EcosystemAdapter):
    """Maven ecosystem adapter for pom.xml parsing and dependency management."""

    def __init__(self):
        super().__init__()
        self.ecosystem_type = EcosystemType.MAVEN
        self.supported_extensions = ["xml"]
        self.manifest_files = ["pom.xml"]
        self.lock_files = ["pom.xml.lock"]

    @property
    def registry_url(self) -> str:
        """Maven Central repository URL."""
        return "https://repo1.maven.org/maven2"

    def detect_ecosystem(self, project_path: Path) -> bool:
        """Detect if this is a Maven project."""
        pom_file = project_path / "pom.xml"
        return pom_file.exists()

    def parse_manifest(self, manifest_path: Path) -> dict[str, Any]:
        """Parse Maven pom.xml file."""
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()

            # Handle XML namespaces
            namespaces = {"maven": "http://maven.apache.org/POM/4.0.0"}

            # Extract project information
            project_info = {
                "groupId": self._get_text(root, "maven:groupId", namespaces),
                "artifactId": self._get_text(root, "maven:artifactId", namespaces),
                "version": self._get_text(root, "maven:version", namespaces),
                "packaging": self._get_text(root, "maven:packaging", namespaces)
                or "jar",
                "name": self._get_text(root, "maven:name", namespaces),
                "description": self._get_text(root, "maven:description", namespaces),
                "url": self._get_text(root, "maven:url", namespaces),
                "properties": self._parse_properties(root, namespaces),
                "dependencies": self._parse_dependencies(root, namespaces),
                "dependency_management": self._parse_dependency_management(
                    root, namespaces
                ),
                "build": self._parse_build(root, namespaces),
                "repositories": self._parse_repositories(root, namespaces),
                "plugin_repositories": self._parse_plugin_repositories(
                    root, namespaces
                ),
            }

            logger.info(
                f"Successfully parsed Maven pom.xml: {project_info['groupId']}:{project_info['artifactId']}:{project_info['version']}"
            )
            return project_info

        except ET.ParseError as e:
            logger.error(f"Failed to parse Maven pom.xml: {e}")
            raise ValueError(f"Invalid Maven pom.xml file: {e}")
        except Exception as e:
            logger.error(f"Error parsing Maven manifest: {e}")
            raise

    def _get_text(
        self, element: ET.Element, path: str, namespaces: dict[str, str]
    ) -> Optional[str]:
        """Get text content from XML element."""
        try:
            found = element.find(path, namespaces)
            return found.text.strip() if found is not None and found.text else None
        except Exception:
            return None

    def _parse_properties(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> dict[str, str]:
        """Parse Maven properties section."""
        properties = {}
        properties_elem = root.find("maven:properties", namespaces)
        if properties_elem is not None:
            for prop in properties_elem:
                if prop.tag.startswith("{"):
                    # Remove namespace prefix
                    tag = prop.tag.split("}")[1]
                else:
                    tag = prop.tag
                properties[tag] = prop.text if prop.text else ""
        return properties

    def _parse_dependencies(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse Maven dependencies section."""
        dependencies = []
        deps_elem = root.find("maven:dependencies", namespaces)
        if deps_elem is not None:
            for dep in deps_elem.findall("maven:dependency", namespaces):
                dependency = {
                    "groupId": self._get_text(dep, "maven:groupId", namespaces),
                    "artifactId": self._get_text(dep, "maven:artifactId", namespaces),
                    "version": self._get_text(dep, "maven:version", namespaces),
                    "type": self._get_text(dep, "maven:type", namespaces) or "jar",
                    "classifier": self._get_text(dep, "maven:classifier", namespaces),
                    "scope": self._get_text(dep, "maven:scope", namespaces)
                    or "compile",
                    "optional": self._get_text(dep, "maven:optional", namespaces)
                    == "true",
                    "exclusions": self._parse_exclusions(dep, namespaces),
                }
                dependencies.append(dependency)
        return dependencies

    def _parse_dependency_management(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse Maven dependency management section."""
        dependencies = []
        dep_mgmt_elem = root.find("maven:dependencyManagement", namespaces)
        if dep_mgmt_elem is not None:
            deps_elem = dep_mgmt_elem.find("maven:dependencies", namespaces)
            if deps_elem is not None:
                for dep in deps_elem.findall("maven:dependency", namespaces):
                    dependency = {
                        "groupId": self._get_text(dep, "maven:groupId", namespaces),
                        "artifactId": self._get_text(
                            dep, "maven:artifactId", namespaces
                        ),
                        "version": self._get_text(dep, "maven:version", namespaces),
                        "type": self._get_text(dep, "maven:type", namespaces) or "jar",
                        "classifier": self._get_text(
                            dep, "maven:classifier", namespaces
                        ),
                        "scope": self._get_text(dep, "maven:scope", namespaces)
                        or "compile",
                        "optional": self._get_text(dep, "maven:optional", namespaces)
                        == "true",
                        "exclusions": self._parse_exclusions(dep, namespaces),
                    }
                    dependencies.append(dependency)
        return dependencies

    def _parse_exclusions(
        self, dep_elem: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, str]]:
        """Parse dependency exclusions."""
        exclusions = []
        exclusions_elem = dep_elem.find("maven:exclusions", namespaces)
        if exclusions_elem is not None:
            for excl in exclusions_elem.findall("maven:exclusion", namespaces):
                exclusion = {
                    "groupId": self._get_text(excl, "maven:groupId", namespaces),
                    "artifactId": self._get_text(excl, "maven:artifactId", namespaces),
                }
                exclusions.append(exclusion)
        return exclusions

    def _parse_build(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> dict[str, Any]:
        """Parse Maven build section."""
        build = {}
        build_elem = root.find("maven:build", namespaces)
        if build_elem is not None:
            build["sourceDirectory"] = self._get_text(
                build_elem, "maven:sourceDirectory", namespaces
            )
            build["testSourceDirectory"] = self._get_text(
                build_elem, "maven:testSourceDirectory", namespaces
            )
            build["outputDirectory"] = self._get_text(
                build_elem, "maven:outputDirectory", namespaces
            )
            build["testOutputDirectory"] = self._get_text(
                build_elem, "maven:testOutputDirectory", namespaces
            )
            build["finalName"] = self._get_text(
                build_elem, "maven:finalName", namespaces
            )
            build["plugins"] = self._parse_plugins(build_elem, namespaces)
        return build

    def _parse_plugins(
        self, build_elem: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse Maven plugins."""
        plugins = []
        plugins_elem = build_elem.find("maven:plugins", namespaces)
        if plugins_elem is not None:
            for plugin in plugins_elem.findall("maven:plugin", namespaces):
                plugin_info = {
                    "groupId": self._get_text(plugin, "maven:groupId", namespaces),
                    "artifactId": self._get_text(
                        plugin, "maven:artifactId", namespaces
                    ),
                    "version": self._get_text(plugin, "maven:version", namespaces),
                    "extensions": self._get_text(plugin, "maven:extensions", namespaces)
                    == "true",
                    "executions": self._parse_executions(plugin, namespaces),
                    "configuration": self._parse_configuration(plugin, namespaces),
                }
                plugins.append(plugin_info)
        return plugins

    def _parse_executions(
        self, plugin_elem: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse plugin executions."""
        executions = []
        executions_elem = plugin_elem.find("maven:executions", namespaces)
        if executions_elem is not None:
            for execution in executions_elem.findall("maven:execution", namespaces):
                exec_info = {
                    "id": self._get_text(execution, "maven:id", namespaces),
                    "phase": self._get_text(execution, "maven:phase", namespaces),
                    "goals": [
                        goal.text
                        for goal in execution.findall(
                            "maven:goals/maven:goal", namespaces
                        )
                        if goal.text
                    ],
                    "configuration": self._parse_configuration(execution, namespaces),
                }
                executions.append(exec_info)
        return executions

    def _parse_configuration(
        self, elem: ET.Element, namespaces: dict[str, str]
    ) -> dict[str, Any]:
        """Parse plugin/execution configuration."""
        config = {}
        config_elem = elem.find("maven:configuration", namespaces)
        if config_elem is not None:
            for child in config_elem:
                if child.tag.startswith("{"):
                    tag = child.tag.split("}")[1]
                else:
                    tag = child.tag

                if len(child) == 0:
                    # Simple text value
                    config[tag] = child.text if child.text else ""
                else:
                    # Complex configuration
                    config[tag] = self._parse_configuration(child, namespaces)
        return config

    def _parse_repositories(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse Maven repositories."""
        repositories = []
        repos_elem = root.find("maven:repositories", namespaces)
        if repos_elem is not None:
            for repo in repos_elem.findall("maven:repository", namespaces):
                repo_info = {
                    "id": self._get_text(repo, "maven:id", namespaces),
                    "name": self._get_text(repo, "maven:name", namespaces),
                    "url": self._get_text(repo, "maven:url", namespaces),
                    "layout": self._get_text(repo, "maven:layout", namespaces)
                    or "default",
                    "releases": self._parse_repository_policy(
                        repo, "maven:releases", namespaces
                    ),
                    "snapshots": self._parse_repository_policy(
                        repo, "maven:snapshots", namespaces
                    ),
                }
                repositories.append(repo_info)
        return repositories

    def _parse_plugin_repositories(
        self, root: ET.Element, namespaces: dict[str, str]
    ) -> list[dict[str, Any]]:
        """Parse Maven plugin repositories."""
        repositories = []
        repos_elem = root.find("maven:pluginRepositories", namespaces)
        if repos_elem is not None:
            for repo in repos_elem.findall("maven:pluginRepository", namespaces):
                repo_info = {
                    "id": self._get_text(repo, "maven:id", namespaces),
                    "name": self._get_text(repo, "maven:name", namespaces),
                    "url": self._get_text(repo, "maven:url", namespaces),
                    "layout": self._get_text(repo, "maven:layout", namespaces)
                    or "default",
                    "releases": self._parse_repository_policy(
                        repo, "maven:releases", namespaces
                    ),
                    "snapshots": self._parse_repository_policy(
                        repo, "maven:snapshots", namespaces
                    ),
                }
                repositories.append(repo_info)
        return repositories

    def _parse_repository_policy(
        self, repo_elem: ET.Element, policy_path: str, namespaces: dict[str, str]
    ) -> dict[str, Any]:
        """Parse repository policy (releases/snapshots)."""
        policy = {}
        policy_elem = repo_elem.find(policy_path, namespaces)
        if policy_elem is not None:
            policy["enabled"] = (
                self._get_text(policy_elem, "maven:enabled", namespaces) != "false"
            )
            policy["updatePolicy"] = self._get_text(
                policy_elem, "maven:updatePolicy", namespaces
            )
            policy["checksumPolicy"] = self._get_text(
                policy_elem, "maven:checksumPolicy", namespaces
            )
        return policy

    def extract_dependencies(
        self, manifest_data: dict[str, Any]
    ) -> list[DependencyInfo]:
        """Extract dependency information from parsed Maven manifest."""
        dependencies = []

        # Process direct dependencies
        for dep in manifest_data.get("dependencies", []):
            if dep.get("groupId") and dep.get("artifactId"):
                dependency = DependencyInfo(
                    name=f"{dep['groupId']}:{dep['artifactId']}",
                    version=dep.get("version", ""),
                    ecosystem=self.ecosystem_type.value,
                    scope=dep.get("scope", "compile"),
                    optional=dep.get("optional", False),
                    metadata={
                        "groupId": dep["groupId"],
                        "artifactId": dep["artifactId"],
                        "type": dep.get("type", "jar"),
                        "classifier": dep.get("classifier"),
                        "exclusions": dep.get("exclusions", []),
                    },
                )
                dependencies.append(dependency)

        # Process dependency management (version constraints)
        for dep in manifest_data.get("dependency_management", []):
            if dep.get("groupId") and dep.get("artifactId"):
                dependency = DependencyInfo(
                    name=f"{dep['groupId']}:{dep['artifactId']}",
                    version=dep.get("version", ""),
                    ecosystem=self.ecosystem_type.value,
                    scope="management",
                    optional=False,
                    metadata={
                        "groupId": dep["groupId"],
                        "artifactId": dep["artifactId"],
                        "type": dep.get("type", "jar"),
                        "classifier": dep.get("classifier"),
                        "exclusions": dep.get("exclusions", []),
                    },
                )
                dependencies.append(dependency)

        return dependencies

    def resolve_dependencies(
        self, dependencies: list[DependencyInfo]
    ) -> list[DependencyInfo]:
        """Resolve Maven dependencies with transitive dependencies.

        Fetches each dependency's POM from Maven Central to discover
        transitive dependencies (one level deep to avoid excessive requests).
        """
        resolved = []
        seen = set()

        for dep in dependencies:
            dep_key = dep.name
            if dep_key in seen:
                continue
            seen.add(dep_key)
            resolved.append(dep)

            # Skip non-compile scopes and management entries for transitive resolution
            if dep.scope in ("test", "provided", "management") or dep.optional:
                continue

            # Fetch transitive dependencies from the dependency's POM
            transitive = self._fetch_transitive_dependencies(dep)
            for tdep in transitive:
                tdep_key = tdep.name
                if tdep_key not in seen:
                    seen.add(tdep_key)
                    resolved.append(tdep)

        return resolved

    def _fetch_transitive_dependencies(
        self, dep: DependencyInfo
    ) -> list[DependencyInfo]:
        """Fetch transitive deps by downloading the dependency's POM from Maven Central."""
        try:
            group_id = dep.metadata.get("groupId", "")
            artifact_id = dep.metadata.get("artifactId", "")
            version = dep.version

            if not group_id or not artifact_id or not version:
                return []

            # Skip property references like ${spring.version}
            if version.startswith("${"):
                return []

            group_path = group_id.replace(".", "/")
            pom_url = f"{self.registry_url}/{group_path}/{artifact_id}/{version}/{artifact_id}-{version}.pom"

            with httpx.Client(timeout=10.0) as client:
                response = client.get(pom_url)
                if response.status_code != 200:
                    logger.debug(
                        f"POM not found at {pom_url} (status {response.status_code})"
                    )
                    return []

                root = ET.fromstring(response.content)
                namespaces = {"maven": "http://maven.apache.org/POM/4.0.0"}

                transitive_deps = []
                deps_elem = root.find("maven:dependencies", namespaces)
                if deps_elem is None:
                    return []

                for td in deps_elem.findall("maven:dependency", namespaces):
                    t_group = self._get_text(td, "maven:groupId", namespaces)
                    t_artifact = self._get_text(td, "maven:artifactId", namespaces)
                    t_version = self._get_text(td, "maven:version", namespaces) or ""
                    t_scope = self._get_text(td, "maven:scope", namespaces) or "compile"
                    t_optional = (
                        self._get_text(td, "maven:optional", namespaces) == "true"
                    )

                    if t_scope not in ("compile", "runtime") or t_optional:
                        continue
                    if not t_group or not t_artifact:
                        continue
                    if t_version.startswith("${"):
                        t_version = ""

                    transitive_deps.append(
                        DependencyInfo(
                            name=f"{t_group}:{t_artifact}",
                            version=t_version,
                            ecosystem=self.ecosystem_type.value,
                            scope=t_scope,
                            optional=False,
                            metadata={
                                "groupId": t_group,
                                "artifactId": t_artifact,
                                "transitive": True,
                                "parent": dep.name,
                            },
                        )
                    )

                logger.info(
                    f"Found {len(transitive_deps)} transitive deps for {dep.name}:{dep.version}"
                )
                return transitive_deps

        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching POM for {dep.name}:{dep.version}")
            return []
        except Exception as e:
            logger.warning(f"Failed to fetch transitive deps for {dep.name}: {e}")
            return []

    def get_package_info(self, package_name: str, version: str) -> Optional[Package]:
        """Get package information from Maven Central Search API."""
        try:
            if ":" not in package_name:
                return None

            group_id, artifact_id = package_name.split(":", 1)

            search_url = settings.MAVEN_CENTRAL_URL
            params = {
                "q": f'g:"{group_id}" AND a:"{artifact_id}"',
                "core": "gav",
                "rows": 1,
                "wt": "json",
            }
            if version:
                params["q"] += f' AND v:"{version}"'

            with httpx.Client(timeout=10.0) as client:
                response = client.get(search_url, params=params)

                if response.status_code != 200:
                    logger.warning(
                        f"Maven Central API returned {response.status_code} for {package_name}"
                    )
                    return self._fallback_package_info(
                        package_name, version, group_id, artifact_id
                    )

                data = response.json()
                docs = data.get("response", {}).get("docs", [])

                if not docs:
                    return self._fallback_package_info(
                        package_name, version, group_id, artifact_id
                    )

                doc = docs[0]
                resolved_version = doc.get("v", version)

                return Package(
                    name=package_name,
                    version=resolved_version,
                    ecosystem=EcosystemType.MAVEN,
                    description=f"{group_id}:{artifact_id}",
                    homepage=f"https://mvnrepository.com/artifact/{group_id}/{artifact_id}/{resolved_version}",
                    metadata={
                        "groupId": group_id,
                        "artifactId": artifact_id,
                        "packaging": doc.get("p", "jar"),
                        "timestamp": doc.get("timestamp"),
                        "maven_central_url": f"{self.registry_url}/{group_id.replace('.', '/')}/{artifact_id}/{resolved_version}",
                        "tags": doc.get("tags", []),
                    },
                )

        except httpx.TimeoutException:
            logger.warning(
                f"Timeout querying Maven Central for {package_name}:{version}"
            )
            return self._fallback_package_info(
                package_name, version, *package_name.split(":", 1)
            )
        except Exception as e:
            logger.error(
                f"Failed to get package info for {package_name}:{version}: {e}"
            )
            return None

    def _fallback_package_info(
        self, package_name: str, version: str, group_id: str, artifact_id: str
    ) -> Package:
        """Return basic package info when Maven Central API is unavailable."""
        return Package(
            name=package_name,
            version=version,
            ecosystem=EcosystemType.MAVEN,
            description=f"{group_id}:{artifact_id}",
            homepage=f"https://mvnrepository.com/artifact/{group_id}/{artifact_id}",
            metadata={
                "groupId": group_id,
                "artifactId": artifact_id,
                "packaging": "jar",
                "maven_central_url": f"{self.registry_url}/{group_id.replace('.', '/')}/{artifact_id}/{version}",
            },
        )

    def generate_lockfile(self, resolved_dependencies: list[DependencyInfo]) -> str:
        """Generate Maven dependency tree output."""
        lockfile_content = []
        lockfile_content.append("# Maven Dependency Tree")
        lockfile_content.append("# Generated by Universal Dependency Platform")
        lockfile_content.append("")

        for dep in resolved_dependencies:
            scope_info = f" [{dep.scope}]" if dep.scope != "compile" else ""
            optional_info = " (optional)" if dep.optional else ""
            lockfile_content.append(
                f"{dep.name}:{dep.version}{scope_info}{optional_info}"
            )

        return "\n".join(lockfile_content)

    def validate_manifest(self, manifest_path: Path) -> list[str]:
        """Validate Maven pom.xml file."""
        errors = []

        try:
            manifest_data = self.parse_manifest(manifest_path)

            # Check required fields
            if not manifest_data.get("groupId"):
                errors.append("Missing required field: groupId")
            if not manifest_data.get("artifactId"):
                errors.append("Missing required field: artifactId")
            if not manifest_data.get("version"):
                errors.append("Missing required field: version")

            # Validate dependencies
            for i, dep in enumerate(manifest_data.get("dependencies", [])):
                if not dep.get("groupId"):
                    errors.append(f"Dependency {i + 1}: Missing groupId")
                if not dep.get("artifactId"):
                    errors.append(f"Dependency {i + 1}: Missing artifactId")

            # Check for common issues
            if manifest_data.get("version") and "SNAPSHOT" in manifest_data["version"]:
                errors.append("Warning: Using SNAPSHOT version in production")

        except Exception as e:
            errors.append(f"Failed to parse pom.xml: {e}")

        return errors
