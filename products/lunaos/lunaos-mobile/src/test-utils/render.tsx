/**
 * Custom render wrapper for React Native component tests.
 *
 * Wraps components with NavigationContainer and any providers
 * needed for the test environment.
 */

import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

/**
 * All required providers for rendering screens/components
 * in the test environment.
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationContainer>
      {children}
    </NavigationContainer>
  );
}

/**
 * Custom render that wraps the component with navigation
 * and other required providers.
 *
 * Usage:
 *   const { getByText } = renderWithProviders(<MyScreen />);
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders, AllProviders };

// Re-export everything from testing-library
export * from '@testing-library/react-native';
