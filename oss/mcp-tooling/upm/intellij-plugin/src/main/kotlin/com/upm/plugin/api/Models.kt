package com.upm.plugin.api

import java.util.*

/**
 * Data model classes for UPM API responses and requests.
 */

// Core Models

data class DependencyAnalysisResult(
    val projectId: String,
    val timestamp: Long,
    val totalDependencies: Int,
    val vulnerableDependencies: Int,
    val outdatedDependencies: Int,
    val policyViolations: Int,
    val dependencies: List<Dependency>,
    val vulnerabilities: List<Vulnerability>,
    val violations: List<PolicyViolation>
)

data class Dependency(
    val id: String,
    val groupId: String? = null,
    val artifactId: String,
    val version: String,
    val scope: String = "compile",
    val type: String = "jar",
    val ecosystem: String, // maven, npm, pip, cargo, etc.
    val filePath: String,
    val lineNumber: Int? = null,
    val isDirect: Boolean = true,
    val transitiveDependencies: List<String> = emptyList(),
    val vulnerabilities: List<Vulnerability> = emptyList(),
    val license: String? = null,
    val size: Long? = null,
    val downloadCount: Long? = null,
    val lastUpdated: Long? = null,
    val metadata: Map<String, Any> = emptyMap()
)

data class Vulnerability(
    val id: String,
    val cveId: String? = null,
    val title: String,
    val description: String,
    val severity: VulnerabilitySeverity,
    val score: Double? = null,
    val vector: String? = null,
    val affectedVersions: List<String>,
    val patchedVersions: List<String>,
    val publishedDate: Long,
    val lastModifiedDate: Long,
    val references: List<String> = emptyList(),
    val weaknesses: List<String> = emptyList(),
    val exploitability: Exploitability? = null,
    val impact: Impact? = null,
    val remediation: Remediation? = null,
    val metadata: Map<String, Any> = emptyMap()
)

data class PolicyViolation(
    val id: String,
    val projectId: String,
    val policyId: String,
    val policyName: String,
    val policyDescription: String,
    val severity: ViolationSeverity,
    val status: ViolationStatus,
    val dependencyId: String? = null,
    val ruleId: String,
    val ruleDescription: String,
    val actualValue: Any,
    val expectedValue: Any,
    val detectedAt: Long,
    val resolvedAt: Long? = null,
    val resolvedBy: String? = null,
    val resolutionNote: String? = null,
    val exceptionRequest: ExceptionRequest? = null,
    val metadata: Map<String, Any> = emptyMap()
)

data class ExceptionRequest(
    val id: String,
    val violationId: String,
    val projectId: String,
    val requestedBy: String,
    val reason: String,
    val type: ExceptionType,
    val duration: Int? = null, // days
    val status: ExceptionStatus,
    val submittedAt: Long,
    val reviewedAt: Long? = null,
    val reviewedBy: String? = null,
    val reviewComment: String? = null,
    val expiresAt: Long? = null,
    val metadata: Map<String, Any> = emptyMap()
)

data class OutdatedDependency(
    val dependency: Dependency,
    val currentVersion: String,
    val latestVersion: String,
    val updatesAvailable: List<VersionUpdate>,
    val isBreakingChange: Boolean,
    val releaseDate: Long? = null,
    val daysSinceUpdate: Int? = null,
    val downloadDiff: Long? = null
)

data class VersionUpdate(
    val version: String,
    val releaseDate: Long,
    val isPrerelease: Boolean,
    val isBreakingChange: Boolean,
    val changelog: String? = null,
    val vulnerabilitiesFixed: List<String> = emptyList()
)

data class DependencyNode(
    val dependency: Dependency,
    val children: List<DependencyNode> = emptyList(),
    val expanded: Boolean = false,
    val depth: Int = 0
)

data class PolicyComplianceResult(
    val projectId: String,
    val isCompliant: Boolean,
    val score: Double, // 0-100
    val totalViolations: Int,
    val violationsBySeverity: Map<ViolationSeverity, Int>,
    val violations: List<PolicyViolation>,
    val lastChecked: Long
)

// Enums

enum class VulnerabilitySeverity {
    LOW, MEDIUM, HIGH, CRITICAL
}

enum class ViolationSeverity {
    INFO, LOW, MEDIUM, HIGH, CRITICAL
}

enum class ViolationStatus {
    ACTIVE, RESOLVED, FALSE_POSITIVE, EXCEPTION_GRANTED
}

enum class ExceptionType {
    TEMPORARY, PERMANENT, ONE_TIME_BUILD
}

enum class ExceptionStatus {
    PENDING, APPROVED, REJECTED, EXPIRED
}

enum class Exploitability {
    NONE, LOW, MEDIUM, HIGH
}

// Additional Data Classes

data class Remediation(
    val type: RemediationType,
    val description: String,
    val steps: List<String>,
    val automatedFix: Boolean,
    val breakingChange: Boolean,
    val confidence: Double
)

enum class RemediationType {
    VERSION_UPDATE, ALTERNATIVE_PACKAGE, CONFIGURATION_CHANGE, REMOVE_DEPENDENCY
}

data class Impact(
    val confidentialityImpact: String,
    val integrityImpact: String,
    val availabilityImpact: String,
    val userInteractionRequired: Boolean,
    val scopeChanged: Boolean
)

data class BuildCheckResult(
    val canBuild: Boolean,
    val blockingViolations: List<PolicyViolation>,
    val warnings: List<String>,
    val checkedAt: Long
)

data class SbomDocument(
    val format: String, // SPDX, CycloneDX
    val version: String,
    val projectId: String,
    val projectName: String,
    val timestamp: Long,
    val dependencies: List<Dependency>,
    val vulnerabilities: List<Vulnerability>,
    val licenses: List<LicenseInfo>,
    val metadata: Map<String, Any>
)

data class LicenseInfo(
    val id: String,
    val name: String,
    val spdxId: String? = null,
    val category: String? = null,
    val isCommercial: Boolean = false,
    val isCopryleft: Boolean = false,
    val risks: List<String> = emptyList()
)

data class ProjectInfo(
    val id: String,
    val name: String,
    val description: String? = null,
    val organizationId: String,
    val repositoryUrl: String? = null,
    val language: String,
    val buildSystem: String, // maven, gradle, npm, pip, cargo
    val lastAnalysis: Long? = null,
    val totalDependencies: Int = 0,
    val vulnerabilityCount: Int = 0,
    val policyViolationCount: Int = 0,
    val complianceScore: Double = 0.0,
    val tags: List<String> = emptyList(),
    val metadata: Map<String, Any> = emptyMap()
)

data class AnalysisRequest(
    val projectId: String,
    val force: Boolean = false,
    val includeTransitive: Boolean = true,
    val checkPolicies: Boolean = true,
    val checkVulnerabilities: Boolean = true,
    val checkLicenses: Boolean = false,
    val filters: AnalysisFilters? = null
)

data class AnalysisFilters(
    val ecosystems: List<String>? = null,
    val scopes: List<String>? = null,
    val severities: List<VulnerabilitySeverity>? = null,
    val includeResolvedViolations: Boolean = false
)

// Extended Models for IDE Integration

data class DependencyInfo(
    val groupId: String,
    val artifactId: String,
    val version: String,
    val latestVersion: String? = null,
    val vulnerabilities: List<VulnerabilityInfo> = emptyList(),
    val policyViolations: List<PolicyViolationInfo> = emptyList(),
    val updateAvailable: String? = null,
    val releaseNotes: String? = null,
    val lastAnalyzed: Long = System.currentTimeMillis()
)

data class VulnerabilityInfo(
    val cveId: String,
    val description: String,
    val severity: String,
    val cvssScore: Double? = null,
    val publishedDate: String? = null,
    val references: List<String>? = null,
    val quickFixes: List<com.upm.plugin.annotators.IntentionAction>? = null
)

data class PolicyViolationInfo(
    val policyName: String,
    val description: String,
    val severity: String,
    val recommendation: String? = null,
    val quickFixes: List<com.upm.plugin.annotators.IntentionAction>? = null
)
