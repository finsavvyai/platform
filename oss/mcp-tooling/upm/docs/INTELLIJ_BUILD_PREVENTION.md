"""
Build Prevention for IntelliJ IDEA Plugin

Blocks build execution when critical policy violations exist.
This ensures that insecure code cannot be built/deployed.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class BuildBlockReason:
    """Reason for blocking a build."""
    severity: str  # critical, high, medium
    category: str  # vulnerability, policy_violation, license
    message: str
    affected_components: List[str]
    can_override: bool = False
    override_requires_approval: bool = True


class BuildPreventionService:
    """
    Service for determining if a build should be blocked.
    
    Checks:
    - Critical vulnerabilities
    - Critical policy violations
    - License compliance issues
    - Unapproved dependencies
    """
    
    # Thresholds for blocking builds
    BLOCK_ON_CRITICAL_VULNS = True
    BLOCK_ON_CRITICAL_VIOLATIONS = True
    BLOCK_ON_FORBIDDEN_LICENSES = True
    BLOCK_ON_UNAPPROVED_DEPS = False  # Can be configured
    
    def __init__(
        self,
        block_on_critical_vulns: bool = True,
        block_on_critical_violations: bool = True,
        block_on_forbidden_licenses: bool = True,
        block_on_unapproved_deps: bool = False
    ):
        self.block_on_critical_vulns = block_on_critical_vulns
        self.block_on_critical_violations = block_on_critical_violations
        self.block_on_forbidden_licenses = block_on_forbidden_licenses
        self.block_on_unapproved_deps = block_on_unapproved_deps
    
    async def check_build_allowed(
        self,
        project_id: str,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if a build should be allowed.
        
        Returns:
            Dict with:
            - allowed: bool
            - reasons: List of BuildBlockReason
            - can_override: bool
        """
        from ..services.vulnerability_scanner import VulnerabilityScanner
        from ..services.openclaw_policy_enforcer import OpenClawPolicyEnforcer
        
        reasons = []
        
        # 1. Check for critical vulnerabilities
        if self.block_on_critical_vulns:
            vuln_scanner = VulnerabilityScanner()
            vulns = await vuln_scanner.scan_project(project_id)
            
            critical_vulns = [v for v in vulns if v.severity == "critical"]
            if critical_vulns:
                reasons.append(BuildBlockReason(
                    severity="critical",
                    category="vulnerability",
                    message=f"Found {len(critical_vulns)} critical vulnerabilities",
                    affected_components=[f"{v.id}:{v.package}:{v.version}" for v in critical_vulns],
                    can_override=False
                ))
        
        # 2. Check for critical policy violations
        if self.block_on_critical_violations:
            # Check with policy enforcer
            enforcer = OpenClawPolicyEnforcer()
            # Would scan project and check violations
            # For now, placeholder
            pass
        
        # 3. Check for forbidden licenses
        if self.block_on_forbidden_licenses:
            from ..services.license_service import LicenseService
            license_service = LicenseService()
            
            forbidden = await license_service.check_forbidden_licenses(project_id)
            if forbidden:
                reasons.append(BuildBlockReason(
                    severity="critical",
                    category="license",
                    message=f"Found {len(forbidden)} dependencies with forbidden licenses",
                    affected_components=[f.dep.name:{dep.version}" for dep in forbidden],
                    can_override=False
                ))
        
        # Determine if build is allowed
        critical_reasons = [r for r in reasons if r.severity == "critical"]
        allowed = len(critical_reasons) == 0
        can_override = all(r.can_override for r in reasons)
        
        return {
            "allowed": allowed,
            "reasons": [
                {
                    "severity": r.severity,
                    "category": r.category,
                    "message": r.message,
                    "affected_components": r.affected_components,
                    "can_override": r.can_override
                }
                for r in reasons
            ],
            "can_override": can_override,
            "project_id": project_id,
            "branch": branch,
            "timestamp": self._get_timestamp()
        }
    
    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.utcnow().isoformat()


# Kotlin implementation for IntelliJ plugin
# This would be in intellij-plugin/src/main/kotlin/com/upm/plugin/build/

INTILLIJ_BUILD_PREVENTION_KT = """
package com.upm.plugin.build

import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.components.serviceAsync
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.CompletableFuture

/**
 * Service for preventing builds when security issues are detected.
 */
class BuildPreventionService(private val project: Project) {
    
    companion object {
        fun getInstance(project: Project): BuildPreventionService {
            return project.getService()
        }
    }
    
    /**
     * Check if build should be allowed.
     * 
     * Returns BuildCheckResult with:
     * - allowed: whether build can proceed
     * - blockReasons: list of reasons if not allowed
     * - canOverride: whether block can be overridden
     */
    suspend fun checkBuildAllowed(
        branch: String? = null
    ): BuildCheckResult {
        val config = UPMConfig.getInstance()
        
        // If build prevention is disabled, allow
        if (!config.buildPreventionEnabled) {
            return BuildCheckResult(
                allowed = true,
                blockReasons = emptyList(),
                canOverride = true
            )
        }
        
        val blockReasons = mutableListOf<BlockReason>()
        val restClient = UPMRestApiClient.getInstance()
        
        // Check for vulnerabilities
        val projectId = config.getProjectId(project)
        if (projectId != null) {
            try {
                withContext(Dispatchers.IO) {
                    // Fetch vulnerabilities
                    val vulns = restClient.getVulnerabilities(projectId)
                    
                    // Check for critical vulnerabilities
                    val criticalVulns = vulns.filter { 
                        it.severity == "critical" || 
                        it.severity == "CVSS:9+" 
                    }
                    
                    if (criticalVulns.isNotEmpty()) {
                        if (config.failBuildOnCriticalVulnerabilities) {
                            blockReasons.add(
                                BlockReason(
                                    severity = "critical",
                                    category = "vulnerability",
                                    message = "Found ${criticalVulns.size} critical vulnerabilities",
                                    affectedComponents = criticalVulns.map { 
                                        "${it.package}:${it.version}" 
                                    },
                                    canOverride = false
                                )
                            )
                        }
                    }
                    
                    // Fetch policy violations
                    val violations = restClient.getPolicyViolations(projectId)
                    
                    // Check for critical violations
                    val criticalViolations = violations.filter { 
                        it.severity == "critical" ||
                        it.severity == "error" 
                    }
                    
                    if (criticalViolations.isNotEmpty()) {
                        if (config.failBuildOnPolicyViolation) {
                            blockReasons.add(
                                BlockReason(
                                    severity = "critical",
                                    category = "policy_violation",
                                    message = "Found ${criticalViolations.size} critical policy violations",
                                    affectedComponents = criticalViolations.map { 
                                        it.description 
                                    },
                                    canOverride = it.autoFixable
                                )
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                    UPMLogger.warn("Failed to check build status", mapOf(
                        "error" to (e.message ?: "Unknown error")
                    ))
                    // On error, allow build but log warning
                    return BuildCheckResult(
                        allowed = true,
                        blockReasons = emptyList(),
                        canOverride = true
                    )
                }
        }
        
        // Check OpenClaw skills if this is an OpenClaw project
        if (isOpenClawProject(project)) {
            val openclawBlocks = checkOpenClawSkills(project)
            blockReasons.addAll(openclawBlocks)
        }
        
        val allowed = blockReasons.none { it.severity == "critical" && !it.canOverride }
        val canOverride = blockReasons.all { it.canOverride }
        
        return BuildCheckResult(
            allowed = allowed,
            blockReasons = blockReasons,
            canOverride = canOverride
        )
    }
    
    /**
     * Check OpenClaw skills for security issues.
     */
    private fun checkOpenClawSkills(project: Project): List<BlockReason> {
        val reasons = mutableListOf<BlockReason>()
        
        // Find skill.yaml files
        val skillFiles = findSkillFiles(project)
        
        for (skillFile in skillFiles) {
            // Would scan each skill for issues
            // For now, placeholder
        }
        
        return reasons
    }
    
    private fun findSkillFiles(project: Project): List<com.intellij.openapi.vfs.VirtualFile> {
        val skillFiles = mutableListOf<com.intellij.openapi.vfs.VirtualFile>()
        
        val visitor = object : com.intellij.openapi.vfs.VirtualFileVisitor() {
            override fun visitFile(file: com.intellij.openapi.vfs.VirtualFile) {
                if (file.name == "skill.yaml" || file.name == "skill.yml") {
                    skillFiles.add(file)
                }
            }
        }
        
        com.intellij.openapi.vfs.VfsUtilCore.visitChildrenRecursively(
            project.baseDir,
            visitor
        )
        
        return skillFiles
    }
    
    private fun isOpenClawProject(project: Project): Boolean {
        // Check if project has OpenClaw markers
        val baseDir = project.baseDir
        val openclawMarker = baseDir.findChild("claw.yaml") ?: 
                           baseDir.findChild("openclaw.json")
        
        return openclawMarker != null
    }
    
    /**
     * Show build blocked dialog.
     */
    fun showBuildBlockedDialog(blockReasons: List<BlockReason>): BuildBlockedAction {
        val message = buildBlockedMessage(blockReasons)
        
        val result = Messages.showYesNoDialog(
            "Build Blocked - Security Issues Detected",
            message,
            "View Details",
            "Cancel Build"
        )
        
        return if (result == Messages.YES) {
            BuildBlockedAction.VIEW_DETAILS
        } else {
            BuildBlockedAction.CANCEL_BUILD
        }
    }
    
    /**
     * Request build override.
     */
    fun requestOverride(blockReasons: List<BlockReason>): CompletableFuture<Boolean> {
        val completable = CompletableFuture<Boolean>()
        
        // Only allow override if all reasons are overrideable
        if (blockReasons.all { it.canOverride }) {
            val message = overrideRequestMessage(blockReasons)
            
            val result = Messages.showYesNoDialog(
                "Override Build Prevention?",
                message,
                "Request Exception",
                "Cancel"
            )
            
            completable.complete(result == Messages.YES)
        } else {
            // Cannot override critical issues
            Messages.showWarningDialog(
                "Cannot Override",
                "Build cannot be overridden due to critical security issues.",
                "OK"
            )
            completable.complete(false)
        }
        
        return completable
    }
    
    private fun buildBlockedMessage(reasons: List<BlockReason>): String {
        val sb = StringBuilder()
        sb.append("Build has been blocked due to security issues:\\n\\n")
        
        for (reason in reasons) {
            sb.append("• [${reason.severity.uppercase}] ${reason.message}\\n")
            if (reason.affectedComponents.isNotEmpty()) {
                sb.append("  Affected: ")
                sb.append(reason.affectedComponents.joinToString(", "))
                sb.append("\\n")
            }
        }
        
        sb.append("\\nPlease resolve these issues before building.")
        
        return sb.toString()
    }
    
    private fun overrideRequestMessage(reasons: List<BlockReason>): String {
        val sb = StringBuilder()
        sb.append("An exception request will be created for the following issues:\\n\\n")
        
        for (reason in reasons) {
            sb.append("• ${reason.message}\\n")
        }
        
        sb.append("\\nDo you want to proceed?")
        
        return sb.toString()
    }
}

data class BuildCheckResult(
    val allowed: Boolean,
    val blockReasons: List<BlockReason>,
    val canOverride: Boolean
)

data class BlockReason(
    val severity: String,
    val category: String,
    val message: String,
    val affectedComponents: List<String>,
    val canOverride: Boolean
)

enum class BuildBlockedAction {
    VIEW_DETAILS,
    CANCEL_BUILD,
    REQUEST_OVERRIDE,
    PROCEED_ANYWAY
}

/**
 * Build task runner that checks security before allowing build.
 */
class UPMBuildTaskRunner : BuildTaskRunner {
    
    override fun canExecute(task: BuildTask, wrapper: BuildTaskExecutor): Boolean {
        val project = task.project ?: return true
        
        val buildService = BuildPreventionService.getInstance(project)
        
        // Run check asynchronously
        val future = CompletableFuture.supplyAsync {
            runBlocking {
                buildService.checkBuildAllowed()
            }
        }
        
        // Get result (with timeout)
        try {
            val result = future.get(5, java.util.concurrent.TimeUnit.SECONDS)
            
            if (!result.allowed) {
                val action = buildService.showBuildBlockedDialog(result.blockReasons)
                
                when (action) {
                    BuildBlockedAction.CANCEL_BUILD -> return false
                    BuildBlockedAction.REQUEST_OVERRIDE -> {
                        val overrideFuture = buildService.requestOverride(result.blockReasons)
                        return overrideFuture.get()
                    }
                    BuildBlockedAction.VIEW_DETAILS -> {
                        showDetailsWindow(result.blockReasons)
                        return false  // User cancelled after viewing details
                    }
                    BuildBlockedAction.PROCEED_ANYWAY -> return true
                }
            }
            
            return true
        } catch (e: Exception) {
            UPMLogger.error("Build check failed", mapOf("error" to e.message))
            // On error, allow build but log
            return true
        }
    }
}

/**
 * Run configuration extension for build prevention.
 */
class UPMBuildConfigurationExtension : RunConfigurationExtension {
    
    override fun extendConfiguration(
        configuration: RunConfigurationBase,
        context: ExtensionContext
    ): RunConfigurationBase {
        // Add build prevention listener
        configuration.addListener(
            object : RunConfigurationListener {
                override fun runStarted(
                    executor: RunConfigurationExecutor,
                    environment: ExecutionEnvironment
                ) {
                    val project = environment.project ?: return
                    
                    val buildService = BuildPreventionService.getInstance(project)
                    val allowed = runBlocking {
                        buildService.checkBuildAllowed()
                    }
                    
                    if (!allowed.allowed) {
                        executor.stop()
                    }
                }
            }
        )
        
        return configuration
    }
}
"""

# Register the service in plugin.xml
"""
<application-components>
    <component>
        <implementation-class>com.upm.plugin.build.BuildPreventionService</implementation-class>
    </component>
</application-components>

<extensions defaultExtensionNs="com.intellij">
    <buildTaskRunner implementation="com.upm.plugin.build.UPMBuildTaskRunner"/>
    <runConfigurationExtension implementation="com.upm.plugin.build.UPMBuildConfigurationExtension"/>
</extensions>
"""
