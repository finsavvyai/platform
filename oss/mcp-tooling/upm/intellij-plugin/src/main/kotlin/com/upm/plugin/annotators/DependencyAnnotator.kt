package com.upm.plugin.annotators

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.ExternalAnnotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiFile
import com.intellij.psi.xml.XmlAttribute
import com.intellij.psi.xml.XmlAttributeValue
import com.intellij.psi.xml.XmlTag
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyInfo
import com.upm.plugin.api.models.VulnerabilityInfo
import com.upm.plugin.utils.UPMLogger
import org.jetbrains.annotations.NotNull
import org.jetbrains.annotations.Nullable

/**
 * External annotator for real-time dependency analysis and inline warnings.
 *
 * This annotator runs asynchronously to analyze dependencies and provide
 * inline warnings, suggestions, and quick fixes without blocking the UI.
 *
 * Features:
 * - Asynchronous dependency analysis
 * - Real-time vulnerability warnings
 * - Inline quick fix suggestions
 * - Performance optimized for large files
 * - Caching to avoid redundant analysis
 */
class DependencyAnnotator : ExternalAnnotator<PsiFile, DependencyAnnotator.DependencyAnalysisResult>() {

    /**
     * Input state for the annotation process
     */
    data class DependencyAnalysisInput(
        val psiFile: PsiFile,
        val project: Project,
        val fileContent: String,
        val filePath: String
    )

    /**
     * Result of dependency analysis
     */
    data class DependencyAnalysisResult(
        val dependencies: List<DependencyInfo>,
        val analysisTime: Long,
        val hasErrors: Boolean = false,
        val errorMessage: String? = null
    )

    @Nullable
    override fun collectInformation(@NotNull file: PsiFile): DependencyAnalysisInput? {
        val project = file.project
        val virtualFile = file.virtualFile ?: return null

        // Only analyze relevant files
        if (!isRelevantFile(virtualFile.name)) {
            return null
        }

        val content = ReadAction.compute<String, Throwable> {
            file.text
        }

        return DependencyAnalysisInput(
            psiFile = file,
            project = project,
            fileContent = content,
            filePath = virtualFile.path
        )
    }

    @Nullable
    override fun doAnnotate(input: DependencyAnalysisInput?): DependencyAnalysisResult? {
        if (input == null) return null

        return try {
            val upmService = UPMService.getInstance(input.project)
            val startTime = System.currentTimeMillis()

            // Perform dependency analysis
            val dependencies = upmService.analyzeDependencies(input.psiFile)
            val analysisTime = System.currentTimeMillis() - startTime

            DependencyAnalysisResult(
                dependencies = dependencies,
                analysisTime = analysisTime,
                hasErrors = false
            )
        } catch (e: Exception) {
            UPMLogger.error("Error during dependency annotation", e)
            DependencyAnalysisResult(
                dependencies = emptyList(),
                analysisTime = 0,
                hasErrors = true,
                errorMessage = e.message
            )
        }
    }

    override fun apply(@NotNull file: PsiFile, @NotNull result: DependencyAnalysisResult?, @NotNull holder: AnnotationHolder) {
        if (result == null || result.hasErrors) {
            result?.errorMessage?.let { errorMsg ->
                holder.newAnnotation(HighlightSeverity.ERROR, "UPM Analysis Error: $errorMsg")
                    .range(file.textRange)
                    .create()
            }
            return
        }

        // Apply annotations for each dependency found
        result.dependencies.forEach { dependency ->
            applyDependencyAnnotations(file, dependency, holder)
        }

        // Log analysis performance
        UPMLogger.debug("Dependency analysis completed in ${result.analysisTime}ms for ${file.name}")
    }

    private fun applyDependencyAnnotations(file: PsiFile, dependency: DependencyInfo, holder: AnnotationHolder) {
        // Find dependency elements in the file and apply annotations
        file.accept(object : com.intellij.psi.XmlElementVisitor() {
            override fun visitXmlTag(tag: XmlTag?) {
                tag?.let { processTag(it, dependency, holder) }
                super.visitXmlTag(tag)
            }

            override fun visitXmlAttribute(attribute: XmlAttribute?) {
                attribute?.let { processAttribute(it, dependency, holder) }
                super.visitXmlAttribute(attribute)
            }

            override fun visitXmlAttributeValue(value: XmlAttributeValue?) {
                value?.let { processAttributeValue(it, dependency, holder) }
                super.visitXmlAttributeValue(value)
            }
        })
    }

    private fun processTag(tag: XmlTag, dependency: DependencyInfo, holder: AnnotationHolder) {
        when (tag.name) {
            "dependency" -> processMavenDependencyTag(tag, dependency, holder)
            "artifact", "implementation", "compile", "api", "runtimeOnly", "testImplementation" ->
                processGradleDependencyTag(tag, dependency, holder)
        }
    }

    private fun processMavenDependencyTag(tag: XmlTag, dependency: DependencyInfo, holder: AnnotationHolder) {
        val groupIdElement = tag.findFirstSubTag("groupId")?.valueElement
        val artifactIdElement = tag.findFirstSubTag("artifactId")?.valueElement
        val versionElement = tag.findFirstSubTag("version")?.valueElement

        if (matchesDependency(groupIdElement, artifactIdElement, dependency)) {
            versionElement?.let { versionElement ->
                applyVersionAnnotations(versionElement, dependency, holder)
            }
        }
    }

    private fun processGradleDependencyTag(tag: XmlTag, dependency: DependencyInfo, holder: AnnotationHolder) {
        val dependencyText = tag.value?.trim() ?: return

        if (matchesGradleDependency(dependencyText, dependency)) {
            applyTagAnnotations(tag, dependency, holder)
        }
    }

    private fun processAttribute(attribute: XmlAttribute, dependency: DependencyInfo, holder: AnnotationHolder) {
        if (attribute.name == "version") {
            val parentTag = attribute.parent as? XmlTag
            parentTag?.let { tag ->
                if (matchesDependencyTag(tag, dependency)) {
                    applyAttributeAnnotations(attribute, dependency, holder)
                }
            }
        }
    }

    private fun processAttributeValue(value: XmlAttributeValue, dependency: DependencyInfo, holder: AnnotationHolder) {
        val attributeText = value.value

        if (matchesGradleDependency(attributeText, dependency)) {
            applyAttributeValueAnnotations(value, dependency, holder)
        }
    }

    private fun applyVersionAnnotations(element: PsiElement, dependency: DependencyInfo, holder: AnnotationHolder) {
        val textRange = element.textRange

        // Apply vulnerability annotations
        dependency.vulnerabilities.forEach { vulnerability ->
            applyVulnerabilityAnnotation(element, vulnerability, holder)
        }

        // Apply policy violation annotations
        dependency.policyViolations.forEach { violation ->
            applyPolicyViolationAnnotation(element, violation, holder)
        }

        // Apply outdated annotation
        if (isOutdated(dependency)) {
            applyOutdatedAnnotation(element, dependency, holder)
        }
    }

    private fun applyTagAnnotations(tag: XmlTag, dependency: DependencyInfo, holder: AnnotationHolder) {
        applyVersionAnnotations(tag, dependency, holder)
    }

    private fun applyAttributeAnnotations(attribute: XmlAttribute, dependency: DependencyInfo, holder: AnnotationHolder) {
        attribute.valueElement?.let { valueElement ->
            applyVersionAnnotations(valueElement, dependency, holder)
        }
    }

    private fun applyAttributeValueAnnotations(value: XmlAttributeValue, dependency: DependencyInfo, holder: AnnotationHolder) {
        applyVersionAnnotations(value, dependency, holder)
    }

    private fun applyVulnerabilityAnnotation(element: PsiElement, vulnerability: VulnerabilityInfo, holder: AnnotationHolder) {
        val severity = when (vulnerability.severity) {
            "CRITICAL" -> HighlightSeverity.ERROR
            "HIGH" -> HighlightSeverity.WARNING
            "MEDIUM" -> HighlightSeverity.WARNING
            "LOW" -> HighlightSeverity.WEAK_WARNING
            else -> HighlightSeverity.WEAK_WARNING
        }

        val message = "${vulnerability.severity} vulnerability: ${vulnerability.description}"
        val tooltip = generateVulnerabilityTooltip(vulnerability)

        val annotation = holder.newAnnotation(severity, message)
            .range(element.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        vulnerability.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        annotation.create()
    }

    private fun applyPolicyViolationAnnotation(element: PsiElement, violation: PolicyViolation, holder: AnnotationHolder) {
        val message = "Policy violation: ${violation.description}"
        val tooltip = generatePolicyViolationTooltip(violation)

        val annotation = holder.newAnnotation(HighlightSeverity.WARNING, message)
            .range(element.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        violation.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        annotation.create()
    }

    private fun applyOutdatedAnnotation(element: PsiElement, dependency: DependencyInfo, holder: AnnotationHolder) {
        val message = "Outdated: Latest version is ${dependency.latestVersion}"
        val tooltip = generateOutdatedTooltip(dependency)

        val annotation = holder.newAnnotation(HighlightSeverity.WEAK_WARNING, message)
            .range(element.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add update quick fix
        val updateFix = UpdateDependencyQuickFix(dependency)
        annotation.withFix(updateFix)

        annotation.create()
    }

    private fun matchesDependency(groupIdElement: PsiElement?, artifactIdElement: PsiElement?, dependency: DependencyInfo): Boolean {
        val groupId = groupIdElement?.text?.trim()
        val artifactId = artifactIdElement?.text?.trim()

        return groupId == dependency.groupId && artifactId == dependency.artifactId
    }

    private fun matchesGradleDependency(dependencyText: String, dependency: DependencyInfo): Boolean {
        val parts = dependencyText.split(":")
        if (parts.size >= 3) {
            val groupId = parts[0].trim('"', '\'')
            val artifactId = parts[1].trim('"', '\'')
            return groupId == dependency.groupId && artifactId == dependency.artifactId
        }
        return false
    }

    private fun matchesDependencyTag(tag: XmlTag, dependency: DependencyInfo): Boolean {
        val groupId = tag.findFirstSubTag("groupId")?.valueElement?.text?.trim()
        val artifactId = tag.findFirstSubTag("artifactId")?.valueElement?.text?.trim()

        return groupId == dependency.groupId && artifactId == dependency.artifactId
    }

    private fun isOutdated(dependency: DependencyInfo): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    private fun isRelevantFile(fileName: String): Boolean {
        return fileName == "pom.xml" ||
               fileName == "build.gradle" ||
               fileName == "build.gradle.kts" ||
               fileName.endsWith(".gradle")
    }

    private fun generateVulnerabilityTooltip(vulnerability: VulnerabilityInfo): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='red'>${vulnerability.severity} Vulnerability</font></b><br/>")
            append("CVE: ${vulnerability.cveId}<br/>")
            append("Description: ${vulnerability.description}<br/>")
            append("CVSS Score: ${vulnerability.cvssScore}<br/>")
            if (vulnerability.publishedDate != null) {
                append("Published: ${vulnerability.publishedDate}<br/>")
            }
            if (vulnerability.references?.isNotEmpty() == true) {
                append("References: <br/>")
                vulnerability.references.forEach { ref ->
                    append("• <a href='$ref'>$ref</a><br/>")
                }
            }
            append("</body></html>")
        }
    }

    private fun generatePolicyViolationTooltip(violation: PolicyViolation): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='orange'>Policy Violation</font></b><br/>")
            append("Policy: ${violation.policyName}<br/>")
            append("Description: ${violation.description}<br/>")
            append("Severity: ${violation.severity}<br/>")
            if (violation.recommendation != null) {
                append("Recommendation: ${violation.recommendation}<br/>")
            }
            append("</body></html>")
        }
    }

    private fun generateOutdatedTooltip(dependency: DependencyInfo): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='blue'>Outdated Dependency</font></b><br/>")
            append("Current version: ${dependency.version}<br/>")
            append("Latest version: ${dependency.latestVersion}<br/>")
            if (dependency.updateAvailable != null) {
                append("Update type: ${dependency.updateAvailable}<br/>")
            }
            if (dependency.releaseNotes != null) {
                append("Release notes: ${dependency.releaseNotes}<br/>")
            }
            append("</body></html>")
        }
    }
}

/**
 * Quick fix for updating outdated dependencies
 */
class UpdateDependencyQuickFix(private val dependency: DependencyInfo) : IntentionAction {
    override fun getText(): String = "Update to ${dependency.latestVersion}"

    override fun getFamilyName(): String = "Update Dependency"

    override fun isAvailable(project: Project, editor: Editor, file: PsiFile): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    override fun invoke(project: Project, editor: Editor, file: PsiFile) {
        WriteCommandAction.runWriteCommandAction(project) {
            val document = editor.document
            val text = document.text

            // Find and replace version occurrences
            val patterns = listOf(
                Regex("version>${dependency.version}</version"),
                Regex("version\\s*['\"]${dependency.version}['\"]"),
                Regex("${dependency.groupId}:${dependency.artifactId}:${dependency.version}")
            )

            var updatedText = text
            patterns.forEach { pattern ->
                updatedText = updatedText.replace(pattern, "\$1${dependency.latestVersion}")
            }

            if (updatedText != text) {
                document.setText(updatedText)
                UPMLogger.info("Updated ${dependency.groupId}:${dependency.artifactId} to ${dependency.latestVersion}")
            }
        }
    }

    override fun startInWriteAction(): Boolean = true
}

/**
 * Data classes for policy violations
 */
data class PolicyViolation(
    val policyName: String,
    val description: String,
    val severity: String,
    val recommendation: String? = null,
    val quickFixes: List<IntentionAction>? = null
)
