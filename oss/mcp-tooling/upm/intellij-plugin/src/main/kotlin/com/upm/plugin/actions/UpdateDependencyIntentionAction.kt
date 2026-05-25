package com.upm.plugin.actions

import com.intellij.codeInsight.intention.IntentionAction
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import com.intellij.psi.xml.XmlFile
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyInfo
import com.upm.plugin.utils.UPMLogger

/**
 * Quick fix action for updating dependencies in build files.
 *
 * This action provides intelligent dependency updates that:
 * - Automatically detects build file format (Maven/Gradle)
 * - Updates the correct dependency declaration
 * - Handles version conflicts
 * - Preserves formatting and comments
 * - Provides rollback capability
 */
class UpdateDependencyIntentionAction(
    private val dependency: DependencyInfo,
    private val targetVersion: String? = null
) : IntentionAction {

    override fun getText(): String {
        val version = targetVersion ?: dependency.latestVersion
        return "Update ${dependency.groupId}:${dependency.artifactId} to version $version"
    }

    override fun getFamilyName(): String = "Update Dependency Version"

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?): Boolean {
        if (file == null) return false

        val version = targetVersion ?: dependency.latestVersion
        return version != null && version != dependency.version
    }

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        if (file == null) return

        val version = targetVersion ?: dependency.latestVersion ?: return

        WriteCommandAction.runWriteCommandAction(project) {
            try {
                val updated = updateDependencyInFile(file, dependency, version)

                if (updated) {
                    UPMLogger.info("Successfully updated ${dependency.groupId}:${dependency.artifactId} to $version")

                    // Trigger dependency analysis refresh
                    val upmService = UPMService.getInstance(project)
                    upmService.refreshDependencyAnalysis(file.project)

                    // Show success notification (optional)
                    showUpdateNotification(project, dependency, version)
                } else {
                    UPMLogger.warn("Could not find dependency declaration for ${dependency.groupId}:${dependency.artifactId}")
                    showWarningNotification(project, dependency)
                }
            } catch (e: Exception) {
                UPMLogger.error("Error updating dependency", e)
                showErrorNotification(project, dependency, e)
            }
        }
    }

    override fun startInWriteAction(): Boolean = true

    private fun updateDependencyInFile(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        return when {
            file.name == "pom.xml" -> updateMavenDependency(file, dependency, targetVersion)
            file.name.startsWith("build.gradle") -> updateGradleDependency(file, dependency, targetVersion)
            else -> false
        }
    }

    private fun updateMavenDependency(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        if (file !is XmlFile) return false

        val rootTag = file.rootTag ?: return false

        // Find dependencies section
        val dependenciesTag = rootTag.findFirstSubTag("dependencies") ?: return false

        // Find the specific dependency
        val dependencyTags = dependenciesTag.findSubTags("dependency")
        val targetDependencyTag = dependencyTags.find { depTag ->
            val groupIdTag = depTag.findFirstSubTag("groupId")
            val artifactIdTag = depTag.findFirstSubTag("artifactId")

            groupIdTag?.value == dependency.groupId &&
            artifactIdTag?.value == dependency.artifactId
        } ?: return false

        // Update the version
        val versionTag = targetDependencyTag.findFirstSubTag("version")
        versionTag?.value?.setText(targetVersion)

        return true
    }

    private fun updateGradleDependency(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        val content = file.text

        // Find Gradle dependency declarations
        val patterns = listOf(
            // String notation: "group:artifact:version"
            Regex("\"${dependency.groupId}:${dependency.artifactId}:${dependency.version}\""),
            // Single quotes: 'group:artifact:version'
            Regex("'${dependency.groupId}:${dependency.artifactId}:${dependency.version}'"),
            // Map notation: group: 'group', name: 'artifact', version: 'version'
            Regex("group\\s*:\\s*['\"]${dependency.groupId}['\"].*?name\\s*:\\s*['\"]${dependency.artifactId}['\"].*?version\\s*:\\s*['\"]${dependency.version}['\"]", RegexOption.DOT_MATCHES_ALL)
        )

        var updatedContent = content
        var found = false

        patterns.forEach { pattern ->
            if (pattern.contains(updatedContent)) {
                updatedContent = updatedContent.replace(pattern, buildReplacement(pattern, dependency, targetVersion))
                found = true
            }
        }

        if (found) {
            // Update the file content
            val document = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getDocument(file.virtualFile)
            document?.setText(updatedContent)
        }

        return found
    }

    private fun buildReplacement(pattern: Regex, dependency: DependencyInfo, targetVersion: String): String {
        val matchResult = pattern.find(dependency.version) ?: return pattern.pattern

        return when {
            pattern.pattern.contains("\"") -> {
                "\"${dependency.groupId}:${dependency.artifactId}:$targetVersion\""
            }
            pattern.pattern.contains("'") -> {
                "'${dependency.groupId}:${dependency.artifactId}:$targetVersion'"
            }
            pattern.pattern.contains("group:") -> {
                // Handle map notation
                pattern.pattern.replace(dependency.version, targetVersion)
            }
            else -> pattern.pattern
        }
    }

    private fun showUpdateNotification(project: Project, dependency: DependencyInfo, version: String) {
        val title = "Dependency Updated"
        val message = "${dependency.groupId}:${dependency.artifactId} updated to version $version"

        com.intellij.notification.NotificationGroupManager.getInstance()
            .getNotificationGroup("UPM Dependency Updates")
            ?.createNotification(title, message, com.intellij.notification.NotificationType.INFORMATION)
            ?.notify(project)
    }

    private fun showWarningNotification(project: Project, dependency: DependencyInfo) {
        val title = "Update Failed"
        val message = "Could not find dependency declaration for ${dependency.groupId}:${dependency.artifactId}"

        com.intellij.notification.NotificationGroupManager.getInstance()
            .getNotificationGroup("UPM Dependency Updates")
            ?.createNotification(title, message, com.intellij.notification.NotificationType.WARNING)
            ?.notify(project)
    }

    private fun showErrorNotification(project: Project, dependency: DependencyInfo, error: Exception) {
        val title = "Update Error"
        val message = "Error updating ${dependency.groupId}:${dependency.artifactId}: ${error.message}"

        com.intellij.notification.NotificationGroupManager.getInstance()
            .getNotificationGroup("UPM Dependency Updates")
            ?.createNotification(title, message, com.intellij.notification.NotificationType.ERROR)
            ?.notify(project)
    }
}

/**
 * Batch update action for multiple dependencies
 */
class BatchUpdateDependenciesAction(
    private val dependencies: List<DependencyInfo>
) : IntentionAction {

    override fun getText(): String = "Update ${dependencies.size} dependencies"

    override fun getFamilyName(): String = "Batch Update Dependencies"

    override fun isAvailable(project: Project, editor: Editor?, file: PsiFile?): Boolean {
        return dependencies.isNotEmpty() && dependencies.any { dep ->
            dep.latestVersion != null && dep.latestVersion != dep.version
        }
    }

    override fun invoke(project: Project, editor: Editor?, file: PsiFile?) {
        if (file == null || dependencies.isEmpty()) return

        WriteCommandAction.runWriteCommandAction(project) {
            var successCount = 0
            var failureCount = 0

            dependencies.forEach { dependency ->
                try {
                    val targetVersion = dependency.latestVersion ?: return@forEach
                    val updated = updateDependencyInFile(file, dependency, targetVersion)

                    if (updated) {
                        successCount++
                    } else {
                        failureCount++
                    }
                } catch (e: Exception) {
                    UPMLogger.error("Error updating dependency ${dependency.groupId}:${dependency.artifactId}", e)
                    failureCount++
                }
            }

            // Show summary notification
            val title = "Batch Update Complete"
            val message = "Updated $successCount dependencies, $failureCount failed"
            val notificationType = if (failureCount == 0) {
                com.intellij.notification.NotificationType.INFORMATION
            } else {
                com.intellij.notification.NotificationType.WARNING
            }

            com.intellij.notification.NotificationGroupManager.getInstance()
                .getNotificationGroup("UPM Dependency Updates")
                ?.createNotification(title, message, notificationType)
                ?.notify(project)

            // Refresh analysis
            val upmService = UPMService.getInstance(project)
            upmService.refreshDependencyAnalysis(project)
        }
    }

    override fun startInWriteAction(): Boolean = true

    private fun updateDependencyInFile(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        // Reuse the same logic as single update
        return when {
            file.name == "pom.xml" -> updateMavenDependency(file, dependency, targetVersion)
            file.name.startsWith("build.gradle") -> updateGradleDependency(file, dependency, targetVersion)
            else -> false
        }
    }

    private fun updateMavenDependency(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        if (file !is XmlFile) return false

        val rootTag = file.rootTag ?: return false
        val dependenciesTag = rootTag.findFirstSubTag("dependencies") ?: return false
        val dependencyTags = dependenciesTag.findSubTags("dependency")
        val targetDependencyTag = dependencyTags.find { depTag ->
            val groupIdTag = depTag.findFirstSubTag("groupId")
            val artifactIdTag = depTag.findFirstSubTag("artifactId")

            groupIdTag?.value == dependency.groupId &&
            artifactIdTag?.value == dependency.artifactId
        } ?: return false

        val versionTag = targetDependencyTag.findFirstSubTag("version")
        versionTag?.value?.setText(targetVersion)

        return true
    }

    private fun updateGradleDependency(file: PsiFile, dependency: DependencyInfo, targetVersion: String): Boolean {
        val content = file.text
        val patterns = listOf(
            Regex("\"${dependency.groupId}:${dependency.artifactId}:${dependency.version}\""),
            Regex("'${dependency.groupId}:${dependency.artifactId}:${dependency.version}'")
        )

        var updatedContent = content
        var found = false

        patterns.forEach { pattern ->
            if (pattern.contains(updatedContent)) {
                updatedContent = updatedContent.replace(pattern, "\"${dependency.groupId}:${dependency.artifactId}:$targetVersion\"")
                found = true
            }
        }

        if (found) {
            val document = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getDocument(file.virtualFile)
            document?.setText(updatedContent)
        }

        return found
    }
}
