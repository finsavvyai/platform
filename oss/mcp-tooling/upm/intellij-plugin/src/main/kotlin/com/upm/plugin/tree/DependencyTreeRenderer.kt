package com.upm.plugin.tree

import com.intellij.ui.ColoredTreeCellRenderer
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.JBColor
import com.upm.plugin.api.models.Dependency
import com.upm.plugin.api.models.Vulnerability
import java.awt.Component
import javax.swing.*

/**
 * Custom tree cell renderer for dependency tree.
 *
 * This renderer provides visual indicators for vulnerabilities,
 * outdated versions, and policy violations in the dependency tree.
 */
class DependencyTreeRenderer : ColoredTreeCellRenderer() {

    override fun customizeCellRenderer(
        tree: JTree,
        value: Any,
        selected: Boolean,
        expanded: Boolean,
        leaf: Boolean,
        row: Int,
        hasFocus: Boolean
    ) {
        when (value) {
            is javax.swing.tree.DefaultMutableTreeNode -> {
                val userObject = value.userObject
                when (userObject) {
                    is Dependency -> renderDependency(userObject, selected)
                    is Vulnerability -> renderVulnerability(userObject, selected)
                    else -> renderDefault(userObject.toString(), selected)
                }
            }
            else -> {
                renderDefault(value.toString(), selected)
            }
        }
    }

    private fun renderDependency(dependency: Dependency, selected: Boolean) {
        // Build the main text for the dependency
        val dependencyText = "${dependency.artifactId}:${dependency.version}"

        // Determine text attributes based on vulnerability status
        val attributes = when {
            dependency.vulnerabilities.any { it.severity.name == "CRITICAL" } -> {
                SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, JBColor.RED)
            }
            dependency.vulnerabilities.any { it.severity.name == "HIGH" } -> {
                SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, JBColor(255, 140, 0)) // Orange
            }
            dependency.vulnerabilities.isNotEmpty() -> {
                SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, JBColor(255, 165, 0)) // Dark Orange
            }
            else -> {
                SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, null)
            }
        }

        // Append the main dependency text
        append(dependencyText, attributes)

        // Append vulnerability count if present
        if (dependency.vulnerabilities.isNotEmpty()) {
            val vulnText = " (${dependency.vulnerabilities.size} vulnerabilities)"
            append(vulnText, SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, JBColor.GRAY))
        }

        // Append group ID on next line
        append(" (${dependency.groupId})", SimpleTextAttributes(SimpleTextAttributes.STYLE_SMALLER, JBColor.GRAY))

        // Set icon based on vulnerability status
        icon = getDependencyIcon(dependency)

        // Set tooltip
        toolTipText = getDependencyTooltip(dependency)
    }

    private fun renderVulnerability(vulnerability: Vulnerability, selected: Boolean) {
        // Render vulnerability with severity-appropriate styling
        val severityColor = when (vulnerability.severity.name) {
            "CRITICAL" -> JBColor.RED
            "HIGH" -> JBColor(255, 140, 0) // Orange
            "MEDIUM" -> JBColor(255, 215, 0) // Gold
            "LOW" -> JBColor(144, 238, 144) // Light green
            else -> JBColor.GRAY
        }

        val attributes = SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, severityColor)

        append("🔒 ", attributes) // Security icon
        append(vulnerability.title, SimpleTextAttributes(SimpleTextAttributes.STYLE_BOLD, severityColor))

        if (vulnerability.cveId != null) {
            append(" (${vulnerability.cveId})", SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, JBColor.GRAY))
        }

        // Set icon based on severity
        icon = getVulnerabilityIcon(vulnerability)

        // Set tooltip with detailed information
        toolTipText = getVulnerabilityTooltip(vulnerability)
    }

    private fun renderDefault(text: String, selected: Boolean) {
        append(text, SimpleTextAttributes(SimpleTextAttributes.STYLE_PLAIN, null))
        icon = null
        toolTipText = null
    }

    private fun getDependencyIcon(dependency: Dependency): Icon? {
        // Return different icons based on dependency status
        return when {
            dependency.vulnerabilities.any { it.severity.name == "CRITICAL" } -> {
                // Critical vulnerability icon
                UIManager.getIcon("OptionPane.errorIcon")
            }
            dependency.vulnerabilities.any { it.severity.name == "HIGH" } -> {
                // High vulnerability icon
                UIManager.getIcon("OptionPane.warningIcon")
            }
            dependency.vulnerabilities.isNotEmpty() -> {
                // General vulnerability icon
                UIManager.getIcon("OptionPane.informationIcon")
            }
            else -> {
                // Normal dependency icon
                getEcosystemIcon(dependency.ecosystem)
            }
        }
    }

    private fun getVulnerabilityIcon(vulnerability: Vulnerability): Icon? {
        return when (vulnerability.severity.name) {
            "CRITICAL" -> UIManager.getIcon("OptionPane.errorIcon")
            "HIGH" -> UIManager.getIcon("OptionPane.warningIcon")
            "MEDIUM" -> UIManager.getIcon("OptionPane.informationIcon")
            "LOW" -> UIManager.getIcon("OptionPane.informationIcon")
            else -> UIManager.getIcon("OptionPane.questionIcon")
        }
    }

    private fun getEcosystemIcon(ecosystem: String): Icon? {
        // Return ecosystem-specific icons (would need custom icons in practice)
        return when (ecosystem.lowercase()) {
            "maven" -> UIManager.getIcon("FileIcons.jar")
            "gradle" -> UIManager.getIcon("FileIcons.gradle")
            "npm" -> UIManager.getIcon("FileIcons.packageJson")
            "pip" -> UIManager.getIcon("FileIcons.python")
            "cargo" -> UIManager.getIcon("FileIcons.rust")
            else -> UIManager.getIcon("FileIcons.any_type")
        }
    }

    private fun getDependencyTooltip(dependency: Dependency): String {
        return buildString {
            append("<html><body style='padding: 5px;'>")
            append("<b>${dependency.groupId}:${dependency.artifactId}:${dependency.version}</b><br/>")
            append("Ecosystem: ${dependency.ecosystem}<br/>")
            append("Scope: ${dependency.scope}<br/>")
            append("Type: ${dependency.type}<br/>")

            if (dependency.license != null) {
                append("License: ${dependency.license}<br/>")
            }

            if (dependency.downloadCount != null) {
                append("Downloads: ${String.format("%,d", dependency.downloadCount)}<br/>")
            }

            // Vulnerability information
            val vulnCount = dependency.vulnerabilities.size
            if (vulnCount > 0) {
                append("<br/><font color='red'><b>Vulnerabilities: $vulnCount</b></font><br/>")

                // Show top 3 vulnerabilities
                dependency.vulnerabilities.take(3).forEach { vuln ->
                    append("• ${vuln.severity.name}: ${vuln.title}<br/>")
                }

                if (vulnCount > 3) {
                    append("• ... and ${vulnCount - 3} more<br/>")
                }
            }

            append("</body></html>")
        }
    }

    private fun getVulnerabilityTooltip(vulnerability: Vulnerability): String {
        return buildString {
            append("<html><body style='padding: 5px;'>")
            append("<b>${vulnerability.title}</b><br/>")
            append("Severity: ${vulnerability.severity.name}<br/>")

            if (vulnerability.score != null) {
                append("CVSS Score: ${vulnerability.score}<br/>")
            }

            if (vulnerability.cveId != null) {
                append("CVE: ${vulnerability.cveId}<br/>")
            }

            if (vulnerability.publishedDate != null) {
                append("Published: ${java.util.Date(vulnerability.publishedDate)}<br/>")
            }

            append("<br/>${vulnerability.description}<br/>")

            if (vulnerability.remediation != null) {
                append("<br/><b>Remediation:</b><br/>")
                append(vulnerability.remediation.description)

                if (vulnerability.remediation.steps.isNotEmpty()) {
                    append("<ul>")
                    vulnerability.remediation.steps.take(3).forEach { step ->
                        append("<li>$step</li>")
                    }
                    append("</ul>")
                }
            }

            if (vulnerability.references.isNotEmpty()) {
                append("<br/><b>References:</b><br/>")
                vulnerability.references.take(2).forEach { ref ->
                    append("• <a href='$ref'>${ref}</a><br/>")
                }
            }

            append("</body></html>")
        }
    }
}
