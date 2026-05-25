package com.upm.plugin.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.upm.plugin.toolwindow.UPMToolWindowPanel
import com.upm.plugin.utils.UPMLogger

/**
 * Factory class for creating the UPM tool window.
 *
 * This factory creates the custom project structure panel that shows
 * UPM analysis results, dependency trees, and vulnerability summaries.
 */
class UPMToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        try {
            UPMLogger.info("Creating UPM tool window for project: ${project.name}")

            val upmPanel = UPMToolWindowPanel(project)
            val contentFactory = ContentFactory.SERVICE.getInstance()
            val content = contentFactory.createContent(upmPanel, "Dependencies", false)

            toolWindow.contentManager.addContent(content)

            UPMLogger.info("UPM tool window created successfully")
        } catch (e: Exception) {
            UPMLogger.error("Error creating UPM tool window", e)
        }
    }

    override fun isApplicable(project: Project): Boolean {
        // Check if this is a project with build files we support
        val baseDir = project.baseDir
        if (baseDir != null) {
            val hasPom = baseDir.findChild("pom.xml") != null
            val hasGradle = baseDir.findChild("build.gradle") != null ||
                           baseDir.findChild("build.gradle.kts") != null
            return hasPom || hasGradle
        }
        return false
    }
}
