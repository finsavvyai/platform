package com.upm.plugin.annotators

import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.ExternalAnnotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.JavaPsiFacade
import com.intellij.psi.PsiDocumentManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiImportStatement
import com.intellij.psi.PsiJavaFile
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyInfo
import com.upm.plugin.api.models.VulnerabilityInfo
import com.upm.plugin.utils.UPMLogger
import org.jetbrains.annotations.NotNull
import org.jetbrains.annotations.Nullable

/**
 * Annotator for Java import statements to detect dependency-related issues.
 *
 * This annotator analyzes Java import statements and highlights dependencies
 * with known vulnerabilities, policy violations, or outdated versions.
 *
 * Features:
 * - Analyzes Java import statements
 * - Links imports to Maven/Gradle dependencies
 * - Provides vulnerability warnings on import statements
 * - Performance optimized with caching
 * - Quick fix suggestions for dependency updates
 */
class JavaImportAnnotator : ExternalAnnotator<PsiFile, JavaImportAnnotator.JavaImportAnalysisResult>() {

    /**
     * Result of Java import analysis
     */
    data class JavaImportAnalysisResult(
        val importDependencies: Map<String, DependencyInfo>,
        val analysisTime: Long,
        val hasErrors: Boolean = false,
        val errorMessage: String? = null
    )

    @Nullable
    override fun collectInformation(@NotNull file: PsiFile): PsiFile? {
        // Only process Java files
        if (file !is PsiJavaFile) return null

        val virtualFile = file.virtualFile ?: return null

        // Only analyze if it's in a source directory
        if (!isInSourceDirectory(virtualFile.path)) {
            return null
        }

        return file
    }

    @Nullable
    override fun doAnnotate(inputFile: PsiFile?): JavaImportAnalysisResult? {
        if (inputFile == null || inputFile !is PsiJavaFile) return null

        return try {
            val project = inputFile.project
            val upmService = UPMService.getInstance(project)
            val startTime = System.currentTimeMillis()

            // Get all import statements
            val importStatements = inputFile.importList?.allImportStatements ?: emptyList()

            // Map import statements to dependencies
            val importDependencies = mutableMapOf<String, DependencyInfo>()

            importStatements.forEach { importStatement ->
                val packageName = extractPackageName(importStatement)
                if (packageName != null) {
                    // Find the dependency that provides this package
                    val dependency = findDependencyForPackage(upmService, packageName, inputFile)
                    if (dependency != null) {
                        importDependencies[importStatement.text] = dependency
                    }
                }
            }

            val analysisTime = System.currentTimeMillis() - startTime

            JavaImportAnalysisResult(
                importDependencies = importDependencies,
                analysisTime = analysisTime,
                hasErrors = false
            )
        } catch (e: Exception) {
            UPMLogger.error("Error during Java import annotation", e)
            JavaImportAnalysisResult(
                importDependencies = emptyMap(),
                analysisTime = 0,
                hasErrors = true,
                errorMessage = e.message
            )
        }
    }

    override fun apply(@NotNull file: PsiFile, @NotNull result: JavaImportAnalysisResult?, @NotNull holder: AnnotationHolder) {
        if (result == null || result.hasErrors) {
            result?.errorMessage?.let { errorMsg ->
                holder.newAnnotation(HighlightSeverity.ERROR, "UPM Java Import Analysis Error: $errorMsg")
                    .range(file.textRange)
                    .create()
            }
            return
        }

        if (file !is PsiJavaFile) return

        // Apply annotations for each import statement
        file.importList?.allImportStatements?.forEach { importStatement ->
            val importText = importStatement.text
            val dependency = result.importDependencies[importText]

            if (dependency != null) {
                applyImportAnnotations(importStatement, dependency, holder)
            }
        }

        // Log analysis performance
        UPMLogger.debug("Java import analysis completed in ${result.analysisTime}ms for ${file.name}")
    }

    private fun applyImportAnnotations(importStatement: PsiImportStatement, dependency: DependencyInfo, holder: AnnotationHolder) {
        val importTextRange = importStatement.textRange

        // Apply vulnerability annotations
        dependency.vulnerabilities.forEach { vulnerability ->
            applyVulnerabilityAnnotation(importStatement, vulnerability, holder)
        }

        // Apply policy violation annotations
        dependency.policyViolations.forEach { violation ->
            applyPolicyViolationAnnotation(importStatement, violation, holder)
        }

        // Apply outdated annotation
        if (isOutdated(dependency)) {
            applyOutdatedAnnotation(importStatement, dependency, holder)
        }
    }

    private fun applyVulnerabilityAnnotation(importStatement: PsiImportStatement, vulnerability: VulnerabilityInfo, holder: AnnotationHolder) {
        val severity = when (vulnerability.severity.uppercase()) {
            "CRITICAL" -> HighlightSeverity.ERROR
            "HIGH" -> HighlightSeverity.WARNING
            "MEDIUM" -> HighlightSeverity.WARNING
            "LOW" -> HighlightSeverity.WEAK_WARNING
            else -> HighlightSeverity.WEAK_WARNING
        }

        val message = "Import from dependency with ${vulnerability.severity} vulnerability: ${vulnerability.description}"
        val tooltip = generateImportVulnerabilityTooltip(vulnerability, importStatement.qualifiedName)

        val annotation = holder.newAnnotation(severity, message)
            .range(importStatement.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        vulnerability.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        // Add dependency-specific quick fix
        val dependencyFix = UpdateDependencyForImportQuickFix(dependency, importStatement.qualifiedName)
        annotation.withFix(dependencyFix)

        annotation.create()
    }

    private fun applyPolicyViolationAnnotation(importStatement: PsiImportStatement, violation: PolicyViolation, holder: AnnotationHolder) {
        val message = "Import from dependency with policy violation: ${violation.description}"
        val tooltip = generateImportPolicyViolationTooltip(violation, importStatement.qualifiedName)

        val annotation = holder.newAnnotation(HighlightSeverity.WARNING, message)
            .range(importStatement.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add quick fixes
        violation.quickFixes?.forEach { quickFix ->
            annotation.withFix(quickFix)
        }

        // Add dependency-specific quick fix
        val dependencyFix = UpdateDependencyForImportQuickFix(dependency, importStatement.qualifiedName)
        annotation.withFix(dependencyFix)

        annotation.create()
    }

    private fun applyOutdatedAnnotation(importStatement: PsiImportStatement, dependency: DependencyInfo, holder: AnnotationHolder) {
        val message = "Import from outdated dependency (current: ${dependency.version}, latest: ${dependency.latestVersion})"
        val tooltip = generateImportOutdatedTooltip(dependency, importStatement.qualifiedName)

        val annotation = holder.newAnnotation(HighlightSeverity.WEAK_WARNING, message)
            .range(importStatement.textRange)
            .tooltip(tooltip)
            .needsUpdateOnTyping()

        // Add update quick fix
        val updateFix = UpdateDependencyForImportQuickFix(dependency, importStatement.qualifiedName)
        annotation.withFix(updateFix)

        annotation.create()
    }

    private fun extractPackageName(importStatement: PsiImportStatement): String? {
        val qualifiedName = importStatement.qualifiedName

        // For static imports, extract the class name part
        if (importStatement.isOnDemand) {
            // import com.example.package.*
            return qualifiedName.substringBeforeLast(".")
        } else {
            // import com.example.package.Class
            return qualifiedName.substringBeforeLast(".")
        }
    }

    private fun findDependencyForPackage(upmService: UPMService, packageName: String, javaFile: PsiJavaFile): DependencyInfo? {
        return try {
            // Get all project dependencies
            val allDependencies = upmService.getProjectDependencies(javaFile.project)

            // Find the dependency that most likely provides this package
            // This is a simplified approach - in reality, you'd need to check the actual JAR contents
            allDependencies.find { dependency ->
                packageMatchesDependency(packageName, dependency)
            }
        } catch (e: Exception) {
            UPMLogger.warn("Error finding dependency for package: $packageName", e)
            null
        }
    }

    private fun packageMatchesDependency(packageName: String, dependency: DependencyInfo): Boolean {
        // Simple heuristic: check if package name contains group ID
        return packageName.contains(dependency.groupId.replace(".", "")) ||
               packageName.startsWith(dependency.groupId) ||
               dependency.artifactId.equals(packageName.substringAfterLast("."), ignoreCase = true)
    }

    private fun isOutdated(dependency: DependencyInfo): Boolean {
        return dependency.latestVersion != null && dependency.latestVersion != dependency.version
    }

    private fun isInSourceDirectory(filePath: String): Boolean {
        // Check if file is in a source directory (src/main/java, src/test/java, etc.)
        return filePath.contains("/src/main/java/") ||
               filePath.contains("/src/test/java/") ||
               filePath.contains("\\src\\main\\java\\") ||
               filePath.contains("\\src\\test\\java\\")
    }

    private fun generateImportVulnerabilityTooltip(vulnerability: VulnerabilityInfo, importName: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='red'>Vulnerability in Imported Dependency</font></b><br/>")
            append("Import: <code>$importName</code><br/>")
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

    private fun generateImportPolicyViolationTooltip(violation: PolicyViolation, importName: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='orange'>Policy Violation in Imported Dependency</font></b><br/>")
            append("Import: <code>$importName</code><br/>")
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

    private fun generateImportOutdatedTooltip(dependency: DependencyInfo, importName: String): String {
        return buildString {
            append("<html><body>")
            append("<b><font color='blue'>Outdated Imported Dependency</font></b><br/>")
            append("Import: <code>$importName</code><br/>")
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
 * Quick fix for updating dependencies when issues are found in import statements
 */
class UpdateDependencyForImportQuickFix(
    private val dependency: DependencyInfo,
    private val importName: String
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
                    UPMLogger.info("Successfully updated ${dependency.groupId}:${dependency.artifactId} for import: $importName")

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
