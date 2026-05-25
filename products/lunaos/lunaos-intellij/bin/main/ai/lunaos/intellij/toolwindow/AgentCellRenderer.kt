package ai.lunaos.intellij.toolwindow

import com.intellij.ui.JBColor
import java.awt.Component
import java.awt.Dimension
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.RenderingHints
import javax.swing.BorderFactory
import javax.swing.JList
import javax.swing.JPanel
import javax.swing.ListCellRenderer

class AgentCellRenderer : ListCellRenderer<AgentsPanel.AgentItem> {

    override fun getListCellRendererComponent(
        list: JList<out AgentsPanel.AgentItem>,
        value: AgentsPanel.AgentItem,
        index: Int,
        isSelected: Boolean,
        cellHasFocus: Boolean
    ): Component {
        return AgentCell(value, isSelected)
    }
}

private class AgentCell(
    private val item: AgentsPanel.AgentItem,
    private val selected: Boolean
) : JPanel() {

    init {
        isOpaque = true
        preferredSize = Dimension(0, 52)
        border = BorderFactory.createEmptyBorder(6, 10, 6, 10)
        background = if (selected) JBColor.namedColor("List.selectionBackground", JBColor(0x2675BF, 0x2F65CA))
        else JBColor.namedColor("Panel.background", JBColor.PanelBackground)
    }

    override fun paintComponent(g: Graphics) {
        super.paintComponent(g)
        val g2 = g as Graphics2D
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)

        val textColor = if (selected) JBColor.namedColor("List.selectionForeground", JBColor.WHITE)
        else JBColor.namedColor("Label.foreground", JBColor.foreground())

        val mutedColor = if (selected) textColor
        else JBColor.namedColor("Label.disabledForeground", JBColor.GRAY)

        g2.color = textColor
        g2.font = font.deriveFont(13f)
        g2.drawString(item.name, 10, 20)

        g2.color = mutedColor
        g2.font = font.deriveFont(11f)
        g2.drawString(item.category, 10, 36)

        val descTrunc = if (item.description.length > 50) item.description.take(47) + "..." else item.description
        val catWidth = g2.fontMetrics.stringWidth(item.category)
        g2.drawString(descTrunc, catWidth + 24, 36)
    }
}
