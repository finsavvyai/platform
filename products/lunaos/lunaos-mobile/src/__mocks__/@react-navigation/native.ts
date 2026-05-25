/**
 * Mock for @react-navigation/native.
 * Provides minimal implementations for navigation test support.
 */

import React from 'react';

const actualNav = jest.requireActual('@react-navigation/native');

const mockedNavigate = jest.fn();
const mockedGoBack = jest.fn();
const mockedReset = jest.fn();

export const useNavigation = () => ({
  navigate: mockedNavigate,
  goBack: mockedGoBack,
  reset: mockedReset,
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  canGoBack: jest.fn(() => true),
  getState: jest.fn(() => ({ routes: [] })),
  isFocused: jest.fn(() => true),
});

export const useRoute = () => ({
  key: 'test-route',
  name: 'TestScreen',
  params: {},
});

export const useFocusEffect = (cb: () => void) => {
  React.useEffect(cb, [cb]);
};

export const useIsFocused = () => true;

export const NavigationContainer = actualNav.NavigationContainer;
export const createNavigationContainerRef =
  actualNav.createNavigationContainerRef;

export { mockedNavigate, mockedGoBack, mockedReset };
