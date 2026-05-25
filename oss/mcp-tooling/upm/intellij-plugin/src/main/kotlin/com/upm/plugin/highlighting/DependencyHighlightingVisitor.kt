package com.upm.plugin.highlighting

import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.codeInsight.daemon.impl.HighlightVisitor
import com.intellij.codeInsight.daemon.impl.analysis.HighlightInfoHolder
import com.intellij.codeInsight.daemon.impl.quickfix.QuickFixAction
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.xml.XmlAttribute
import com.intellij.psi.xml.XmlAttributeValue
import com.intellij.psi.xml.XmlTag
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyInfo
import com.upm.plugin.api.models.VulnerabilityInfo
import com.upm.plugin.utils.UPMLogger
import com.upm.plugin.annotators.DependencyAnnotator

/**
 * Real-time dependency highlighting visitor for IntelliJ IDEA editor.
 *
 * This visitor scans XML files (pom.xml, build.gradle.kts) and highlights
 * dependencies with known vulnerabilities, policy violations, or outdated versions.
 *
 * Features:
 * - Vulnerability severity-based highlighting
 * - Real-time updates as user types
 * - Performance optimized for large files
 * - Quick fix integration
 */
class DependencyHighlightingVisitor : HighlightVisitor {

    private lateinit var infoHolder: HighlightInfoHolder
    private lateinit var upmService: UPMService
    private var fileAnalysisCache: MutableMap<String, List<DependencyInfo>> = mutableMapOf()

    override fun suitableForFile(file: PsiFile): Boolean {
        val fileName = file.name
        return fileName == "pom.xml" ||
               fileName == "build.gradle" ||
               fileName == "build.gradle.kts" ||
               fileName.endsWith(".gradle")
    }

    override fun analyze(file: PsiFile, updateWholeFile: Boolean, holder: HighlightInfoHolder, action: Runnable): Boolean {
        infoHolder = holder
        upmService = UPMService.getInstance(file.project)

        try {
            // Analyze the file for dependencies
            analyzeDependencies(file)

            // Run the action to continue processing
            action.run()

            return true
        } catch (e: Exception) {
            UPMLogger.error("Error during dependency highlighting", e)
            return false
        }
    }

    private fun analyzeDependencies(file: PsiFile) {
        val fileKey = file.virtualFile?.path ?: return

        // Check cache first to avoid redundant API calls
        val cachedAnalysis = fileAnalysisCache[fileKey]
        if (cachedAnalysis != null && !isStale(cachedAnalysis)) {
            highlightDependencies(cachedAnalysis, file)
            return
        }

        // Perform analysis in background
        upmService.analyzeDependenciesAsync(file) { dependencies ->
            fileAnalysisCache[fileKey] = dependencies
            highlightDependencies(dependencies, file)
        }
    }

    private fun highlightDependencies(dependencies: List<DependencyInfo>, file: PsiFile) {
        file.accept(object : com.intellij.psi.XmlElementVisitor() {
            override fun visitXmlTag(tag: XmlTag?) {
                tag?.let { processTag(it, dependencies) }
                super.visitXmlTag(tag)
            }

            override fun visitXmlAttribute(attribute: XmlAttribute?) {
                attribute?.let { processAttribute(it, dependencies) }
                super.visitXmlAttribute(attribute)
            }

            override fun visitXmlAttributeValue(value: XmlAttributeValue?) {
                value?.let { processAttributeValue(it, dependencies) }
                super.visitXmlAttributeValue(value)
            }
        })
    }

    private fun processTag(tag: XmlTag, dependencies: List<DependencyInfo>) {
        when (tag.name) {
            "dependency" -> processMavenDependency(tag, dependencies)
            "artifact", "implementation", "compile", "api", "runtimeOnly", "testImplementation" ->
                processGradleDependency(tag, dependencies)
        }
    }

    private fun processMavenDependency(tag: XmlTag, dependencies: List<DependencyInfo>) {
        val groupIdElement = tag.findFirstSubTag("groupId")?.valueElement
        val artifactIdElement = tag.findFirstSubTag("artifactId")?.valueElement
        val versionElement = tag.findFirstSubTag("version")?.valueElement

        if (groupIdElement != null && artifactIdElement != null && versionElement != null) {
            val groupId = groupIdElement.value
            val artifactId = artifactIdElement.value
            val version = versionElement.value

            val dependency = dependencies.find {
                it.groupId == groupId && it.artifactId == artifactId && it.version == version
            }

            dependency?.let {
                highlightDependencyElement(versionElement, it)
            }
        }
    }

    private fun processGradleDependency(tag: XmlTag, dependencies: List<DependencyInfo>) {
        // Handle Gradle DSL dependencies
        val dependencyText = tag.value?.trim() ?: return

        // Parse Gradle dependency notation (e.g., "group:artifact:version")
        val parts = dependencyText.split(":")
        if (parts.size >= 3) {
            val groupId = parts[0].trim('"', '\'')
            val artifactId = parts[1].trim('"', '\'')
            val version = parts[2].trim('"', '\'')

            val dependency = dependencies.find {
                it.groupId == groupId && it.artifactId == artifactId && it.version == version
            }

            dependency?.let {
                highlightTag(tag, it)
            }
        }
    }

    private fun processAttribute(attribute: XmlAttribute, dependencies: List<DependencyInfo>) {
        when (attribute.name) {
            "version" -> {
                val parentTag = attribute.parent as? XmlTag
                parentTag?.let { tag ->
                    val dependency = findDependencyForTag(tag, dependencies)
                    dependency?.let {
                        highlightAttribute(attribute, it)
                    }
                }
            }
        }
    }

    private fun processAttributeValue(value: XmlAttributeValue, dependencies: List<DependencyInfo>) {
        // Process dependency declarations in attribute values
        val attributeText = value.value

        // Check if this looks like a dependency declaration
        if (attributeText.contains(":") && attributeText.split(":").size >= 3) {
            val parts = attributeText.split(":")
            val groupId = parts[0].trim('"', '\'')
            val artifactId = parts[1].trim('"', '\'')
            val version = parts[2].trim('"', '\'')

            val dependency = dependencies.find {
                it.groupId == groupId && it.artifactId == artifactId && it.version == version
            }

            dependency?.let {
                highlightAttributeValue(value, it)
            }
        }
    }

    private fun findDependencyForTag(tag: XmlTag, dependencies: List<DependencyInfo>): DependencyInfo? {
        // Extract dependency coordinates from tag context
        val groupId = tag.findFirstSubTag("groupId")?.valueElement?.value
        val artifactId = tag.findFirstSubTag("artifactId")?.valueElement?.value

        return if (groupId != null && artifactId != null) {
            dependencies.find { it.groupId == groupId && it.artifactId == artifactId }
        } else {
            null
        }
    }

    private fun highlightDependencyElement(element: PsiElement, dependency: DependencyInfo) {
        when {
            hasCriticalVulnerabilities(dependency) -> {
                createHighlight(element, dependency.vulnerabilities.first(),
                              DependencyHighlightSeverity.CRITICAL)
            }
            hasHighVulnerabilities(dependency) -> {
                createHighlight(element, dependency.vulnerabilities.first(),
                              DependencyHighlightSeverity.HIGH)
            }
            hasPolicyViolations(dependency) -> {
                createPolicyHighlight(element, dependency)
            }
            isOutdated(dependency) -> {
                createOutdatedHighlight(element, dependency)
            }
        }
    }

    private fun highlightTag(tag: XmlTag, dependency: DependencyInfo) {
        highlightDependencyElement(tag, dependency)
    }

    private fun highlightAttribute(attribute: XmlAttribute, dependency: DependencyInfo) {
        highlightDependencyElement(attribute.valueElement ?: return, dependency)
    }

    private fun highlightAttributeValue(value: XmlAttributeValue, dependency: DependencyInfo) {
        highlightDependencyElement(value, dependency)
    }

    private fun createHighlight(element: PsiElement, vulnerability: VulnerabilityInfo,
                              severity: DependencyHighlightSeverity) {
        val builder = HighlightInfo.newHighlightInfo(severity.highlightType)
            .range(element)
            .description(vulnerability.description)
            .tooltip(getVulnerabilityTooltip(vulnerability))
            .textAttributes(severity.textAttributesKey)

        // Add quick fixes
        vulnerability.quickFixes?.forEach { quickFix ->
            builder.registerFix(QuickFixAction.wrap(quickFix, element))
        }

        val highlightInfo = builder.create()
        highlightInfo?.let { infoHolder.add(it) }
    }

    private fun createPolicyHighlight(element: PsiElement, dependency: DependencyInfo) {
        val builder = HighlightInfo.newHighlightInfo(DependencyHighlightSeverity.POLICY_VIOLATION.highlightType)
            .range(element)
            .description("Policy violation: ${dependency.policyViolations.joinToString(", ")}")
            .tooltip(getPolicyViolationTooltip(dependency))
            .textAttributes(DependencyHighlightSeverity.POLICY_VIOLATION.textAttributesKey)

        // Add policy violation quick fixes
        dependency.policyViolations.forEach { violation ->
            violation.quickFixes?.forEach { quickFix ->
                builder.registerFix(QuickFixAction.wrap(quickFix, element))
            }
        }

        val highlightInfo = builder.create()
        highlightInfo?.let { infoHolder.add(it) }
    }

    private fun createOutdatedHighlight(element: PsiElement, dependency: DependencyInfo) {
        val builder = HighlightInfo.newHighlightInfo(DependencyHighlightSeverity.OUTDATED.highlightType)
            .range(element)
            .description("Outdated dependency: Latest version is ${dependency.latestVersion}")
            .tooltip(getOutdatedTooltip(dependency))
            .textAttributes(DependencyHighlightSeverity.OUTDATED.textAttributesKey)

        // Add update quick fix
        val updateFix = CreateUpdateDependencyIntention(dependency)
        builder.registerFix(QuickFixAction.wrap(updateFix, element))

        val highlightInfo = builder.create()
        highlightInfo?.let { infoHolder.add(it) }
    }

    private fun hasCriticalVulnerabilities(dependency: DependencyInfo): Boolean {
        return dependency.vulnerabilities.any {
            it.severity == VulnerabilitySeverity.CRITICAL
        }
    }

    private fun hasHighVulnerabilities(dependency: DependencyInfo): Boolean {
        return dependency.vulnerabilities.any {
            it.severity == VulnerabilitySeverity.HIGH
        }
    }

    private fun hasPolicyViolations(dependency: DependencyInfo): Boolean {
        return dependency.policyViolations.isNotEmpty()
    }

    private fun isOutdated(dependency: DependencyInfo): Boolean {
        return dependency.latestVersion != null &&
               dependency.latestVersion != dependency.version
    }

    private fun isStale(dependencies: List<DependencyInfo>): Boolean {
        // Check if analysis is older than 5 minutes
        val fiveMinutesAgo = System.currentTimeMillis() - (5 * 60 * 1000)
        return dependencies.any { it.lastAnalyzed < fiveMinutesAgo }
    }

    private fun getVulnerabilityTooltip(vulnerability: VulnerabilityInfo): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='red'>${vulnerability.severity} Vulnerability</font></b><br/>")
            append("CVE: ${vulnerability.cveId}<br/>")
            append("Description: ${vulnerability.description}<br/>")
            append("CVSS Score: ${vulnerability.cvssScore}<br/>")
            if (vulnerability.publishedDate != null) {
                append("Published: ${vulnerability.publishedDate}<br/>")
            }
            append("</body></html>")
        }
    }

    private fun getPolicyViolationTooltip(dependency: DependencyInfo): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='orange'>Policy Violations</font></b><br/>")
            dependency.policyViolations.forEach { violation ->
                append("• ${violation.description}<br/>")
            }
            append("</body></html>")
        }
    }

    private fun getOutdatedTooltip(dependency: DependencyInfo): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='blue'>Outdated Dependency</font></b><br/>")
            append("Current version: ${dependency.version}<br/>")
            append("Latest version: ${dependency.latestVersion}<br/>")
            if (dependency.updateAvailable != null) {
                append("Update type: ${dependency.updateAvailable}<br/>")
            }
            append("</body></html>")
        }
    }

    override fun clone(): HighlightVisitor {
        return DependencyHighlightingVisitor()
    }

    /**
     * Clear analysis cache when file is modified
     */
    fun clearCache() {
        fileAnalysisCache.clear()
    }

    /**
     * Clear cache for specific file
     */
    fun clearCacheForFile(filePath: String) {
        fileAnalysisCache.remove(filePath)
    }
}

/**
 * Severity levels for dependency highlighting
 */
enum class DependencyHighlightSeverity(
    val highlightType: HighlightInfoType,
    val textAttributesKey: TextAttributesKey
) {
    CRITICAL(HighlightInfoType.ERROR, CodeInsightColors.ERRORS_ATTRIBUTES),
    HIGH(HighlightInfoType.WARNING, CodeInsightColors.WARNINGS_ATTRIBUTES),
    POLICY_VIOLATION(HighlightInfoType.WARNING, CodeInsightColors.WRONG_REFERENCES_ATTRIBUTES),
    OUTDATED(HighlightInfoType.WEAK_WARNING, CodeInsightColors.DEPRECATED_ATTRIBUTES)
}

/**
 * Vulnerability severity levels
 */
enum class VulnerabilitySeverity {
    CRITICAL, HIGH, MEDIUM, LOW, INFO
}

/**
 * Quick fix for updating dependencies
 */
class CreateUpdateDependencyIntention(private val dependency: DependencyInfo) : IntentionAction {
    override fun getText(): String = "Update ${dependency.groupId}:${dependency.artifactId} to ${dependency.latestVersion}"

    override fun getFamilyName(): String = "Update Dependency"

    override fun isAvailable(project: Project, editor: Editor, file: PsiFile): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    override fun invoke(project: Project, editor: Editor, file: PsiFile) {
        // Implement update logic
        WriteCommandAction.runWriteCommandAction(project) {
            // Find and replace the version in the file
            val document = editor.document
            val text = document.text

            // Simple replacement - could be enhanced with more sophisticated parsing
            val updatedText = text.replace(
                "version>${dependency.version}</version",
                "version>${dependency.latestVersion}</version"
            )

            document.setText(updatedText)

            // Show notification
            UPMLogger.info("Updated ${dependency.groupId}:${dependency.artifactId} to ${dependency.latestVersion}")
        }
    }

    override fun startInWriteAction(): Boolean = true
}
