import React, { useState, useRef, useEffect } from "react";
import {
  createAppleStyle,
  APPLE_COLORS,
  APPLE_SPACING,
  APPLE_BORDER_RADIUS,
  APPLE_ANIMATIONS,
} from "../../design-system/AppleDesignSystem";

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
  content: React.ReactNode;
}

interface AppleTabsProps {
  items: TabItem[];
  defaultActiveId?: string;
  variant?: "default" | "underline" | "pills";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  className?: string;
  onChange?: (activeId: string) => void;
}

const AppleTabs: React.FC<AppleTabsProps> = ({
  items,
  defaultActiveId,
  variant = "default",
  size = "medium",
  fullWidth = false,
  className = "",
  onChange,
}) => {
  const [activeId, setActiveId] = useState(defaultActiveId || items[0]?.id);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveId(tabId);
    onChange?.(tabId);
  };

  // Update indicator position
  useEffect(() => {
    if (variant === "underline" && activeTabRef.current && tabsRef.current) {
      const tab = activeTabRef.current;
      const tabsContainer = tabsRef.current;
      const { offsetLeft, offsetWidth } = tab;
      const { offsetLeft: containerOffsetLeft } = tabsContainer;

      setIndicatorStyle({
        left: offsetLeft - containerOffsetLeft,
        width: offsetWidth,
      });
    }
  }, [activeId, variant]);

  // Size styles
  const sizeStyles = {
    small: {
      padding: `${APPLE_SPACING.xs} ${APPLE_SPACING.md}`,
      fontSize: "0.875rem",
      minHeight: "32px",
    },
    medium: {
      padding: `${APPLE_SPACING.sm} ${APPLE_SPACING.lg}`,
      fontSize: "1rem",
      minHeight: "40px",
    },
    large: {
      padding: `${APPLE_SPACING.md} ${APPLE_SPACING.xl}`,
      fontSize: "1.125rem",
      minHeight: "48px",
    },
  };

  // Variant styles
  const variantStyles = {
    // Default - Segmented control style
    default: {
      container: {
        backgroundColor: APPLE_COLORS.system.background.secondary,
        borderRadius: APPLE_BORDER_RADIUS.full,
        padding: "4px",
        display: "inline-flex",
        gap: "2px",
      },
      tab: {
        borderRadius: APPLE_BORDER_RADIUS.full,
        border: "none",
        transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
        "&:hover:not(:disabled)": {
          backgroundColor: APPLE_COLORS.system.fill.tertiary,
        },
      },
      active: {
        backgroundColor: APPLE_COLORS.system.background.primary,
        boxShadow: APPLE_SHADOWS.sm,
        color: APPLE_COLORS.system.label.primary,
      },
    },

    // Underline - Traditional tabs with underline indicator
    underline: {
      container: {
        borderBottom: `1px solid ${APPLE_COLORS.system.separator.tertiary}`,
        position: "relative",
        display: "flex",
        gap: APPLE_SPACING.xl,
      },
      tab: {
        border: "none",
        backgroundColor: "transparent",
        borderBottom: "2px solid transparent",
        transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
        "&:hover:not(:disabled)": {
          color: APPLE_COLORS.system.label.primary,
          backgroundColor: APPLE_COLORS.system.fill.tertiary,
        },
      },
      active: {
        color: APPLE_COLORS.system.accent.blue,
        borderBottomColor: APPLE_COLORS.system.accent.blue,
      },
    },

    // Pills - Pill-shaped tabs
    pills: {
      container: {
        display: "inline-flex",
        gap: APPLE_SPACING.sm,
        backgroundColor: APPLE_COLORS.system.background.secondary,
        padding: "4px",
        borderRadius: APPLE_BORDER_RADIUS.lg,
      },
      tab: {
        borderRadius: APPLE_BORDER_RADIUS.md,
        border: "none",
        transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
        "&:hover:not(:disabled)": {
          backgroundColor: APPLE_COLORS.system.fill.tertiary,
        },
      },
      active: {
        backgroundColor: APPLE_COLORS.system.accent.blue,
        color: "#ffffff",
      },
    },
  };

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div className={`apple-tabs ${className}`}>
      {/* Tab Headers */}
      <div
        ref={tabsRef}
        className="apple-tabs-header"
        style={{
          display: fullWidth ? "flex" : "inline-flex",
          width: fullWidth ? "100%" : "auto",
          ...variantStyles[variant].container,
          ...(fullWidth &&
            variant === "underline" && {
              width: "100%",
              justifyContent: "flex-start",
            }),
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isDisabled = item.disabled;

          return (
            <button
              key={item.id}
              ref={isActive ? activeTabRef : undefined}
              onClick={() => !isDisabled && handleTabChange(item.id)}
              disabled={isDisabled}
              className="apple-tab"
              style={{
                ...sizeStyles[size],
                ...variantStyles[variant].tab,
                ...(isActive && variantStyles[variant].active),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: APPLE_SPACING.xs,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
                fontWeight: isActive ? 600 : 500,
                color: isDisabled
                  ? APPLE_COLORS.system.label.quaternary
                  : isActive
                    ? undefined
                    : APPLE_COLORS.system.label.secondary,
                cursor: isDisabled ? "not-allowed" : "pointer",
                position: "relative",
                outline: "none",
                ...(fullWidth && variant !== "default" && { flex: 1 }),
              }}
            >
              {/* Icon */}
              {item.icon && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: "1.1em",
                  }}
                >
                  {item.icon}
                </span>
              )}

              {/* Label */}
              <span>{item.label}</span>

              {/* Badge */}
              {item.badge && (
                <span
                  style={{
                    backgroundColor:
                      variant === "pills" && isActive
                        ? "rgba(255, 255, 255, 0.2)"
                        : APPLE_COLORS.system.accent.blue,
                    color:
                      variant === "pills" && isActive
                        ? "#ffffff"
                        : APPLE_COLORS.system.accent.blue ===
                            APPLE_COLORS.system.accent.blue
                          ? "#ffffff"
                          : undefined,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "8px",
                    marginLeft: APPLE_SPACING.xs,
                  }}
                >
                  {item.badge}
                </span>
              )}

              {/* Focus ring */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  boxShadow: isActive
                    ? `0 0 0 2px ${APPLE_COLORS.system.accent.blue}40`
                    : "none",
                  pointerEvents: "none",
                }}
              />
            </button>
          );
        })}

        {/* Underline indicator */}
        {variant === "underline" && (
          <div
            className="tab-indicator"
            style={{
              position: "absolute",
              bottom: "-1px",
              height: "2px",
              backgroundColor: APPLE_COLORS.system.accent.blue,
              transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.spring}`,
              ...indicatorStyle,
            }}
          />
        )}
      </div>

      {/* Tab Content */}
      <div
        className="apple-tabs-content"
        style={{
          marginTop: APPLE_SPACING.lg,
          animation: `fadeIn ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.decelerate}`,
        }}
      >
        {activeItem?.content}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AppleTabs;
