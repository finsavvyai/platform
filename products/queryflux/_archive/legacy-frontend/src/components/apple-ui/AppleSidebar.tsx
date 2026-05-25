import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Database,
  Settings,
  Users,
  BarChart3,
  Zap,
  Shield,
} from "lucide-react";
import {
  createAppleStyle,
  APPLE_COLORS,
  APPLE_SPACING,
  APPLE_BORDER_RADIUS,
  APPLE_ANIMATIONS,
  APPLE_BLUR,
} from "../../design-system/AppleDesignSystem";

// Navigation item types
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  children?: NavItem[];
  onClick?: () => void;
  href?: string;
  isActive?: boolean;
}

interface AppleSidebarProps {
  items: NavItem[];
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  className?: string;
}

const AppleSidebar: React.FC<AppleSidebarProps> = ({
  items,
  collapsed = false,
  onCollapseChange,
  className = "",
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<string>("");

  // Toggle expanded state for parent items
  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Handle navigation
  const handleNavClick = (item: NavItem) => {
    setActiveItem(item.id);

    if (item.children) {
      toggleExpanded(item.id);
    }

    if (item.onClick) {
      item.onClick();
    }

    // Auto-collapse on mobile after selection
    if (window.innerWidth < 768 && onCollapseChange) {
      onCollapseChange(true);
    }
  };

  // Render navigation item
  const renderItem = (item: NavItem, depth = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = depth * 16 + (collapsed ? 8 : 16);

    const itemStyles = createAppleStyle({
      display: "flex",
      alignItems: "center",
      width: "100%",
      padding: `${APPLE_SPACING.sm} ${paddingLeft}px`,
      marginLeft: depth > 0 ? APPLE_SPACING.sm : 0,
      marginRight: APPLE_SPACING.sm,
      borderRadius: APPLE_BORDER_RADIUS.md,
      textDecoration: "none",
      color: isActive
        ? APPLE_COLORS.system.accent.blue
        : APPLE_COLORS.system.label.secondary,
      backgroundColor: isActive
        ? APPLE_COLORS.system.fill.tertiary
        : "transparent",
      border: "none",
      cursor: "pointer",
      transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      fontSize: "0.9375rem",
      fontWeight: isActive ? 600 : 500,
      position: "relative",
      overflow: "hidden",
      "&:hover": {
        backgroundColor: APPLE_COLORS.system.fill.secondary,
        color: APPLE_COLORS.system.label.primary,
      },
      "&:active": {
        backgroundColor: APPLE_COLORS.system.fill.tertiary,
        transform: "scale(0.98)",
      },
    });

    return (
      <div key={item.id} style={{ marginBottom: APPLE_SPACING.xs }}>
        <button
          onClick={() => handleNavClick(item)}
          style={itemStyles}
          className="sidebar-nav-item"
        >
          {/* Icon */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              marginRight: APPLE_SPACING.sm,
              flexShrink: 0,
              color: isActive
                ? APPLE_COLORS.system.accent.blue
                : "currentColor",
            }}
          >
            {item.icon}
          </span>

          {/* Label */}
          {!collapsed && (
            <span
              style={{
                flex: 1,
                textAlign: "left",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.label}
            </span>
          )}

          {/* Badge */}
          {!collapsed && item.badge && (
            <span
              style={{
                backgroundColor: APPLE_COLORS.system.accent.blue,
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: "10px",
                marginLeft: APPLE_SPACING.sm,
              }}
            >
              {item.badge}
            </span>
          )}

          {/* Chevron for expandable items */}
          {!collapsed && hasChildren && (
            <span
              style={{
                marginLeft: APPLE_SPACING.sm,
                transition: `transform ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              <ChevronRight size={16} />
            </span>
          )}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && !collapsed && (
          <div
            style={{
              marginTop: APPLE_SPACING.xs,
              animation: `slideDown ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.decelerate}`,
            }}
          >
            {item.children!.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Sidebar styles
  const sidebarStyles = createAppleStyle({
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    width: collapsed ? "64px" : "256px",
    backgroundColor: APPLE_COLORS.system.background.secondary,
    borderRight: `1px solid ${APPLE_COLORS.system.separator.primary}`,
    display: "flex",
    flexDirection: "column",
    transition: `width ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.standard}`,
    zIndex: 1000,
    overflow: "hidden",
    ...APPLE_BLUR.glass.light,
  });

  const headerStyles = createAppleStyle({
    padding: APPLE_SPACING.lg,
    borderBottom: `1px solid ${APPLE_COLORS.system.separator.tertiary}`,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
  });

  const logoStyles = createAppleStyle({
    display: "flex",
    alignItems: "center",
    gap: APPLE_SPACING.sm,
  });

  const logoIconStyles = {
    width: "32px",
    height: "32px",
    borderRadius: APPLE_BORDER_RADIUS.md,
    background: `linear-gradient(135deg, ${APPLE_COLORS.system.accent.blue}, ${APPLE_COLORS.system.accent.purple})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: "1.2rem",
    flexShrink: 0,
  };

  const logoTextStyles = createAppleStyle({
    ...createAppleStyle(APPLE_TYPOGRAPHY.titleMedium),
    color: APPLE_COLORS.system.label.primary,
    margin: 0,
    opacity: collapsed ? 0 : 1,
    transition: `opacity ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
  });

  const navStyles = {
    flex: 1,
    padding: APPLE_SPACING.md,
    overflowY: "auto",
    overflowX: "hidden",
  };

  const footerStyles = createAppleStyle({
    padding: APPLE_SPACING.md,
    borderTop: `1px solid ${APPLE_COLORS.system.separator.tertiary}`,
    display: "flex",
    justifyContent: collapsed ? "center" : "space-between",
    alignItems: "center",
  });

  const collapseButtonStyles = createAppleStyle({
    width: "32px",
    height: "32px",
    borderRadius: APPLE_BORDER_RADIUS.full,
    border: "none",
    backgroundColor: "transparent",
    color: APPLE_COLORS.system.label.secondary,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
    "&:hover": {
      backgroundColor: APPLE_COLORS.system.fill.secondary,
      color: APPLE_COLORS.system.label.primary,
    },
  });

  return (
    <>
      <aside className={`apple-sidebar ${className}`} style={sidebarStyles}>
        {/* Header */}
        <header style={headerStyles}>
          <div style={logoStyles}>
            <div style={logoIconStyles}>Q</div>
            {!collapsed && <h2 style={logoTextStyles}>QueryFlux</h2>}
          </div>
        </header>

        {/* Navigation */}
        <nav style={navStyles}>{items.map((item) => renderItem(item))}</nav>

        {/* Footer */}
        <footer style={footerStyles}>
          <button
            onClick={() => onCollapseChange?.(!collapsed)}
            style={collapseButtonStyles}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronDown
              size={18}
              style={{
                transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: `transform ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
              }}
            />
          </button>
        </footer>
      </aside>

      {/* Overlay for mobile */}
      {window.innerWidth < 768 && !collapsed && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 999,
            animation: `fadeIn ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.standard}`,
          }}
          onClick={() => onCollapseChange?.(true)}
        />
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Custom scrollbar */
        .apple-sidebar nav::-webkit-scrollbar {
          width: 6px;
        }

        .apple-sidebar nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .apple-sidebar nav::-webkit-scrollbar-thumb {
          background: ${APPLE_COLORS.system.separator.secondary};
          border-radius: 3px;
        }

        .apple-sidebar nav::-webkit-scrollbar-thumb:hover {
          background: ${APPLE_COLORS.system.separator.primary};
        }
      `}</style>
    </>
  );
};

export default AppleSidebar;
