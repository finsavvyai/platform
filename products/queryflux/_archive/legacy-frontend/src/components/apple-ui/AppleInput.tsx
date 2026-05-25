import React, {
  forwardRef,
  useState,
  useEffect,
  useRef,
  InputHTMLAttributes,
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
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

// Input types
export type InputType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "number";

// Input states
export type InputState = "default" | "focus" | "error" | "success" | "disabled";

// Input sizes
export type InputSize = "small" | "medium" | "large";

export interface AppleInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  type?: InputType;
  label?: string;
  placeholder?: string;
  state?: InputState;
  size?: InputSize;
  error?: string;
  success?: string;
  helper?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  maxLength?: number;
  showLength?: boolean;
}

/**
 * AppleInput - An input component that follows Apple's Human Interface Guidelines
 *
 * Features:
 * - Floating labels that animate on focus
 * - Multiple input types
 * - Validation states (error, success, default)
 * - Icon support
 * - Clearable inputs
 * - Helper text
 * - Character counter
 * - Keyboard navigation
 * - Screen reader support
 * - Focus management
 * - Accessible form controls
 */
const AppleInput = forwardRef<HTMLInputElement, AppleInputProps>(
  (
    {
      type = "text",
      label,
      placeholder = "",
      state = "default",
      size = "medium",
      error,
      success,
      helper,
      icon,
      clearable = false,
      onClear,
      onChange,
      onFocus,
      onBlur,
      onKeyDown,
      disabled = false,
      required = false,
      fullWidth = false,
      maxLength,
      showLength = false,
      value = "",
      className = "",
      id,
      ...props
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!value || !!props.defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const labelId = id ? `${id}-label` : undefined;
    const helperId = id ? `${id}-helper` : undefined;
    const errorId = id ? `${id}-error` : undefined;

    const isDark = theme?.includes("dark") || false;

    // Determine actual state based on props
    const actualState = disabled
      ? "disabled"
      : error
        ? "error"
        : success
          ? "success"
          : isFocused
            ? "focus"
            : state;

    // Generate unique ID for input if not provided
    const inputId =
      id || `apple-input-${Math.random().toString(36).substr(2, 9)}`;

    // Handle value changes
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setHasValue(!!newValue);
      onChange?.(e);
    };

    // Handle focus events
    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Handle clear action
    const handleClear = () => {
      if (inputRef.current) {
        inputRef.current.value = "";
        setHasValue(false);
        onClear?.();
        // Trigger onChange event
        const event = {
          target: inputRef.current,
          currentTarget: inputRef.current,
        } as ChangeEvent<HTMLInputElement>;
        onChange?.(event);
      }
    };

    // Handle keyboard events
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && clearable && hasValue) {
        handleClear();
      }
      onKeyDown?.(e);
    };

    // Get colors based on state
    const getStateColors = () => {
      const colors = {
        backgroundColor: "",
        borderColor: "",
        textColor: "",
        labelColor: "",
        helperColor: "",
        iconColor: "",
      };

      switch (actualState) {
        case "focus":
          colors.backgroundColor = isDark
            ? COLORS.system.darkBackground.primary
            : COLORS.system.background.primary;
          colors.borderColor = COLORS.system.accent.blue;
          colors.textColor = isDark
            ? COLORS.system.darkLabel.primary
            : COLORS.system.label.primary;
          colors.labelColor = COLORS.system.accent.blue;
          colors.helperColor = isDark
            ? COLORS.system.darkLabel.secondary
            : COLORS.system.label.secondary;
          colors.iconColor = COLORS.system.accent.blue;
          break;

        case "error":
          colors.backgroundColor = isDark
            ? COLORS.system.darkBackground.primary
            : COLORS.system.background.primary;
          colors.borderColor = COLORS.system.accent.red;
          colors.textColor = isDark
            ? COLORS.system.darkLabel.primary
            : COLORS.system.label.primary;
          colors.labelColor = COLORS.system.accent.red;
          colors.helperColor = COLORS.system.accent.red;
          colors.iconColor = COLORS.system.accent.red;
          break;

        case "success":
          colors.backgroundColor = isDark
            ? COLORS.system.darkBackground.primary
            : COLORS.system.background.primary;
          colors.borderColor = COLORS.system.accent.green;
          colors.textColor = isDark
            ? COLORS.system.darkLabel.primary
            : COLORS.system.label.primary;
          colors.labelColor = COLORS.system.accent.green;
          colors.helperColor = COLORS.system.accent.green;
          colors.iconColor = COLORS.system.accent.green;
          break;

        case "disabled":
          colors.backgroundColor = isDark
            ? COLORS.system.darkFill.quaternary
            : COLORS.system.fill.quaternary;
          colors.borderColor = isDark
            ? COLORS.system.darkSeparator.tertiary
            : COLORS.system.separator.tertiary;
          colors.textColor = isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary;
          colors.labelColor = isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary;
          colors.helperColor = isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary;
          colors.iconColor = isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary;
          break;

        default: // 'default' state
          colors.backgroundColor = isDark
            ? COLORS.system.darkBackground.primary
            : COLORS.system.background.primary;
          colors.borderColor = isDark
            ? COLORS.system.darkSeparator.primary
            : COLORS.system.separator.primary;
          colors.textColor = isDark
            ? COLORS.system.darkLabel.primary
            : COLORS.system.label.primary;
          colors.labelColor = isDark
            ? COLORS.system.darkLabel.secondary
            : COLORS.system.label.secondary;
          colors.helperColor = isDark
            ? COLORS.system.darkLabel.secondary
            : COLORS.system.label.secondary;
          colors.iconColor = isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary;
          break;
      }

      return colors;
    };

    const colors = getStateColors();

    // Get size styles
    const getSizeStyles = () => {
      const base = {
        fontSize:
          size === "small"
            ? "0.875rem"
            : size === "large"
              ? "1.125rem"
              : "1rem",
        lineHeight: 1.5,
      };

      switch (size) {
        case "small":
          return {
            ...base,
            paddingTop: "18px",
            paddingBottom: "6px",
            height: "44px",
          };

        case "medium":
          return {
            ...base,
            paddingTop: "22px",
            paddingBottom: "8px",
            height: "52px",
          };

        case "large":
          return {
            ...base,
            paddingTop: "26px",
            paddingBottom: "10px",
            height: "60px",
          };
      }
    };

    // Label styles
    const getLabelStyles = () => {
      const isFloating = isFocused || hasValue;
      const base = {
        position: "absolute" as const,
        left: icon ? "44px" : "16px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 400,
        pointerEvents: "none" as const,
        transition: createTransition(["top", "fontSize", "color"], "fast")
          .transition,
        zIndex: 1,
      };

      if (isFloating) {
        return {
          ...base,
          top: "8px",
          fontSize: "0.75rem",
          color: colors.labelColor,
        };
      } else {
        return {
          ...base,
          top: size === "small" ? "11px" : size === "large" ? "19px" : "15px",
          fontSize: "1rem",
          color: colors.labelColor,
        };
      }
    };

    // Container styles
    const containerStyles = {
      position: "relative" as const,
      width: fullWidth ? "100%" : "auto",
      display: "flex",
      flexDirection: "column" as const,
    };

    // Input wrapper styles
    const wrapperStyles = {
      position: "relative" as const,
      display: "flex",
      alignItems: "center",
    };

    // Input styles
    const inputStyles = {
      ...getSizeStyles(),
      ...createStyle({
        width: "100%",
        backgroundColor: colors.backgroundColor,
        color: colors.textColor,
        border: `1px solid ${colors.borderColor}`,
        borderRadius: BORDER_RADIUS.sm,
        padding: `0 ${icon ? "44px" : "16px"} 0 16px`,
        outline: "none",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        fontSize:
          size === "small"
            ? "0.875rem"
            : size === "large"
              ? "1.125rem"
              : "1rem",
        transition: createTransition(
          ["border-color", "box-shadow", "background-color"],
          "fast",
        ).transition,
        cursor: disabled ? "not-allowed" : "text",
        opacity: disabled ? 0.6 : 1,
        boxShadow:
          actualState === "focus"
            ? `0 0 0 2px ${COLORS.system.accent.blue}33`
            : "none",
        "&::placeholder": {
          color: "transparent",
        },
        "&:focus::placeholder": {
          color: isDark
            ? COLORS.system.darkLabel.tertiary
            : COLORS.system.label.tertiary,
        },
        "&:disabled": {
          cursor: "not-allowed",
          userSelect: "none",
        },
      }),
    };

    // Icon styles
    const iconStyles = {
      position: "absolute" as const,
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "20px",
      height: "20px",
      color: colors.iconColor,
      pointerEvents: "none" as const,
      zIndex: 2,
    };

    // Clear button styles
    const clearButtonStyles = {
      position: "absolute" as const,
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "20px",
      height: "20px",
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: isDark
        ? COLORS.system.darkFill.tertiary
        : COLORS.system.fill.tertiary,
      border: "none",
      color: isDark
        ? COLORS.system.darkLabel.secondary
        : COLORS.system.label.secondary,
      cursor: "pointer",
      transition: createTransition(["background-color", "color"], "fast")
        .transition,
      "&:hover": {
        backgroundColor: isDark
          ? COLORS.system.darkFill.secondary
          : COLORS.system.fill.secondary,
        color: isDark
          ? COLORS.system.darkLabel.primary
          : COLORS.system.label.primary,
      },
    };

    // Helper text styles
    const helperStyles = {
      marginTop: SPACING.xs,
      fontSize: "0.75rem",
      lineHeight: 1.4,
      color: colors.helperColor,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    };

    // Length counter styles
    const lengthCounterStyles = {
      ...helperStyles,
      textAlign: "right" as const,
      marginTop: SPACING.xs,
      opacity: 0.7,
    };

    // Get current value length
    const currentLength =
      typeof value === "string"
        ? value.length
        : typeof props.defaultValue === "string"
          ? props.defaultValue.length
          : 0;

    // ARIA attributes
    const ariaProps = {
      "aria-invalid": actualState === "error",
      "aria-describedby": [
        helper ? helperId : undefined,
        error ? errorId : undefined,
      ]
        .filter(Boolean)
        .join(" "),
      "aria-required": required,
      "aria-disabled": disabled,
    };

    // Merge refs
    const mergedRef = (node: HTMLInputElement) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div style={containerStyles} className={`apple-input ${className}`}>
        {/* Input wrapper */}
        <div style={wrapperStyles}>
          {/* Icon */}
          {icon && (
            <div style={iconStyles} aria-hidden="true">
              {icon}
            </div>
          )}

          {/* Floating Label */}
          {label && (
            <label
              htmlFor={inputId}
              id={labelId}
              style={getLabelStyles()}
              className="apple-input-label"
            >
              {label}
              {required && (
                <span
                  style={{ color: COLORS.system.accent.red, marginLeft: "2px" }}
                  aria-label="required"
                >
                  *
                </span>
              )}
            </label>
          )}

          {/* Input */}
          <input
            ref={mergedRef}
            id={inputId}
            type={type}
            placeholder={hasValue ? placeholder : ""}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            style={inputStyles}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-label={props["aria-label"] || label}
            {...ariaProps}
            {...props}
          />

          {/* Clear button */}
          {clearable && hasValue && !disabled && (
            <button
              type="button"
              style={clearButtonStyles}
              onClick={handleClear}
              aria-label="Clear input"
              className="apple-input-clear"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M9 3L3 9M3 3L9 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Helper text */}
        {(helper || error || success) && (
          <div
            id={helperId}
            style={helperStyles}
            className="apple-input-helper"
          >
            {error || success || helper}
          </div>
        )}

        {/* Length counter */}
        {showLength && maxLength && (
          <div style={lengthCounterStyles} className="apple-input-counter">
            {currentLength}/{maxLength}
          </div>
        )}

        {/* Global styles */}
        <style jsx>{`
          .apple-input-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: calc(100% - 32px);
          }

          .apple-input-clear:hover {
            transform: translateY(-50%) scale(1.1);
          }

          .apple-input-clear:active {
            transform: translateY(-50%) scale(0.95);
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .apple-input input {
              border-width: 2px;
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .apple-input-label,
            .apple-input input,
            .apple-input-clear {
              transition: none;
            }
          }
        `}</style>
      </div>
    );
  },
);

AppleInput.displayName = "AppleInput";

export default AppleInput;
