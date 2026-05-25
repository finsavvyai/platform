package com.upm.plugin.annotators

import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.ExternalAnnotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiImportList
import com.intellij.psi.PsiImportStatement
import com.intellij.psi.util.PsiTreeUtil
import org.jetbrains.kotlin.idea.KotlinLanguage
import org.jetbrains.kotlin.psi.KtFile
import org.jetbrains.kotlin.psi.KtImportDirective
import org.jetbrains.kotlin.psi.psiUtil.startOffset
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyInfo
import com.upm.plugin.api.models.VulnerabilityInfo
import com.upm.plugin.utils.UPMLogger
import org.jetbrains.annotations.NotNull
import org.jetbrains.annotations.Nullable

/**
 * External annotator for Kotlin files to detect dependency-related issues.
 *
 * This annotator analyzes Kotlin import statements and highlights dependencies
 * with known vulnerabilities, policy violations, or outdated versions.
 *
 * Features:
 * - Analyzes Kotlin import statements
 * - Links imports to Maven/Gradle dependencies
 * - Provides vulnerability warnings on import statements
 * - Performance optimized with caching
 * - Quick fix suggestions for dependency updates
 */
class KotlinDependencyAnnotator : ExternalAnnotator<KtFile, KotlinDependencyAnnotator.KotlinImportAnalysisResult>() {

    /**
     * Result of Kotlin import analysis
     */
    data class KotlinImportAnalysisResult(
        val importDependencies: Map<String, DependencyInfo>,
        val analysisTime: Long,
        val hasErrors: Boolean = false,
        val errorMessage: String? = null
    )

    @Nullable
    override fun collectInformation(@NotNull file: PsiFile): KtFile? {
        // Only process Kotlin files
        if (file !is KtFile) return null

        val virtualFile = file.virtualFile ?: return null

        // Only analyze if it's in a source directory
        if (!isInSourceDirectory(virtualFile.path)) {
            return null
        }

        return file
    }

    @Nullable
    override fun doAnnotate(inputFile: KtFile?): KotlinImportAnalysisResult? {
        if (inputFile == null) return null

        return try {
            val project = inputFile.project
            val upmService = UPMService.getInstance(project)
            val startTime = System.currentTimeMillis()

            // Get all import directives
            val importDirectives = inputFile.importDirectives

            // Map import directives to dependencies
            val importDependencies = mutableMapOf<String, DependencyInfo>()

            importDirectives.forEach { importDirective ->
                val importPath = extractImportPath(importDirective)
                if (importPath != null) {
                    // Find the dependency that provides this package
                    val dependency = findDependencyForImport(upmService, importPath, inputFile)
                    if (dependency != null) {
                        importDependencies[importDirective.text!!] = dependency
                    }
                }
            }

            val analysisTime = System.currentTimeMillis() - startTime

            KotlinDependencyAnalysisResult(
                importDependencies = importDependencies,
                analysisTime = analysisTime,
                hasErrors = false
            )
        } catch (e: Exception) {
            UPMLogger.error("Error during Kotlin import annotation", e)
            KotlinDependencyAnalysisResult(
                importDependencies = emptyMap(),
                analysisTime = 0,
                hasErrors = true,
                errorMessage = e.message
            )
        }
    }

    override fun apply(@NotNull file: PsiFile, @NotNull result: KotlinImportAnalysisResult?, @NotNull holder: AnnotationHolder) {
        if (result == null || result.hasErrors) {
            result?.errorMessage?.let { errorMsg ->
                holder.newAnnotation(HighlightSeverity.ERROR, "UPM Kotlin Import Analysis Error: $errorMsg")
                    .range(file.textRange)
                    .create()
            }
            return
        }

        if (file !is KtFile) return

        // Apply annotations for each import directive
        file.importDirectives.forEach { importDirective ->
            val importText = importDirective.text
            if (importText != null) {
                val dependency = result.importDependencies[importText]

                if (dependency != null) {
                    applyImportAnnotations(importDirective, dependency, holder)
                }
            }
        }

        // Log analysis performance
        UPMLogger.debug("Kotlin import analysis completed in ${result.analysisTime}ms for ${file.name}")
    }

    private fun applyImportAnnotations(importDirective: KtImportDirective, dependency: DependencyInfo, holder: AnnotationHolder) {
        val importTextRange = importDirective.textRange

        // Apply vulnerability annotations
        dependency.vulnerabilities.forEach { vulnerability ->
            applyVulnerabilityAnnotation(importDirective, vulnerability, holder)
        }

        // Apply policy violation annotations
        dependency.policyViolations.forEach { violation ->
            applyPolicyViolationAnnotation(importDirective, violation, holder)
        }

        // Apply outdated annotation
        if (isOutdated(dependency)) {
            applyOutdatedAnnotation(importDirective, dependency, holder)
        }
    }

    private fun applyVulnerabilityAnnotation(importDirective: KtImportDirective, vulnerability: VulnerabilityInfo, holder: AnnotationHolder) {
        val severity = when (vulnerability.severity.uppercase()) {
            "CRITICAL" -> HighlightSeverity.ERROR
            "HIGH" -> HighlightSeverity.WARNING
            "MEDIUM" -> HighlightSeverity.WARNING
            "LOW" -> HighlightSeverity.WEAK_WARNING
            else -> HighlightSeverity.WEAK_WARNING
        }

        val importPath = importDirective.importPath ?: return
        val message = "Import from dependency with ${vulnerability.severity} vulnerability: ${vulnerability.description}"
        val tooltip = generateKotlinImportVulnerabilityTooltip(vulnerability, importPath)

        val annotation = holder.newAnnotation(severity, message)
            .range(importDirective.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        vulnerability.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        // Add dependency-specific quick fix
        val dependencyFix = UpdateDependencyForKotlinImportQuickFix(dependency, importPath)
        annotation.withFix(dependencyFix)

        annotation.create()
    }

    private fun applyPolicyViolationAnnotation(importDirective: KtImportDirective, violation: PolicyViolation, holder: AnnotationHolder) {
        val importPath = importDirective.importPath ?: return
        val message = "Import from dependency with policy violation: ${violation.description}"
        val tooltip = generateKotlinImportPolicyViolationTooltip(violation, importPath)

        val annotation = holder.newAnnotation(HighlightSeverity.WARNING, message)
            .range(importDirective.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        violation.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        // Add dependency-specific quick fix
        val dependencyFix = UpdateDependencyForKotlinImportQuickFix(dependency, importPath)
        annotation.withFix(dependencyFix)

        annotation.create()
    }

    private fun applyOutdatedAnnotation(importDirective: KtImportDirective, dependency: DependencyInfo, holder: AnnotationHolder) {
        val importPath = importDirective.importPath ?: return
        val message = "Import from outdated dependency (current: ${dependency.version}, latest: ${dependency.latestVersion})"
        val tooltip = generateKotlinImportOutdatedTooltip(dependency, importPath)

        val annotation = holder.newAnnotation(HighlightSeverity.WEAK_WARNING, message)
            .range(importDirective.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add update quick fix
        val updateFix = UpdateDependencyForKotlinImportQuickFix(dependency, importPath)
        annotation.withFix(updateFix)

        annotation.create()
    }

    private fun extractImportPath(importDirective: KtImportDirective): String? {
        return importDirective.importPath
    }

    private fun findDependencyForImport(upmService: UPMService, importPath: String, ktFile: KtFile): DependencyInfo? {
        return try {
            // Get all project dependencies
            val allDependencies = upmService.getProjectDependencies(ktFile.project)

            // Find the dependency that most likely provides this import
            allDependencies.find { dependency ->
                kotlinImportMatchesDependency(importPath, dependency)
            }
        } catch (e: Exception) {
            UPMLogger.warn("Error finding dependency for import: $importPath", e)
            null
        }
    }

    private fun kotlinImportMatchesDependency(importPath: String, dependency: DependencyInfo): Boolean {
        // Extract the package from the import path
        val packageName = importPath.substringBeforeLast(".")

        // Simple heuristic: check if package name contains group ID
        return packageName.contains(dependency.groupId.replace(".", "")) ||
               packageName.startsWith(dependency.groupId) ||
               dependency.artifactId.equals(packageName.substringAfterLast("."), ignoreCase = true) ||
               dependency.artifactId.equals(importPath.substringAfterLast("."), ignoreCase = true)
    }

    private fun isOutdated(dependency: DependencyInfo): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    private fun isInSourceDirectory(filePath: String): Boolean {
        // Check if file is in a source directory (src/main/kotlin, src/test/kotlin, etc.)
        return filePath.contains("/src/main/kotlin/") ||
               filePath.contains("/src/test/kotlin/") ||
               filePath.contains("/src/main/java/") ||  // Some projects mix Java/Kotlin
               filePath.contains("/src/test/java/") ||
               filePath.contains("\\src\\main\\kotlin\\") ||
               filePath.contains("\\src\\test\\kotlin\\") ||
               filePath.contains("\\src\\main\\java\\") ||
               filePath.contains("\\src\\test\\java\\")
    }

    private fun generateKotlinImportVulnerabilityTooltip(vulnerability: VulnerabilityInfo, importPath: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='red'>Vulnerability in Imported Dependency</font></b><br/>")
            append("Import: <code>$importPath</code><br/>")
            append("CVE: ${vulnerability.cveId}<br/>")
            append("Severity: ${vulnerability.severity}<br/>")
            append("Description: ${vulnerability.description}<br/>")
            append("CVSS Score: ${vulnerability.cvssScore}<br/>")
            if (vulnerability.publishedDate != null) {
                append("Published: ${vulnerability.publishedDate}<br/>")
            }
            append("<br/>")
            append("<i>Consider updating or replacing this dependency to resolve the vulnerability.</i>")
            append("</body></html>")
        }
    }

    private fun generateKotlinImportPolicyViolationTooltip(violation: PolicyViolation, importPath: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='orange'>Policy Violation in Imported Dependency</font></b><br/>")
            append("Import: <code>$importPath</code><br/>")
            append("Policy: ${violation.policyName}<br/>")
            append("Description: ${violation.description}<br/>")
            append("Severity: ${violation.severity}<br/>")
            if (violation.recommendation != null) {
                append("Recommendation: ${violation.recommendation}<br/>")
            }
            append("<br/>")
            append("<i>This import violates your organization's policies.</i>")
            append("</body></html>")
        }
    }

    private fun generateKotlinImportOutdatedTooltip(dependency: DependencyInfo, importPath: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='blue'>Outdated Imported Dependency</font></b><br/>")
            append("Import: <code>$importPath</code><br/>")
            append("Dependency: ${dependency.groupId}:${dependency.artifactId}<br/>")
            append("Current version: ${dependency.version}<br/>")
            append("Latest version: ${dependency.latestVersion}<br/>")
            if (dependency.updateAvailable != null) {
                append("Update type: ${dependency.updateAvailable}<br/>")
            }
            if (dependency.releaseNotes != null) {
                append("Release notes: ${dependency.releaseNotes}<br/>")
            }
            append("<br/>")
            append("<i>Consider updating to the latest version for security and performance improvements.</i>")
            append("</body></html>")
        }
    }
}

/**
 * Quick fix for updating dependencies when issues are found in Kotlin import statements
 */
class UpdateDependencyForKotlinImportQuickFix(
    private val dependency: DependencyInfo,
    private val importPath: String
) : IntentionAction {

    override fun getText(): String = "Update ${dependency.groupId}:${dependency.artifactId} to ${dependency.latestVersion}"

    override fun getFamilyName(): String = "Update Dependency"

    override fun isAvailable(project: Project, editor: Editor, file: PsiFile): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    override fun invoke(project: Project, editor: Editor, file: PsiFile) {
        WriteCommandAction.runWriteCommandAction(project) {
            try {
                val upmService = UPMService.getInstance(project)

                // Update the dependency in the build file
                val updated = upmService.updateDependencyInBuildFile(dependency)

                if (updated) {
                    // Show success notification
                    UPMLogger.info("Successfully updated ${dependency.groupId}:${dependency.artifactId} for Kotlin import: $importPath")

                    // Refresh project dependencies
                    upmService.refreshProjectDependencies(project)
                } else {
                    UPMLogger.warn("Could not update dependency ${dependency.groupId}:${dependency.artifactId}")
                }
            } catch (e: Exception) {
                UPMLogger.error("Error updating dependency", e)
            }
        }
    }

    override fun startInWriteAction(): Boolean = true
}
