import React, {
  forwardRef,
  HTMLAttributes,
  useState,
  useRef,
  useEffect,
} from "react";
import {
  createStyle,
  createTransition,
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
  GLASS,
} from "../../design-system/tokens";
import { useTheme } from "../../contexts/ThemeContext";

// Card variants
export type CardVariant =
  | "default"
  | "elevated"
  | "outlined"
  | "glass"
  | "interactive";

// Card sizes
export type CardSize = "small" | "medium" | "large";

// Card padding options
export type CardPadding = "none" | "small" | "medium" | "large";

export interface AppleCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  size?: CardSize;
  padding?: CardPadding;
  interactive?: boolean;
  hover?: boolean;
  selected?: boolean;
  disabled?: boolean;
  radius?: "none" | "small" | "medium" | "large" | "xlarge";
  shadow?: "none" | "small" | "medium" | "large";
  children: React.ReactNode;
}

/**
 * AppleCard - A card component that follows Apple's Human Interface Guidelines
 *
 * Features:
 * - Multiple variants (default, elevated, outlined, glass, interactive)
 * - Three sizes (small, medium, large)
 * - Interactive hover states
 * - Glass morphism effects
 * - Focus management
 * - Screen reader support
 * - Keyboard navigation
 * - Accessibility features
 */
const AppleCard = forwardRef<HTMLDivElement, AppleCardProps>(
  (
    {
      variant = "default",
      size = "medium",
      padding = "medium",
      interactive = false,
      hover = true,
      selected = false,
      disabled = false,
      radius = "large",
      shadow = variant === "elevated" ? "medium" : "small",
      className = "",
      children,
      onClick,
      onMouseDown,
      onMouseUp,
      onKeyDown,
      onKeyUp,
      tabIndex,
      ...props
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [isPressed, setIsPressed] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const isDark = theme?.includes("dark") || false;

    // Get border radius
    const getBorderRadius = () => {
      switch (radius) {
        case "none":
          return "0";
        case "small":
          return BORDER_RADIUS.sm;
        case "medium":
          return BORDER_RADIUS.md;
        case "large":
          return BORDER_RADIUS.lg;
        case "xlarge":
          return BORDER_RADIUS.xl;
        default:
          return BORDER_RADIUS.lg;
      }
    };

    // Get padding
    const getPadding = () => {
      switch (padding) {
        case "none":
          return "0";
        case "small":
          return SPACING.sm;
        case "medium":
          return SPACING.lg;
        case "large":
          return SPACING.xl;
        default:
          return SPACING.lg;
      }
    };

    // Get shadow based on variant and state
    const getShadow = () => {
      if (disabled || shadow === "none") return "none";

      const baseShadow = {
        none: "none",
        small: SHADOWS.sm,
        medium: SHADOWS.md,
        large: SHADOWS.lg,
      }[shadow];

      if (isPressed) {
        return SHADOWS.sm;
      }

      if (isHovered && hover && interactive) {
        return SHADOWS.lg;
      }

      if (selected) {
        return SHADOWS.colored.blue;
      }

      return baseShadow;
    };

    // Get background and border styles based on variant
    const getVariantStyles = () => {
      const base = {
        borderRadius: getBorderRadius(),
        transition: createTransition(
          ["transform", "box-shadow", "background-color", "border-color"],
          "fast",
        ).transition,
      };

      switch (variant) {
        case "glass":
          return {
            ...base,
            ...GLASS.effect[isDark ? "dark" : "medium"],
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.2)"}`,
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.5)"
              : "rgba(255, 255, 255, 0.7)",
          };

        case "elevated":
          return {
            ...base,
            backgroundColor: isDark
              ? COLORS.system.darkBackground.secondary
              : COLORS.system.background.primary,
            border: "none",
          };

        case "outlined":
          return {
            ...base,
            backgroundColor: "transparent",
            border: `1px solid ${isDark ? COLORS.system.darkSeparator.primary : COLORS.system.separator.primary}`,
          };

        case "interactive":
          return {
            ...base,
            backgroundColor: isDark
              ? COLORS.system.darkBackground.secondary
              : COLORS.system.background.primary,
            border: `1px solid ${isDark ? COLORS.system.darkSeparator.primary : COLORS.system.separator.primary}`,
          };

        case "default":
        default:
          return {
            ...base,
            backgroundColor: isDark
              ? COLORS.system.darkBackground.secondary
              : COLORS.system.background.secondary,
            border: "none",
          };
      }
    };

    // Get interactive states
    const getInteractiveStyles = () => {
      if (disabled) {
        return {
          opacity: 0.6,
          cursor: "not-allowed",
          transform: "none",
        };
      }

      const styles: Record<string, any> = {
        cursor: interactive ? "pointer" : "default",
        transform: isPressed
          ? "scale(0.98)"
          : isHovered && hover
            ? "translateY(-2px)"
            : "translateY(0)",
      };

      // Variant-specific hover effects
      if (isHovered && hover && interactive) {
        switch (variant) {
          case "glass":
            styles.backgroundColor = isDark
              ? "rgba(0, 0, 0, 0.6)"
              : "rgba(255, 255, 255, 0.8)";
            break;
          case "interactive":
            styles.backgroundColor = isDark
              ? COLORS.system.darkBackground.tertiary
              : COLORS.system.background.tertiary;
            styles.borderColor = COLORS.system.accent.blue;
            break;
          case "outlined":
            styles.backgroundColor = isDark
              ? COLORS.system.darkFill.tertiary
              : COLORS.system.fill.tertiary;
            break;
        }
      }

      // Selected state
      if (selected) {
        styles.borderColor = COLORS.system.accent.blue;
        if (variant !== "glass") {
          styles.backgroundColor = isDark
            ? "rgba(0, 122, 255, 0.1)"
            : "rgba(0, 122, 255, 0.05)";
        }
      }

      // Focus state
      if (isFocused) {
        styles.outline = `2px solid ${COLORS.system.accent.blue}`;
        styles.outlineOffset = "2px";
      }

      return styles;
    };

    // Size-specific styles
    const getSizeStyles = () => {
      switch (size) {
        case "small":
          return {
            minHeight: "80px",
          };
        case "large":
          return {
            minHeight: "200px",
          };
        case "medium":
        default:
          return {
            minHeight: "120px",
          };
      }
    };

    // Event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive && !disabled) {
        setIsPressed(true);
        onMouseDown?.(e);
      }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive && !disabled) {
        setIsPressed(false);
        onMouseUp?.(e);
      }
    };

    const handleMouseEnter = () => {
      if (interactive && !disabled && hover) {
        setIsHovered(true);
      }
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setIsPressed(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && !disabled) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsPressed(true);
        }
        onKeyDown?.(e);
      }
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (interactive && !disabled) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsPressed(false);
          if (onClick) {
            onClick(e as any);
          }
        }
        onKeyUp?.(e);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    // Combined styles
    const cardStyles = {
      ...getVariantStyles(),
      ...getInteractiveStyles(),
      ...getSizeStyles(),
      padding: getPadding(),
      boxShadow: getShadow(),
      position: "relative" as const,
      overflow: "hidden",
    };

    // ARIA attributes
    const ariaProps = {
      role: interactive ? "button" : "article",
      "aria-disabled": disabled,
      "aria-selected": selected,
      tabIndex: interactive && !disabled ? (tabIndex ?? 0) : tabIndex,
    };

    // Merge refs
    const mergedRef = (node: HTMLDivElement) => {
      cardRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    // Keyboard navigation support
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (
          interactive &&
          !disabled &&
          isFocused &&
          (e.key === "Enter" || e.key === " ") &&
          cardRef.current
        ) {
          e.preventDefault();
          cardRef.current.click();
        }
      };

      if (isFocused) {
        document.addEventListener("keydown", handleGlobalKeyDown);
        return () =>
          document.removeEventListener("keydown", handleGlobalKeyDown);
      }
    }, [interactive, disabled, isFocused]);

    return (
      <>
        <div
          ref={mergedRef}
          className={`apple-card ${className}`}
          style={cardStyles}
          onClick={onClick}
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
          {children}

          {/* Selection indicator */}
          {selected && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: COLORS.system.accent.blue,
                boxShadow: "0 0 0 2px rgba(0, 122, 255, 0.2)",
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Global styles */}
        <style jsx>{`
          .apple-card {
            box-sizing: border-box;
          }

          /* Focus visible styles for better keyboard navigation */
          .apple-card:focus-visible {
            outline: 2px solid var(--color-accent-blue);
            outline-offset: 2px;
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .apple-card {
              border-width: 2px;
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .apple-card {
              transition: none;
            }
          }

          /* Glass effect specific styles */
          .apple-card[data-variant="glass"] {
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            backdrop-filter: blur(40px) saturate(180%);
          }

          /* Interactive card specific styles */
          .apple-card[data-interactive="true"] {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
          }

          .apple-card[data-interactive="true"]:hover {
            z-index: 1;
          }

          /* Disabled state */
          .apple-card[data-disabled="true"] {
            pointer-events: none;
          }

          /* Loading state animation */
          @keyframes pulse-subtle {
            0%,
            100% {
              opacity: 1;
            }
            50% {
              opacity: 0.8;
            }
          }

          .apple-card[data-loading="true"] {
            animation: pulse-subtle 2s ease-in-out infinite;
          }
        `}</style>
      </>
    );
  },
);

AppleCard.displayName = "AppleCard";

export default AppleCard;
