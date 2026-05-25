package com.upm.plugin.tree

import com.intellij.openapi.project.Project
import com.intellij.ui.TreeUIHelper
import com.intellij.ui.treeStructure.Tree
import com.upm.plugin.api.UPMService
import com.upm.plugin.api.models.DependencyAnalysisResult
import com.upm.plugin.api.models.Dependency
import com.upm.plugin.api.models.Vulnerability
import com.upm.plugin.utils.UPMLogger
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import javax.swing.*
import javax.swing.tree.*

/**
 * Panel that displays the dependency tree structure.
 *
 * This panel shows a hierarchical view of all project dependencies
 * with vulnerability indicators and interactive exploration capabilities.
 */
class DependencyTreePanel(private val project: Project) : JPanel() {

    private val upmService: UPMService = UPMService.getInstance(project)
    private var currentAnalysis: DependencyAnalysisResult? = null

    // UI Components
    private lateinit var tree: Tree
    private lateinit var treeModel: DefaultTreeModel
    private lateinit var root: DefaultMutableTreeNode

    // Listeners
    private var dependencySelectionListeners: MutableList<(Dependency) -> Unit> = mutableListOf()

    init {
        initializeUI()
    }

    private fun initializeUI() {
        layout = BorderLayout()

        // Create tree
        root = DefaultMutableTreeNode("Dependencies")
        treeModel = DefaultTreeModel(root)
        tree = Tree(treeModel)

        // Configure tree
        configureTree()

        // Add tree with scroll pane
        val scrollPane = JScrollPane(tree)
        add(scrollPane, BorderLayout.CENTER)

        // Add filter panel
        add(createFilterPanel(), BorderLayout.NORTH)
    }

    private fun configureTree() {
        // Enable tool tips
        tree.toolTipText = ""

        // Set custom renderer
        tree.cellRenderer = DependencyTreeRenderer()

        // Set custom UI helper for better appearance
        TreeUIHelper.getInstance().install(tree)

        // Add mouse listener for double-click actions
        tree.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    handleDoubleClick(e)
                }
            }
        })

        // Add selection listener
        tree.selectionModel.addTreeSelectionListener { e ->
            handleTreeSelection(e)
        }

        // Expand all nodes by default (limit depth for performance)
        tree.addTreeExpansionListener(object : TreeExpansionListener {
            override fun treeExpanded(e: TreeExpansionEvent) {
                // Lazy loading could be implemented here
            }

            override fun treeCollapsed(e: TreeExpansionEvent) {
                // Handle collapse if needed
            }
        })
    }

    private fun createFilterPanel(): JPanel {
        val filterPanel = JPanel()
        filterPanel.layout = BoxLayout(filterPanel, BoxLayout.X_AXIS)
        filterPanel.border = javax.swing.BorderFactory.createEmptyBorder(5, 5, 5, 5)

        // Search field
        val searchField = JTextField(20)
        searchField.setToolTipText("Search dependencies...")

        val searchButton = JButton("Search")
        searchButton.addActionListener {
            filterTree(searchField.text)
        }

        // Clear button
        val clearButton = JButton("Clear")
        clearButton.addActionListener {
            searchField.text = ""
            rebuildTree()
        }

        // Vulnerability filter
        val vulnerabilityFilter = JComboBox<String>().apply {
            addItem("All Dependencies")
            addItem("Vulnerable Only")
            addItem("Critical Only")
            addItem("High & Critical")
            addItem("Outdated Only")
        }
        vulnerabilityFilter.addActionListener {
            filterByVulnerability(vulnerabilityFilter.selectedItem as String)
        }

        filterPanel.add(JLabel("Search:"))
        filterPanel.add(searchField)
        filterPanel.add(searchButton)
        filterPanel.add(clearButton)
        filterPanel.add(Box.createHorizontalStrut(20))
        filterPanel.add(JLabel("Filter:"))
        filterPanel.add(vulnerabilityFilter)

        return filterPanel
    }

    /**
     * Update the tree with new analysis results
     */
    fun updateAnalysis(analysis: DependencyAnalysisResult) {
        currentAnalysis = analysis
        rebuildTree()
    }

    /**
     * Rebuild the entire tree structure
     */
    private fun rebuildTree() {
        // Clear existing nodes
        root.removeAllChildren()

        currentAnalysis?.let { analysis ->
            // Group dependencies by ecosystem or scope
            val groupedDependencies = groupDependencies(analysis.dependencies)

            groupedDependencies.forEach { (groupName, deps) ->
                val groupNode = DefaultMutableTreeNode(groupName)

                deps.forEach { dependency ->
                    val dependencyNode = createDependencyNode(dependency)
                    groupNode.add(dependencyNode)
                }

                root.add(groupNode)
            }

            // Reload tree model
            treeModel.reload()

            // Expand first level
            expandToDepth(1)
        }
    }

    /**
     * Group dependencies by scope or ecosystem
     */
    private fun groupDependencies(dependencies: List<Dependency>): Map<String, List<Dependency>> {
        return dependencies.groupBy { dep ->
            when (dep.scope) {
                "test" -> "Test Dependencies"
                "provided" -> "Provided Dependencies"
                "runtime" -> "Runtime Dependencies"
                "compile" -> "Compile Dependencies"
                else -> "Other Dependencies"
            }
        }
    }

    /**
     * Create a tree node for a dependency
     */
    private fun createDependencyNode(dependency: Dependency): DefaultMutableTreeNode {
        val node = DefaultMutableTreeNode(dependency)

        // Add vulnerability nodes as children
        dependency.vulnerabilities.forEach { vulnerability ->
            val vulnNode = DefaultMutableTreeNode(vulnerability)
            node.add(vulnNode)
        }

        return node
    }

    /**
     * Filter tree based on search text
     */
    private fun filterTree(searchText: String) {
        if (searchText.isBlank()) {
            rebuildTree()
            return
        }

        root.removeAllChildren()

        currentAnalysis?.let { analysis ->
            val filteredDeps = analysis.dependencies.filter { dep ->
                dep.artifactId.contains(searchText, ignoreCase = true) ||
                dep.groupId.contains(searchText, ignoreCase = true) ||
                (dep.license?.contains(searchText, ignoreCase = true) == true)
            }

            val groupedDependencies = groupDependencies(filteredDeps)

            groupedDependencies.forEach { (groupName, deps) ->
                if (deps.isNotEmpty()) {
                    val groupNode = DefaultMutableTreeNode("$groupName (${deps.size})")

                    deps.forEach { dependency ->
                        val dependencyNode = createDependencyNode(dependency)
                        groupNode.add(dependencyNode)
                    }

                    root.add(groupNode)
                }
            }

            treeModel.reload()
            expandToDepth(2)
        }
    }

    /**
     * Filter by vulnerability severity
     */
    private fun filterByVulnerability(filterType: String) {
        root.removeAllChildren()

        currentAnalysis?.let { analysis ->
            val filteredDeps = when (filterType) {
                "Vulnerable Only" -> analysis.dependencies.filter { it.vulnerabilities.isNotEmpty() }
                "Critical Only" -> analysis.dependencies.filter {
                    it.vulnerabilities.any { v -> v.severity.name == "CRITICAL" }
                }
                "High & Critical" -> analysis.dependencies.filter {
                    it.vulnerabilities.any { v -> v.severity.name in listOf("HIGH", "CRITICAL") }
                }
                "Outdated Only" -> analysis.dependencies.filter {
                    analysis.outdatedDependencies.any { it.dependency.id == it.id }
                }
                else -> analysis.dependencies
            }

            val groupedDependencies = groupDependencies(filteredDeps)

            groupedDependencies.forEach { (groupName, deps) ->
                if (deps.isNotEmpty()) {
                    val groupNode = DefaultMutableTreeNode("$groupName (${deps.size})")

                    deps.forEach { dependency ->
                        val dependencyNode = createDependencyNode(dependency)
                        groupNode.add(dependencyNode)
                    }

                    root.add(groupNode)
                }
            }

            treeModel.reload()
            expandToDepth(1)
        }
    }

    /**
     * Expand tree nodes to a specific depth
     */
    private fun expandToDepth(depth: Int) {
        tree.expandPath(TreePath(root))

        if (depth > 0) {
            var currentLevel = 0
            val queue = mutableListOf<TreePath>()

            for (i in 0 until root.childCount) {
                val child = root.getChildAt(i) as TreeNode
                queue.add(TreePath(arrayOf(root, child)))
            }

            while (queue.isNotEmpty() && currentLevel < depth) {
                currentLevel++
                val nextQueue = mutableListOf<TreePath>()

                queue.forEach { path ->
                    tree.expandPath(path)
                    val node = path.lastPathComponent as TreeNode

                    for (i in 0 until node.childCount) {
                        val child = node.getChildAt(i) as TreeNode
                        nextQueue.add(path.pathByAddingChild(child))
                    }
                }

                queue.clear()
                queue.addAll(nextQueue)
            }
        }
    }

    /**
     * Handle double-click on tree nodes
     */
    private fun handleDoubleClick(e: MouseEvent) {
        val path = tree.getPathForLocation(e.x, e.y)
        path?.let {
            val node = it.lastPathComponent as DefaultMutableTreeNode
            val userObject = node.userObject

            when (userObject) {
                is Dependency -> {
                    notifyDependencySelected(userObject)
                    showDependencyDetails(userObject)
                }
                is Vulnerability -> {
                    showVulnerabilityDetails(userObject)
                }
            }
        }
    }

    /**
     * Handle tree selection changes
     */
    private fun handleTreeSelection(e: javax.swing.event.TreeSelectionEvent) {
        val path = e.newLeadSelectionPath
        path?.let {
            val node = it.lastPathComponent as DefaultMutableTreeNode
            val userObject = node.userObject

            when (userObject) {
                is Dependency -> {
                    notifyDependencySelected(userObject)
                }
            }
        }
    }

    /**
     * Show dependency details in a dialog or panel
     */
    private fun showDependencyDetails(dependency: Dependency) {
        // This could open a detailed view or dialog
        UPMLogger.info("Showing details for dependency: ${dependency.groupId}:${dependency.artifactId}")

        // For now, just log the dependency info
        val vulnCount = dependency.vulnerabilities.size
        val severity = dependency.vulnerabilities.maxOfOrNull { it.severity.name } ?: "NONE"

        UPMLogger.info("Dependency: ${dependency.groupId}:${dependency.artifactId}:${dependency.version}")
        UPMLogger.info("Vulnerabilities: $vulnCount, Highest Severity: $severity")
    }

    /**
     * Show vulnerability details
     */
    private fun showVulnerabilityDetails(vulnerability: Vulnerability) {
        UPMLogger.info("Vulnerability: ${vulnerability.title} (${vulnerability.severity})")
        UPMLogger.info("Description: ${vulnerability.description}")
    }

    /**
     * Add dependency selection listener
     */
    fun addDependencySelectionListener(listener: (Dependency) -> Unit) {
        dependencySelectionListeners.add(listener)
    }

    /**
     * Notify all dependency selection listeners
     */
    private fun notifyDependencySelected(dependency: Dependency) {
        dependencySelectionListeners.forEach { listener ->
            try {
                listener(dependency)
            } catch (e: Exception) {
                UPMLogger.error("Error notifying dependency selection listener", e)
            }
        }
    }

    /**
     * Get selected dependency
     */
    fun getSelectedDependency(): Dependency? {
        val path = tree.selectionPath
        path?.let {
            val node = it.lastPathComponent as DefaultMutableTreeNode
            val userObject = node.userObject
            if (userObject is Dependency) {
                return userObject
            }
        }
        return null
    }

    /**
     * Refresh the tree
     */
    fun refresh() {
        rebuildTree()
    }
}
