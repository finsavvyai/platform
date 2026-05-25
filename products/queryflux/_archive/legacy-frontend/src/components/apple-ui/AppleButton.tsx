import React, {
  forwardRef,
  ButtonHTMLAttributes,
  useEffect,
  useState,
} from "react";
import {
  createStyle,
  createTransition,
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
} from "../../design-system/tokens";
import { useTheme } from "../../contexts/ThemeContext";

// Button variants following Apple's HIG
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "plain";

// Button sizes
export type ButtonSize = "small" | "medium" | "large";

// Button emphasis levels for fine-grained control
export type ButtonEmphasis = "high" | "medium" | "low";

export interface AppleButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  emphasis?: ButtonEmphasis;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "leading" | "trailing";
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * AppleButton - A button component that follows Apple's Human Interface Guidelines
 *
 * Features:
 * - Multiple variants (primary, secondary, tertiary, destructive, plain)
 * - Three sizes (small, medium, large)
 * - Loading states with spinner
 * - Icon support (leading or trailing)
 * - Full width option
 * - Keyboard navigation support
 * - Screen reader support
 * - Focus management
 * - Hover and active states
 * - Disabled states
 */
const AppleButton = forwardRef<HTMLButtonElement, AppleButtonProps>(
  (
    {
      variant = "primary",
      size = "medium",
      emphasis = "medium",
      fullWidth = false,
      loading = false,
      icon,
      iconPosition = "leading",
      disabled = false,
      className = "",
      children,
      onMouseDown,
      onMouseUp,
      onKeyDown,
      onKeyUp,
      ...props
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [isPressed, setIsPressed] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const isDark = theme?.includes("dark") || false;

    // Determine colors based on theme and variant
    const getColors = () => {
      const colors = {
        background: "",
        color: "",
        borderColor: "",
        shadow: "",
      };

      switch (variant) {
        case "primary":
          colors.background = disabled
            ? isDark
              ? COLORS.system.darkFill.quaternary
              : COLORS.system.fill.quaternary
            : COLORS.system.accent.blue;
          colors.color = disabled
            ? isDark
              ? COLORS.system.darkLabel.tertiary
              : COLORS.system.label.tertiary
            : "#ffffff";
          colors.shadow = disabled ? "none" : SHADOWS.colored.blue;
          break;

        case "secondary":
          colors.background = disabled
            ? isDark
              ? COLORS.system.darkFill.quaternary
              : COLORS.system.fill.quaternary
            : isDark
              ? COLORS.system.darkFill.primary
              : COLORS.system.fill.primary;
          colors.color = disabled
            ? isDark
              ? COLORS.system.darkLabel.tertiary
              : COLORS.system.label.tertiary
            : isDark
              ? COLORS.system.darkLabel.primary
              : COLORS.system.label.primary;
          colors.shadow = "none";
          break;

        case "tertiary":
          colors.background = "transparent";
          colors.color = disabled
            ? isDark
              ? COLORS.system.darkLabel.tertiary
              : COLORS.system.label.tertiary
            : COLORS.system.accent.blue;
          colors.borderColor = disabled
            ? isDark
              ? COLORS.system.darkSeparator.tertiary
              : COLORS.system.separator.tertiary
            : isDark
              ? COLORS.system.darkSeparator.primary
              : COLORS.system.separator.primary;
          colors.shadow = "none";
          break;

        case "destructive":
          colors.background = disabled
            ? isDark
              ? COLORS.system.darkFill.quaternary
              : COLORS.system.fill.quaternary
            : COLORS.system.accent.red;
          colors.color = disabled
            ? isDark
              ? COLORS.system.darkLabel.tertiary
              : COLORS.system.label.tertiary
            : "#ffffff";
          colors.shadow = disabled ? "none" : SHADOWS.colored.error;
          break;

        case "plain":
          colors.background = "transparent";
          colors.color = disabled
            ? isDark
              ? COLORS.system.darkLabel.tertiary
              : COLORS.system.label.tertiary
            : COLORS.system.accent.blue;
          colors.shadow = "none";
          break;
      }

      return colors;
    };

    const colors = getColors();

    // Size configurations
    const getSizeStyles = () => {
      const base = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING.component.button.gap,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 600,
        textDecoration: "none",
        outline: "none",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        border:
          variant === "tertiary" ? `1px solid ${colors.borderColor}` : "none",
        borderRadius:
          variant === "plain" ? BORDER_RADIUS.sm : BORDER_RADIUS.full,
        transition: createTransition(
          ["transform", "box-shadow", "background-color", "border-color"],
          "fast",
        ).transition,
      };

      switch (size) {
        case "small":
          return {
            ...base,
            padding: SPACING.component.button.padding.small,
            minHeight: "28px",
            minWidth: "56px",
            fontSize: "0.875rem",
            lineHeight: 1,
          };

        case "medium":
          return {
            ...base,
            padding: SPACING.component.button.padding.medium,
            minHeight: "36px",
            minWidth: "68px",
            fontSize: "1rem",
            lineHeight: 1,
          };

        case "large":
          return {
            ...base,
            padding: SPACING.component.button.padding.large,
            minHeight: "44px",
            minWidth: "80px",
            fontSize: "1.125rem",
            lineHeight: 1,
          };
      }
    };

    // Interactive states
    const getInteractiveStyles = () => {
      if (disabled || loading) {
        return {
          transform: "none",
          boxShadow: colors.shadow,
        };
      }

      const styles: Record<string, any> = {
        transform: isPressed
          ? "scale(0.98)"
          : isHovered
            ? "translateY(-1px)"
            : "translateY(0)",
        boxShadow: isPressed
          ? SHADOWS.sm
          : isHovered
            ? SHADOWS.md
            : colors.shadow,
      };

      // Variant-specific hover effects
      if (isHovered && !isPressed) {
        switch (variant) {
          case "primary":
            styles.backgroundColor = "#0056b3";
            break;
          case "secondary":
            styles.backgroundColor = isDark
              ? COLORS.system.darkFill.secondary
              : COLORS.system.fill.secondary;
            break;
          case "tertiary":
            styles.backgroundColor = isDark
              ? COLORS.system.darkFill.tertiary
              : COLORS.system.fill.tertiary;
            styles.borderRadius = BORDER_RADIUS.sm;
            break;
          case "destructive":
            styles.backgroundColor = "#d70015";
            break;
          case "plain":
            styles.backgroundColor = isDark
              ? COLORS.system.darkFill.tertiary
              : COLORS.system.fill.tertiary;
            styles.borderRadius = BORDER_RADIUS.sm;
            break;
        }
      }

      return styles;
    };

    // Focus styles
    const getFocusStyles = () => {
      if (!isFocused) return {};

      return {
        boxShadow: `0 0 0 2px ${isDark ? COLORS.system.darkLabel.primary : COLORS.system.label.primary}33`,
      };
    };

    // Icon styles
    const getIconStyles = () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size === "small" ? "16px" : size === "large" ? "20px" : "18px",
      width: size === "small" ? "16px" : size === "large" ? "20px" : "18px",
      height: size === "small" ? "16px" : size === "large" ? "20px" : "18px",
      flexShrink: 0,
    });

    // Loading spinner
    const renderLoadingSpinner = () => (
      <div
        style={{
          display: "inline-block",
          width: size === "small" ? "14px" : size === "large" ? "18px" : "16px",
          height:
            size === "small" ? "14px" : size === "large" ? "18px" : "16px",
          border: `2px solid currentColor`,
          borderRadius: "50%",
          borderTopColor: "transparent",
          animation: "spin 0.6s linear infinite",
        }}
        aria-hidden="true"
      />
    );

    // Event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsPressed(true);
      onMouseDown?.(e);
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsPressed(false);
      onMouseUp?.(e);
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setIsPressed(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        setIsPressed(true);
      }
      onKeyDown?.(e);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        setIsPressed(false);
      }
      onKeyUp?.(e);
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    // Combined styles
    const buttonStyles = {
      ...getSizeStyles(),
      backgroundColor: colors.background,
      color: colors.color,
      borderColor: colors.borderColor,
      width: fullWidth ? "100%" : "auto",
      ...getInteractiveStyles(),
      ...getFocusStyles(),
    };

    // ARIA attributes for accessibility
    const ariaProps = {
      "aria-disabled": disabled || loading,
      "aria-busy": loading,
      role: "button",
    };

    // Add keyboard navigation support
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (
          (e.key === " " || e.key === "Enter") &&
          isFocused &&
          ref &&
          "current" in ref &&
          ref.current
        ) {
          e.preventDefault();
          ref.current.click();
        }
      };

      if (isFocused) {
        document.addEventListener("keydown", handleGlobalKeyDown);
        return () =>
          document.removeEventListener("keydown", handleGlobalKeyDown);
      }
    }, [isFocused, ref]);

    return (
      <>
        <button
          ref={ref}
          className={`apple-button ${className}`}
          style={buttonStyles}
          disabled={disabled || loading}
          aria-label={props["aria-label"]}
          aria-describedby={props["aria-describedby"]}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...ariaProps}
          {...props}
        >
          {/* Loading spinner */}
          {loading && renderLoadingSpinner()}

          {/* Leading icon */}
          {!loading && icon && iconPosition === "leading" && (
            <span style={getIconStyles()} aria-hidden="true">
              {icon}
            </span>
          )}

          {/* Button content */}
          {!loading && (
            <span
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {children}
            </span>
          )}

          {/* Trailing icon */}
          {!loading && icon && iconPosition === "trailing" && (
            <span style={getIconStyles()} aria-hidden="true">
              {icon}
            </span>
          )}

          {/* Screen reader text for loading state */}
          {loading && (
            <span
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              Loading...
            </span>
          )}
        </button>

        {/* Global styles for animations */}
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          /* Ensure button doesn't grow beyond container */
          .apple-button {
            max-width: 100%;
          }

          /* Focus visible styles for better keyboard navigation */
          .apple-button:focus-visible {
            outline: 2px solid var(--color-accent-blue);
            outline-offset: 2px;
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .apple-button {
              border-width: 2px;
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .apple-button {
              transition: none;
            }

            .apple-button div[style*="animation"] {
              animation: none;
            }
          }
        `}</style>
      </>
    );
  },
);

AppleButton.displayName = "AppleButton";

export default AppleButton;
