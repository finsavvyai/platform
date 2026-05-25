import React from 'react';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

type InputType = 'text' | 'email' | 'password' | 'number';

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  type?: InputType;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, type = 'text', disabled = false, ...props }, ref) => {
    const { theme } = useTheme();
    const colorScheme = colors[theme];

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing[1],
      width: '100%',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 600,
      color: colorScheme.foreground,
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    };

    const inputStyle: React.CSSProperties = {
      padding: `${spacing[2]} ${spacing[3]}`,
      fontSize: '16px',
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
      border: `1px solid ${error ? colorScheme.destructive : colorScheme.border}`,
      borderRadius: '8px',
      backgroundColor: colorScheme.background,
      color: colorScheme.foreground,
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      transition: 'border-color 0.2s',
    };

    const errorStyle: React.CSSProperties = {
      fontSize: '12px',
      color: colorScheme.destructive,
      fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    };

    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          style={inputStyle}
          {...props}
        />
        {error && <span style={errorStyle}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
