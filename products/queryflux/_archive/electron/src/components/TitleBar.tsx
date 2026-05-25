import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Minus, Square, Maximize2, X } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useElectronSystem } from '../hooks/useElectronAPI';

interface TitleBarProps {
  title?: string;
  showTitle?: boolean;
  showControls?: boolean;
  onDoubleClick?: () => void;
  style?: any;
}

const TitleBar: React.FC<TitleBarProps> = ({
  title = 'QueryFlux',
  showTitle = true,
  showControls = true,
  onDoubleClick,
  style,
}) => {
  const { theme } = useTheme();
  const { isElectron } = useElectronSystem();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  const minimizeWindow = useCallback(async () => {
    if (isElectron) {
      await window.electronAPI?.invoke('window:minimize');
    }
  }, [isElectron]);

  const maximizeWindow = useCallback(async () => {
    if (isElectron) {
      await window.electronAPI?.invoke('window:maximize');
      setIsMaximized(!isMaximized);
    }
  }, [isElectron, isMaximized]);

  const closeWindow = useCallback(async () => {
    if (isElectron) {
      await window.electronAPI?.invoke('window:close');
    }
  }, [isElectron]);

  // Listen for window state changes
  useEffect(() => {
    if (isElectron) {
      const handleFocus = () => setIsFocused(true);
      const handleBlur = () => setIsFocused(false);

      window.electronAPI?.on('window:focus', handleFocus);
      window.electronAPI?.on('window:blur', handleBlur);

      return () => {
        window.electronAPI?.removeAllListeners('window:focus');
        window.electronAPI?.removeAllListeners('window:blur');
      };
    }
  }, [isElectron]);

  // Handle double-click to maximize
  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      maximizeWindow();
    }
  }, [onDoubleClick, maximizeWindow]);

  // Only show title bar in Electron on macOS
  if (!isElectron || Platform.OS !== 'web') {
    return null;
  }

  const titleBarStyles = StyleSheet.create({
    container: {
      height: 32,
      backgroundColor: isFocused ? theme.colors.titleBar : theme.colors.titleBarInactive,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      userSelect: 'none',
      WebkitAppRegion: 'drag' as const,
      WebkitUserSelect: 'none' as const,
      boxSizing: 'border-box' as const,
      ...style,
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 13,
      fontWeight: '500',
      color: isFocused ? theme.colors.titleBarText : theme.colors.titleBarTextInactive,
      textAlign: 'center' as const,
    },
    controls: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      WebkitAppRegion: 'no-drag' as const,
    },
    controlButton: {
      width: 46,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      WebkitAppRegion: 'no-drag' as const,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: '#00000020',
      },
      '&:active': {
        backgroundColor: '#00000040',
      },
    },
    minimizeButton: {
      '&:hover': {
        backgroundColor: '#00000020',
      },
    },
    maximizeButton: {
      '&:hover': {
        backgroundColor: '#00000020',
      },
    },
    closeButton: {
      '&:hover': {
        backgroundColor: '#ff0000',
      },
      '&:active': {
        backgroundColor: '#ff0000',
      },
    },
  });

  return (
    <View style={titleBarStyles.container} onDoubleClick={handleDoubleClick}>
      {/* Title */}
      {showTitle && (
        <View style={titleBarStyles.titleContainer}>
          <Text style={titleBarStyles.title}>{title}</Text>
        </View>
      )}

      {/* Window Controls */}
      {showControls && (
        <View style={titleBarStyles.controls}>
          {/* Minimize */}
          <TouchableOpacity
            style={[titleBarStyles.controlButton, titleBarStyles.minimizeButton]}
            onPress={minimizeWindow}
            accessibilityLabel="Minimize window"
            accessibilityRole="button"
          >
            <Minus
              size={12}
              color={isFocused ? theme.colors.titleBarText : theme.colors.titleBarTextInactive}
            />
          </TouchableOpacity>

          {/* Maximize/Restore */}
          <TouchableOpacity
            style={[titleBarStyles.controlButton, titleBarStyles.maximizeButton]}
            onPress={maximizeWindow}
            accessibilityLabel={isMaximized ? "Restore window" : "Maximize window"}
            accessibilityRole="button"
          >
            {isMaximized ? (
              <Square
                size={10}
                color={isFocused ? theme.colors.titleBarText : theme.colors.titleBarTextInactive}
              />
            ) : (
              <Maximize2
                size={10}
                color={isFocused ? theme.colors.titleBarText : theme.colors.titleBarTextInactive}
              />
            )}
          </TouchableOpacity>

          {/* Close */}
          <TouchableOpacity
            style={[titleBarStyles.controlButton, titleBarStyles.closeButton]}
            onPress={closeWindow}
            accessibilityLabel="Close window"
            accessibilityRole="button"
          >
            <X
              size={12}
              color={isFocused ? theme.colors.titleBarText : theme.colors.titleBarTextInactive}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default TitleBar;