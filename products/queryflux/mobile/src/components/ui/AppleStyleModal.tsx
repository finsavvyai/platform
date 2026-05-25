import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@context';
import { X } from 'lucide-react-native';

// Apple HIG Modal Presentation Styles
type ModalVariant = 'sheet' | 'center' | 'fullScreen';
type ModalSize = 'small' | 'medium' | 'large' | 'auto';

interface AppleStyleModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  variant?: ModalVariant;
  size?: ModalSize;
  showCloseButton?: boolean;
  dismissOnBackdropPress?: boolean;
  dismissOnSwipeDown?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: number;
  animationDuration?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_POINTS = {
  small: SCREEN_HEIGHT * 0.3,
  medium: SCREEN_HEIGHT * 0.5,
  large: SCREEN_HEIGHT * 0.8,
  auto: SCREEN_HEIGHT * 0.9,
};

const AppleStyleModal: React.FC<AppleStyleModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  variant = 'sheet',
  size = 'medium',
  showCloseButton = true,
  dismissOnBackdropPress = true,
  dismissOnSwipeDown = true,
  children,
  footer,
  maxHeight,
  animationDuration = 300,
}) => {
  const { theme } = useTheme();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const modalHeight = maxHeight || SNAP_POINTS[size];

  useEffect(() => {
    if (visible) {
      openModal();
    } else {
      closeModal();
    }
  }, [visible]);

  const openModal = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: animationDuration,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Reset pan value after close
      panY.setValue(0);
    });
  };

  const handleBackdropPress = () => {
    if (dismissOnBackdropPress) {
      onClose();
    }
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return dismissOnSwipeDown && gestureState.dy > 0;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        panY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > modalHeight * 0.3) {
        // Swipe down beyond threshold, close modal
        onClose();
      } else {
        // Animate back to position
        Animated.spring(panY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const getModalStyles = () => {
    switch (variant) {
      case 'sheet':
        return {
          position: 'absolute' as const,
          bottom: 0,
          left: 0,
          right: 0,
          height: modalHeight,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          backgroundColor: theme.colors.surface,
          ...Platform.select({
            ios: {
              // Apple HIG shadow for sheet
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        };
      case 'center':
        return {
          width: '90%',
          maxWidth: 400,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: {
              elevation: 8,
            },
          }),
        };
      case 'fullScreen':
        return {
          flex: 1,
          backgroundColor: theme.colors.background,
        };
      default:
        return {};
    }
  };

  const getModalTransform = () => {
    const transform = [];

    if (variant === 'sheet') {
      transform.push({ translateY: translateY });
      transform.push({ translateY: panY });
    } else if (variant === 'center') {
      transform.push({ translateY: translateY });
    }

    return transform;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modal: {
      ...getModalStyles(),
      transform: getModalTransform(),
    },
    sheet: {
      // Additional styles for sheet variant
      justifyContent: 'flex-start',
    },
    center: {
      // Center modal positioning
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -200, // Half of maxWidth
      marginTop: -modalHeight / 2,
      maxHeight: modalHeight,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sheetHeader: {
      // Apple HIG sheet indicator
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sheetIndicator: {
      width: 36,
      height: 5,
      backgroundColor: theme.colors.border,
      borderRadius: 3,
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'center',
      ...Platform.select({
        ios: {
          fontFamily: 'System',
          fontWeight: '600',
        },
        android: {
          fontFamily: 'Roboto',
          fontWeight: '600',
        },
      }),
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
    closeButton: {
      padding: theme.spacing.xs,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: variant === 'center' ? theme.spacing.lg : theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  });

  const renderHeader = () => {
    if (variant === 'sheet') {
      return (
        <View style={styles.sheetHeader}>
          <View style={styles.sheetIndicator} />
          {(title || subtitle) && (
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          )}
        </View>
      );
    }

    if (title || showCloseButton) {
      return (
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          <View style={{ flex: 2, alignItems: 'center' }}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {showCloseButton && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  const renderContent = () => {
    const content = (
      <>
        {renderHeader()}
        <View style={styles.content}>
          {children}
        </View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </>
    );

    if (Platform.OS === 'ios') {
      return (
        <KeyboardAvoidingView
          style={styles.modal}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {content}
        </KeyboardAvoidingView>
      );
    }

    return <View style={styles.modal}>{content}</View>;
  };

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={handleBackdropPress}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.modal,
            variant === 'center' && styles.center,
            variant === 'sheet' && styles.sheet,
          ]}
          {...(variant === 'sheet' ? panResponder.panHandlers : {})}
        >
          {renderContent()}
        </Animated.View>
      </View>
    </RNModal>
  );
};

export default AppleStyleModal;