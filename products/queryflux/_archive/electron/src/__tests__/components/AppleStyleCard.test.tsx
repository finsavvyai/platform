import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import AppleStyleCard from '../../components/ui/AppleStyleCard';
import { useTheme } from '../../contexts/ThemeContext';

// Mock the useTheme hook
jest.mock('../../contexts/ThemeContext');

const mockTheme = {
  name: 'dark',
  displayName: 'Dark',
  colors: {
    background: '#1a1a1a',
    surface: '#2d2d2d',
    surfaceHover: '#3d3d3d',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#404040',
    primary: '#007AFF',
    primaryHover: '#0051D5',
    error: '#FF3B30',
    errorHover: '#D70015',
    success: '#34C759',
    warning: '#FF9500',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
};

(useTheme as jest.Mock).mockReturnValue(mockTheme);

describe('AppleStyleCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render card with children', () => {
    const { getByText } = render(
      <AppleStyleCard>
        <Text>Card Content</Text>
      </AppleStyleCard>
    );

    expect(getByText('Card Content')).toBeTruthy();
  });

  test('should apply default styles', () => {
    const { getByTestId } = render(
      <AppleStyleCard testID="test-card">
        <Text>Content</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      backgroundColor: mockTheme.colors.surface,
      borderRadius: 12,
      padding: mockTheme.spacing.md,
      margin: mockTheme.spacing.sm,
    });
  });

  test('should handle press when onPress is provided', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <AppleStyleCard onPress={onPressMock} testID="test-card">
        <Text>Clickable Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    fireEvent.press(card);
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  test('should not be pressable when onPress is not provided', () => {
    const { getByTestId } = render(
      <AppleStyleCard testID="test-card">
        <Text>Non-Clickable Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.onPress).toBeUndefined();
  });

  test('should apply disabled state', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <AppleStyleCard onPress={onPressMock} disabled={true} testID="test-card">
        <Text>Disabled Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.disabled).toBe(true);
    expect(card.props.style).toMatchObject({
      opacity: 0.6,
    });

    fireEvent.press(card);
    expect(onPressMock).not.toHaveBeenCalled();
  });

  test('should handle loading state', () => {
    const { getByTestId } = render(
      <AppleStyleCard loading={true} testID="test-card">
        <Text>Loading Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.disabled).toBe(true);
    expect(card.props.style).toMatchObject({
      opacity: 0.6,
    });
  });

  test('should apply primary variant styles', () => {
    const { getByTestId } = render(
      <AppleStyleCard variant="primary" testID="test-card">
        <Text>Primary Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      backgroundColor: mockTheme.colors.surface,
      borderWidth: 1,
    });
  });

  test('should apply secondary variant styles', () => {
    const { getByTestId } = render(
      <AppleStyleCard variant="secondary" testID="test-card">
        <Text>Secondary Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      backgroundColor: 'transparent',
      borderWidth: 1,
    });
  });

  test('should apply elevated variant styles', () => {
    const { getByTestId } = render(
      <AppleStyleCard variant="elevated" testID="test-card">
        <Text>Elevated Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      backgroundColor: mockTheme.colors.surface,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    });
  });

  test('should apply outlined variant styles', () => {
    const { getByTestId } = render(
      <AppleStyleCard variant="outlined" testID="test-card">
        <Text>Outlined Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      backgroundColor: 'transparent',
      borderWidth: 2,
    });
  });

  test('should handle small size', () => {
    const { getByTestId } = render(
      <AppleStyleCard size="small" testID="test-card">
        <Text>Small Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      borderRadius: 8,
      padding: mockTheme.spacing.sm,
    });
  });

  test('should handle medium size', () => {
    const { getByTestId } = render(
      <AppleStyleCard size="medium" testID="test-card">
        <Text>Medium Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      borderRadius: 12,
      padding: mockTheme.spacing.md,
    });
  });

  test('should handle large size', () => {
    const { getByTestId } = render(
      <AppleStyleCard size="large" testID="test-card">
        <Text>Large Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      borderRadius: 16,
      padding: mockTheme.spacing.lg,
    });
  });

  test('should apply custom padding', () => {
    const { getByTestId } = render(
      <AppleStyleCard padding={32} testID="test-card">
        <Text>Custom Padding</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      padding: 32,
    });
  });

  test('should apply custom margin', () => {
    const { getByTestId } = render(
      <AppleStyleCard margin={20} testID="test-card">
        <Text>Custom Margin</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      margin: 20,
    });
  });

  test('should apply custom border radius', () => {
    const { getByTestId } = render(
      <AppleStyleCard borderRadius={24} testID="test-card">
        <Text>Custom Border Radius</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      borderRadius: 24,
    });
  });

  test('should apply shadow when shadow is true', () => {
    const { getByTestId } = render(
      <AppleStyleCard shadow={true} testID="test-card">
        <Text>Shadow Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject({
      boxShadow: expect.any(String),
    });
  });

  test('should not apply shadow when shadow is false', () => {
    const { getByTestId } = render(
      <AppleStyleCard shadow={false} testID="test-card">
        <Text>No Shadow Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).not.toMatchObject({
      boxShadow: expect.any(String),
    });
  });

  test('should handle hover effect when hoverable is true', () => {
    const { getByTestId } = render(
      <AppleStyleCard hoverable={true} testID="test-card">
        <Text>Hoverable Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');

    // Simulate mouse enter
    fireEvent(card.props.onMouseEnter, {});

    // In a real environment, this would trigger hover styles
    // For testing, we just verify the hover handler exists
    expect(card.props.onMouseEnter).toBeDefined();
  });

  test('should call onHover callback when hover state changes', () => {
    const onHoverMock = jest.fn();
    const { getByTestId } = render(
      <AppleStyleCard hoverable={true} onHover={onHoverMock} testID="test-card">
        <Text>Hover Callback Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');

    // Simulate mouse enter
    fireEvent(card.props.onMouseEnter, {});
    expect(onHoverMock).toHaveBeenCalledWith(true);

    // Simulate mouse leave
    fireEvent(card.props.onMouseLeave, {});
    expect(onHoverMock).toHaveBeenCalledWith(false);
  });

  test('should apply custom styles', () => {
    const customStyle = {
      backgroundColor: 'custom-color',
      borderWidth: 2,
      borderColor: 'custom-border',
    };

    const { getByTestId } = render(
      <AppleStyleCard style={customStyle} testID="test-card">
        <Text>Custom Style Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.style).toMatchObject(customStyle);
  });

  test('should pass accessibility props', () => {
    const { getByTestId } = render(
      <AppleStyleCard
        onPress={jest.fn()}
        accessible={true}
        accessibilityLabel="Test Card"
        testID="test-card"
      >
        <Text>Accessible Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card.props.accessible).toBe(true);
    expect(card.props.accessibilityLabel).toBe('Test Card');
    expect(card.props.accessibilityRole).toBe('button');
  });

  test('should merge multiple styles correctly', () => {
    const customStyle = {
      marginTop: 20,
      marginBottom: 20,
    };

    const { getByTestId } = render(
      <AppleStyleCard
        style={customStyle}
        variant="elevated"
        testID="test-card"
      >
        <Text>Merged Styles Card</Text>
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    const style = card.props.style;

    // Should have custom styles
    expect(style).toMatchObject({
      marginTop: 20,
      marginBottom: 20,
    });

    // Should have elevated variant styles
    expect(style).toMatchObject({
      backgroundColor: mockTheme.colors.surface,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    });
  });

  test('should handle empty children', () => {
    const { getByTestId } = render(
      <AppleStyleCard testID="test-card">
        {null}
      </AppleStyleCard>
    );

    const card = getByTestId('test-card');
    expect(card).toBeTruthy();
  });

  test('should handle multiple children', () => {
    const { getByText } = render(
      <AppleStyleCard>
        <Text>Child 1</Text>
        <Text>Child 2</Text>
        <Text>Child 3</Text>
      </AppleStyleCard>
    );

    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
    expect(getByText('Child 3')).toBeTruthy();
  });
});