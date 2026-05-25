"""
Unit tests for TEDDK Enhanced Maven Adapter.

Tests the enhanced Maven adapter functionality including AI-powered analysis,
security scanning, and cross-language package suggestions.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from udp.tools.ecosystems.teddk_maven_adapter import TEDDKMavenAdapter
from udp.domain.models import EcosystemType, Package, SecurityLevel, LicenseType


class TestTEDDKMavenAdapter:
    """Test TEDDK Enhanced Maven Adapter functionality."""
    
    @pytest.fixture
    def sample_pom_content(self):
        """Sample TEDDK pom.xml content for testing."""
        return '''<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.telia</groupId>
    <artifactId>teddk</artifactId>
    <version>2.1.0</version>
    <packaging>jar</packaging>

    <name>TEDDK - Telia Enterprise Development Kit</name>
    <description>Enterprise development kit for Telia applications</description>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <spring.boot.version>3.2.0</spring.boot.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>${spring.boot.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
            <version>${spring.boot.version}</version>
        </dependency>

        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <version>42.6.0</version>
        </dependency>

        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.2</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.0</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>'''
    
    @pytest.fixture
    def teddk_adapter(self):
        """Create TEDDK Maven adapter instance."""
        organization_id = str(uuid4())
        return TEDDKMavenAdapter(organization_id)
    
    @pytest.fixture
    def teddk_adapter_no_org(self):
        """Create TEDDK Maven adapter without organization ID."""
        return TEDDKMavenAdapter()
    
    def test_teddk_adapter_initialization(self, teddk_adapter):
        """Test TEDDK adapter initialization."""
        assert teddk_adapter.ecosystem_type == EcosystemType.MAVEN
        assert teddk_adapter.organization_id is not None
        assert teddk_adapter.ai_analyzer is not None
        assert teddk_adapter.vulnerability_scanner is not None
        assert hasattr(teddk_adapter, 'teddk_patterns')
        
        # Check TEDDK-specific patterns
        assert 'enterprise_frameworks' in teddk_adapter.teddk_patterns
        assert 'security_critical' in teddk_adapter.teddk_patterns
        assert 'database_drivers' in teddk_adapter.teddk_patterns
        assert 'logging_frameworks' in teddk_adapter.teddk_patterns
    
    def test_teddk_adapter_initialization_no_org(self, teddk_adapter_no_org):
        """Test TEDDK adapter initialization without organization ID."""
        assert teddk_adapter_no_org.ecosystem_type == EcosystemType.MAVEN
        assert teddk_adapter_no_org.organization_id is None
        assert teddk_adapter_no_org.ai_analyzer is None
        assert teddk_adapter_no_org.vulnerability_scanner is not None
    
    @pytest.mark.asyncio
    async def test_parse_manifest_basic(self, teddk_adapter, sample_pom_content):
        """Test basic manifest parsing functionality."""
        with patch.object(teddk_adapter, '_analyze_teddk_patterns', return_value={'patterns_found': []}), \
             patch.object(teddk_adapter, '_generate_ai_recommendations', return_value={'recommendations': []}), \
             patch.object(teddk_adapter, '_assess_security_posture', return_value={'overall_score': 10.0}), \
             patch.object(teddk_adapter, '_suggest_cross_language_packages', return_value={'javascript_alternatives': []}):
            
            parsed_manifest = await teddk_adapter.parse_manifest(sample_pom_content, "pom.xml")
            
            assert parsed_manifest.project_name == "teddk"
            assert parsed_manifest.project_version == "2.1.0"
            assert parsed_manifest.ecosystem == EcosystemType.MAVEN
            assert len(parsed_manifest.dependencies) > 0
            assert len(parsed_manifest.dev_dependencies) > 0
            
            # Check metadata
            assert 'groupId' in parsed_manifest.metadata
            assert parsed_manifest.metadata['groupId'] == 'com.telia'
            assert 'teddk_analysis' in parsed_manifest.metadata
            assert 'ai_recommendations' in parsed_manifest.metadata
            assert 'security_assessment' in parsed_manifest.metadata
            assert 'cross_language_suggestions' in parsed_manifest.metadata
    
    @pytest.mark.asyncio
    async def test_analyze_teddk_patterns(self, teddk_adapter):
        """Test TEDDK pattern analysis."""
        # Create mock dependencies
        dependencies = [
            Package(
                name="org.springframework.boot:spring-boot-starter-web",
                version="3.2.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.springframework.boot:spring-boot-starter-security",
                version="3.2.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.postgresql:postgresql",
                version="42.6.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.junit.jupiter:junit-jupiter",
                version="5.10.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'test'}
            )
        ]
        
        analysis = await teddk_adapter._analyze_teddk_patterns(dependencies)
        
        assert 'patterns_found' in analysis
        assert 'enterprise_readiness_score' in analysis
        assert 'security_framework_coverage' in analysis
        assert 'database_integration' in analysis
        assert 'recommendations' in analysis
        
        # Check that patterns were found
        assert len(analysis['patterns_found']) > 0
        assert analysis['enterprise_readiness_score'] > 0.0
        
        # Check specific pattern detection
        assert any('spring-boot-starter-web' in pattern for pattern in analysis['patterns_found'])
        assert any('spring-boot-starter-security' in pattern for pattern in analysis['patterns_found'])
        assert len(analysis['security_framework_coverage']) > 0
        assert len(analysis['database_integration']) > 0
    
    @pytest.mark.asyncio
    async def test_generate_ai_recommendations_with_ai(self, teddk_adapter):
        """Test AI recommendation generation when AI analyzer is available."""
        # Mock AI analyzer
        mock_recommendations = [
            Mock(
                recommendation_type='security_action',
                title='Update vulnerable dependencies',
                description='Several dependencies have security vulnerabilities',
                confidence_score=0.9,
                action_required=True,
                rationale='Security vulnerabilities detected'
            )
        ]
        
        mock_confidence = {'overall': 0.85}
        
        with patch.object(teddk_adapter.ai_analyzer, 'analyze_dependency_request', 
                         return_value=(mock_recommendations, mock_confidence)):
            
            dependencies = [
                Package(
                    name="org.springframework.boot:spring-boot-starter-web",
                    version="3.2.0",
                    ecosystem=EcosystemType.MAVEN,
                    metadata={'scope': 'compile'}
                )
            ]
            
            recommendations = await teddk_adapter._generate_ai_recommendations(dependencies)
            
            assert 'recommendations' in recommendations
            assert 'confidence' in recommendations
            assert recommendations['ai_enabled'] is True
            assert len(recommendations['recommendations']) > 0
            assert recommendations['confidence'] == 0.85
            
            # Check recommendation structure
            rec = recommendations['recommendations'][0]
            assert 'type' in rec
            assert 'title' in rec
            assert 'description' in rec
            assert 'confidence' in rec
            assert 'action_required' in rec
            assert 'rationale' in rec
    
    @pytest.mark.asyncio
    async def test_generate_ai_recommendations_without_ai(self, teddk_adapter_no_org):
        """Test AI recommendation generation when AI analyzer is not available."""
        dependencies = [
            Package(
                name="org.springframework.boot:spring-boot-starter-web",
                version="3.2.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            )
        ]
        
        recommendations = await teddk_adapter_no_org._generate_ai_recommendations(dependencies)
        
        assert 'recommendations' in recommendations
        assert 'confidence' in recommendations
        assert recommendations['ai_enabled'] is False
        assert recommendations['confidence'] == 0.0
        assert len(recommendations['recommendations']) == 0
    
    @pytest.mark.asyncio
    async def test_assess_security_posture(self, teddk_adapter):
        """Test security posture assessment."""
        # Create dependencies with mock vulnerability data
        dependencies = [
            Package(
                name="org.springframework.boot:spring-boot-starter-web",
                version="3.2.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'vulnerability_count': 0}
            ),
            Package(
                name="com.example:vulnerable-package",
                version="1.0.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'vulnerability_count': 2}
            ),
            Package(
                name="org.springframework.security:spring-security-core",
                version="5.0.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'vulnerability_count': 1}
            )
        ]
        
        assessment = await teddk_adapter._assess_security_posture(dependencies)
        
        assert 'overall_score' in assessment
        assert 'critical_vulnerabilities' in assessment
        assert 'high_vulnerabilities' in assessment
        assert 'medium_vulnerabilities' in assessment
        assert 'security_recommendations' in assessment
        assert 'compliance_status' in assessment
        
        # Check that vulnerabilities were detected
        total_vulns = (assessment['critical_vulnerabilities'] + 
                      assessment['high_vulnerabilities'] + 
                      assessment['medium_vulnerabilities'])
        assert total_vulns > 0
        
        # Check that score was reduced due to vulnerabilities
        assert assessment['overall_score'] < 10.0
        
        # Check recommendations were generated
        if assessment['critical_vulnerabilities'] > 0:
            assert any('URGENT' in rec for rec in assessment['security_recommendations'])
    
    @pytest.mark.asyncio
    async def test_suggest_cross_language_packages(self, teddk_adapter):
        """Test cross-language package suggestions."""
        dependencies = [
            Package(
                name="org.apache.httpcomponents.client5:httpclient5",
                version="5.2.1",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="com.fasterxml.jackson.core:jackson-databind",
                version="2.15.2",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.postgresql:postgresql",
                version="42.6.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.junit.jupiter:junit-jupiter",
                version="5.10.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'test'}
            )
        ]
        
        suggestions = await teddk_adapter._suggest_cross_language_packages(dependencies)
        
        assert 'javascript_alternatives' in suggestions
        assert 'python_alternatives' in suggestions
        assert 'rust_alternatives' in suggestions
        assert 'bridge_opportunities' in suggestions
        assert 'polyglot_recommendations' in suggestions
        
        # Check that alternatives were found
        assert len(suggestions['javascript_alternatives']) > 0
        assert len(suggestions['python_alternatives']) > 0
        
        # Check structure of alternatives
        js_alt = suggestions['javascript_alternatives'][0]
        assert 'java_package' in js_alt
        assert 'js_alternative' in js_alt
        assert 'reason' in js_alt
        
        py_alt = suggestions['python_alternatives'][0]
        assert 'java_package' in py_alt
        assert 'python_alternative' in py_alt
        assert 'reason' in py_alt
    
    def test_categorize_teddk_dependency(self, teddk_adapter):
        """Test TEDDK dependency categorization."""
        test_cases = [
            ("org.springframework.boot:spring-boot-starter-web", "enterprise_framework"),
            ("org.junit.jupiter:junit-jupiter", "testing"),
            ("org.postgresql:postgresql", "database"),
            ("com.fasterxml.jackson.core:jackson-databind", "serialization"),
            ("ch.qos.logback:logback-classic", "logging"),
            ("org.apache.httpcomponents.client5:httpclient5", "http_client"),
            ("com.example:unknown-package", "utility")
        ]
        
        for package_name, expected_category in test_cases:
            category = teddk_adapter._categorize_teddk_dependency(package_name)
            assert category == expected_category, f"Expected {expected_category} for {package_name}, got {category}"
    
    @pytest.mark.asyncio
    async def test_determine_license(self, teddk_adapter):
        """Test license determination."""
        test_cases = [
            ("org.springframework.boot:spring-boot-starter", "3.2.0", LicenseType.APACHE_2_0),
            ("org.junit.jupiter:junit-jupiter", "5.10.0", LicenseType.EPL_2_0),
            ("com.fasterxml.jackson.core:jackson-core", "2.15.2", LicenseType.APACHE_2_0),
            ("ch.qos.logback:logback-classic", "1.4.11", LicenseType.EPL_1_0),
            ("org.postgresql:postgresql", "42.6.0", LicenseType.BSD_2_CLAUSE),
            ("com.example:unknown-package", "1.0.0", LicenseType.UNKNOWN)
        ]
        
        for package_name, version, expected_license in test_cases:
            license_type = await teddk_adapter._determine_license(package_name, version)
            assert license_type == expected_license, f"Expected {expected_license} for {package_name}, got {license_type}"
    
    @pytest.mark.asyncio
    async def test_scan_package_vulnerabilities(self, teddk_adapter):
        """Test package vulnerability scanning."""
        # Test with package that should have vulnerabilities (mock)
        vulnerabilities = await teddk_adapter._scan_package_vulnerabilities(
            "org.springframework:spring-core", "2.5.0"
        )
        
        # Should return vulnerabilities for old Spring version
        assert isinstance(vulnerabilities, list)
        if vulnerabilities:
            vuln = vulnerabilities[0]
            assert hasattr(vuln, 'id')
            assert hasattr(vuln, 'package_name')
            assert hasattr(vuln, 'severity')
            assert hasattr(vuln, 'description')
        
        # Test with package that should be clean
        clean_vulnerabilities = await teddk_adapter._scan_package_vulnerabilities(
            "com.example:clean-package", "1.0.0"
        )
        
        assert isinstance(clean_vulnerabilities, list)
    
    @pytest.mark.asyncio
    async def test_calculate_security_score(self, teddk_adapter):
        """Test security score calculation."""
        from udp.domain.models import Vulnerability
        
        # Test with no vulnerabilities
        score_clean = await teddk_adapter._calculate_security_score([])
        assert score_clean == 10.0
        
        # Test with vulnerabilities
        vulnerabilities = [
            Vulnerability(
                id="CVE-2024-0001",
                package_name="test:package",
                package_version="1.0.0",
                severity=SecurityLevel.CRITICAL,
                description="Critical vulnerability",
                cvss_score=9.0
            ),
            Vulnerability(
                id="CVE-2024-0002",
                package_name="test:package",
                package_version="1.0.0",
                severity=SecurityLevel.HIGH,
                description="High vulnerability",
                cvss_score=7.5
            ),
            Vulnerability(
                id="CVE-2024-0003",
                package_name="test:package",
                package_version="1.0.0",
                severity=SecurityLevel.MEDIUM,
                description="Medium vulnerability",
                cvss_score=5.0
            )
        ]
        
        score_with_vulns = await teddk_adapter._calculate_security_score(vulnerabilities)
        assert score_with_vulns < 10.0
        assert score_with_vulns >= 0.0
        
        # Critical should reduce score more than high, high more than medium
        assert score_with_vulns < 5.0  # Should be significantly reduced
    
    @pytest.mark.asyncio
    async def test_resolve_dependencies_enhanced(self, teddk_adapter, sample_pom_content):
        """Test enhanced dependency resolution."""
        with patch.object(teddk_adapter, '_analyze_teddk_patterns', return_value={'patterns_found': []}), \
             patch.object(teddk_adapter, '_generate_ai_recommendations', return_value={'recommendations': []}), \
             patch.object(teddk_adapter, '_assess_security_posture', return_value={'overall_score': 10.0}), \
             patch.object(teddk_adapter, '_suggest_cross_language_packages', return_value={'javascript_alternatives': []}), \
             patch.object(teddk_adapter, '_detect_conflicts_ai_enhanced', return_value=[]), \
             patch.object(teddk_adapter, '_validate_enterprise_compliance', return_value=True), \
             patch.object(teddk_adapter, '_check_cross_language_compatibility', return_value={'compatible': True}):
            
            # First parse the manifest
            parsed_manifest = await teddk_adapter.parse_manifest(sample_pom_content, "pom.xml")
            
            # Then resolve dependencies
            result = await teddk_adapter.resolve_dependencies(parsed_manifest, str(uuid4()))
            
            assert result is not None
            assert hasattr(result, 'resolved_dependencies')
            assert hasattr(result, 'conflicts')
            assert hasattr(result, 'warnings')
            assert hasattr(result, 'metadata')
            
            # Check metadata
            assert result.metadata['resolution_strategy'] == 'teddk_enhanced'
            assert 'ai_assisted' in result.metadata
            assert result.metadata['security_validated'] is True
            assert result.metadata['teddk_optimized'] is True
    
    @pytest.mark.asyncio
    async def test_detect_conflicts_ai_enhanced(self, teddk_adapter):
        """Test AI-enhanced conflict detection."""
        # Create dependencies with potential conflicts
        dependencies = [
            Package(
                name="org.springframework:spring-core",
                version="5.3.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            ),
            Package(
                name="org.springframework:spring-core",
                version="6.0.0",
                ecosystem=EcosystemType.MAVEN,
                metadata={'scope': 'compile'}
            )
        ]
        
        conflicts = await teddk_adapter._detect_conflicts_ai_enhanced(dependencies)
        
        assert isinstance(conflicts, list)
        if conflicts:
            conflict = conflicts[0]
            assert 'type' in conflict
            assert 'package' in conflict
            assert 'versions' in conflict
            assert 'severity' in conflict
            assert 'ai_resolution' in conflict
    
    @pytest.mark.asyncio
    async def test_close_cleanup(self, teddk_adapter):
        """Test resource cleanup."""
        # Mock the vulnerability scanner close method
        teddk_adapter.vulnerability_scanner.close = AsyncMock()
        
        await teddk_adapter.close()
        
        # Verify cleanup was called
        if hasattr(teddk_adapter.vulnerability_scanner, 'close'):
            teddk_adapter.vulnerability_scanner.close.assert_called_once()


class TestTEDDKMavenAdapterIntegration:
    """Integration tests for TEDDK Maven Adapter."""
    
    @pytest.mark.asyncio
    async def test_full_analysis_workflow(self):
        """Test complete analysis workflow from parsing to resolution."""
        organization_id = str(uuid4())
        adapter = TEDDKMavenAdapter(organization_id)
        
        sample_pom = '''<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.telia</groupId>
    <artifactId>teddk-test</artifactId>
    <version>1.0.0</version>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>3.2.0</version>
        </dependency>
    </dependencies>
</project>'''
        
        with patch.object(adapter, '_analyze_teddk_patterns', return_value={'patterns_found': ['spring-boot-starter-web']}), \
             patch.object(adapter, '_generate_ai_recommendations', return_value={'recommendations': [], 'confidence': 0.8}), \
             patch.object(adapter, '_assess_security_posture', return_value={'overall_score': 9.0}), \
             patch.object(adapter, '_suggest_cross_language_packages', return_value={'javascript_alternatives': []}), \
             patch.object(adapter, '_detect_conflicts_ai_enhanced', return_value=[]), \
             patch.object(adapter, '_validate_enterprise_compliance', return_value=True), \
             patch.object(adapter, '_check_cross_language_compatibility', return_value={'compatible': True}):
            
            # Parse manifest
            parsed_manifest = await adapter.parse_manifest(sample_pom, "pom.xml")
            
            assert parsed_manifest.project_name == "teddk-test"
            assert len(parsed_manifest.dependencies) > 0
            
            # Resolve dependencies
            result = await adapter.resolve_dependencies(parsed_manifest, organization_id)
            
            assert result is not None
            assert result.metadata['teddk_optimized'] is True
            assert result.metadata['ai_assisted'] is True
        
        await adapter.close()
    
    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling in various scenarios."""
        adapter = TEDDKMavenAdapter()
        
        # Test with invalid XML
        invalid_pom = "This is not valid XML"
        
        with pytest.raises(ValueError, match="Failed to parse TEDDK Maven manifest"):
            await adapter.parse_manifest(invalid_pom, "pom.xml")
        
        await adapter.close()