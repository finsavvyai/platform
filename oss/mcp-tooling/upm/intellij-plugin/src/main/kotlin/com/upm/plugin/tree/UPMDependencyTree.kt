package com.upm.plugin.tree

import com.intellij.ide.util.treeView.AbstractTreeStructure
import com.intellij.ide.util.treeView.NodeDescriptor
import com.intellij.openapi.project.Project
import com.intellij.ui.treeStructure.Tree
import com.upm.plugin.api.models.Dependency
import com.upm.plugin.api.models.DependencyNode
import com.upm.plugin.api.models.Vulnerability
import com.upm.plugin.api.models.VulnerabilitySeverity
import com.upm.plugin.utils.UPMLogger
import java.util.*
import javax.swing.event.TreeExpansionEvent
import javax.swing.event.TreeWillExpandListener
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.ExpandVetoException
import javax.swing.tree.TreePath

/**
 * Tree structure for displaying UPM dependency analysis results.
 *
 * This component provides an interactive dependency tree visualization
 * with vulnerability indicators, policy violation summaries, and detailed
 * information for each dependency.
 */
class UPMDependencyTree(private val project: Project) : Tree() {

    private var dependencyTree: DependencyNode? = null
    private val nodeCache = mutableMapOf<String, DefaultMutableTreeNode>()

    init {
        model = DefaultTreeModel(DefaultMutableTreeNode("Dependencies"))
        isRootVisible = false
        showsRootHandles = true

        // Add expansion listener to lazy-load child dependencies
        addTreeWillExpandListener(object : TreeWillExpandListener {
            override fun treeWillExpand(event: TreeExpansionEvent?) {
                event?.let { handleNodeExpansion(it.path) }
            }

            override fun treeWillCollapse(event: TreeExpansionEvent?) {
                // No special handling for collapse
            }
        })
    }

    /**
     * Update the tree with new dependency data
     */
    fun updateDependencies(dependencyNode: DependencyNode) {
        try {
            UPMLogger.info("Updating UPM dependency tree with ${countDependencies(dependencyNode)} dependencies")

            this.dependencyTree = dependencyNode
            nodeCache.clear()

            val root = DefaultMutableTreeNode("Dependencies")
            buildTreeStructure(dependencyNode, root)

            model = DefaultTreeModel(root)

            UPMLogger.info("Dependency tree updated successfully")
        } catch (e: Exception) {
            UPMLogger.error("Error updating dependency tree", e)
        }
    }

    /**
     * Refresh the current tree view
     */
    fun refresh() {
        dependencyTree?.let { updateDependencies(it) }
    }

    /**
     * Get selected dependency information
     */
    fun getSelectedDependency(): Dependency? {
        val selectedNode = selectionPath?.lastPathComponent as? DefaultMutableTreeNode
        return selectedNode?.userObject as? Dependency
    }

    /**
     * Expand nodes with vulnerabilities
     */
    fun expandVulnerableDependencies() {
        dependencyTree?.let { rootNode ->
            expandVulnerableNodes(model.root as DefaultMutableTreeNode)
        }
    }

    /**
     * Filter tree to show only vulnerable dependencies
     */
    fun showOnlyVulnerable() {
        dependencyTree?.let { rootNode ->
            val filteredRoot = DefaultMutableTreeNode("Vulnerable Dependencies")
            filterVulnerableDependencies(rootNode, filteredRoot)
            model = DefaultTreeModel(filteredRoot)
        }
    }

    /**
     * Show all dependencies
     */
    fun showAllDependencies() {
        refresh()
    }

    private fun buildTreeStructure(dependencyNode: DependencyNode, parentTreeNode: DefaultMutableTreeNode) {
        val dependency = dependencyNode.dependency
        val dependencyNodeDescriptor = DependencyNodeDescriptor(dependency, project)
        val treeNode = DefaultMutableTreeNode(dependencyNodeDescriptor)

        // Cache the node for quick lookup
        nodeCache[dependency.id] = treeNode

        // Add vulnerability indicators to the node
        if (dependency.vulnerabilities.isNotEmpty()) {
            val maxSeverity = dependency.vulnerabilities.maxOfOrNull { it.severity }
            val icon = getSeverityIcon(maxSeverity)
            treeNode.userObject = DependencyWithVulnerabilitiesNode(dependency, maxSeverity, icon)
        }

        // Add child dependencies (limit to first level for performance)
        if (dependencyNode.children.isNotEmpty() && dependencyNode.depth < 2) {
            dependencyNode.children.forEach { childNode ->
                buildTreeStructure(childNode, treeNode)
            }
        } else if (dependencyNode.children.isNotEmpty()) {
            // Add a "load more" node for deeper levels
            val loadMoreNode = DefaultMutableTreeNode(LoadMoreNodeDescriptor(dependency))
            treeNode.add(loadMoreNode)
        }

        parentTreeNode.add(treeNode)
    }

    private fun handleNodeExpansion(path: TreePath) {
        val node = path.lastPathComponent as? DefaultMutableTreeNode
        val userObject = node?.userObject

        if (userObject is LoadMoreNodeDescriptor) {
            loadMoreDependencies(userObject.dependency, node)
        }
    }

    private fun loadMoreDependencies(dependency: Dependency, parentNode: DefaultMutableTreeNode) {
        try {
            // Get transitive dependencies from service
            val transitiveDeps = getTransitiveDependencies(dependency)

            parentNode.removeAllChildren()
            transitiveDeps.forEach { transitiveDep ->
                val transitiveNode = DependencyNode(transitiveDep, emptyList(), false, 1)
                buildTreeStructure(transitiveNode, parentNode)
            }

            model.nodesChanged(parentNode, intArrayOf(parentNode.childCount - 1))
        } catch (e: Exception) {
            UPMLogger.error("Error loading transitive dependencies for ${dependency.artifactId}", e)
        }
    }

    private fun getTransitiveDependencies(dependency: Dependency): List<Dependency> {
        // This would call the UPM service to get transitive dependencies
        // For now, return empty list - this would be implemented with actual API calls
        return emptyList()
    }

    private fun expandVulnerableNodes(node: DefaultMutableTreeNode) {
        val userObject = node.userObject

        if (userObject is DependencyWithVulnerabilitiesNode) {
            expandPath(TreePath(model.getPathToRoot(node)))
        }

        for (i in 0 until node.childCount) {
            expandVulnerableNodes(node.getChildAt(i) as DefaultMutableTreeNode)
        }
    }

    private fun filterVulnerableDependencies(sourceNode: DependencyNode, targetNode: DefaultMutableTreeNode) {
        if (sourceNode.dependency.vulnerabilities.isNotEmpty()) {
            buildTreeStructure(sourceNode, targetNode)
        }

        sourceNode.children.forEach { child ->
            filterVulnerableDependencies(child, targetNode)
        }
    }

    private fun countDependencies(node: DependencyNode): Int {
        var count = 1
        node.children.forEach { child ->
            count += countDependencies(child)
        }
        return count
    }

    private fun getSeverityIcon(severity: VulnerabilitySeverity?): String {
        return when (severity) {
            VulnerabilitySeverity.CRITICAL -> "🔴"
            VulnerabilitySeverity.HIGH -> "🟠"
            VulnerabilitySeverity.MEDIUM -> "🟡"
            VulnerabilitySeverity.LOW -> "🔵"
            else -> "⚪"
        }
    }
}

/**
 * Node descriptor for dependency nodes
 */
class DependencyNodeDescriptor(
    private val dependency: Dependency,
    private val project: Project
) : NodeDescriptor(project) {

    override fun update(): Boolean {
        val vulnerabilities = dependency.vulnerabilities.size
        val outdated = isOutdated(dependency)

        val displayName = buildString {
            append(dependency.artifactId)
            append(" (")
            append(dependency.version)

            if (outdated) {
                append(" 📦")
            }

            if (vulnerabilities > 0) {
                append(" ⚠️")
                append(vulnerabilities)
            }

            append(")")
        }

        myName = displayName
        myToolTip = generateTooltip(dependency)

        return true
    }

    private fun isOutdated(dependency: Dependency): Boolean {
        // This would check against latest version
        // For now, return false
        return false
    }

    private fun generateTooltip(dependency: Dependency): String {
        return buildString {
            append("<html><body>")
            append("<b>${dependency.groupId}:${dependency.artifactId}:${dependency.version}</b><br/>")
            append("Type: ${dependency.type}<br/>")
            append("Scope: ${dependency.scope}<br/>")

            if (dependency.vulnerabilities.isNotEmpty()) {
                append("<br/><b>Vulnerabilities:</b><br/>")
                dependency.vulnerabilities.take(5).forEach { vuln ->
                    append("• ${vuln.severity}: ${vuln.title}<br/>")
                }
                if (dependency.vulnerabilities.size > 5) {
                    append("• ... and ${dependency.vulnerabilities.size - 5} more<br/>")
                }
            }

            if (dependency.license != null) {
                append("<br/><b>License:</b> ${dependency.license}<br/>")
            }

            append("</body></html>")
        }
    }
}

/**
 * Special node for dependencies with vulnerabilities
 */
class DependencyWithVulnerabilitiesNode(
    val dependency: Dependency,
    val severity: VulnerabilitySeverity?,
    val icon: String
) {
    override fun toString(): String {
        return "${icon} ${dependency.artifactId} (${dependency.version})"
    }
}

/**
 * Special node for lazy-loading more dependencies
 */
class LoadMoreNodeDescriptor(val dependency: Dependency) {
    override fun toString(): String {
        return "Load more dependencies..."
    }
}
