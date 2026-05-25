/**
 * Mock for expo-haptics. All methods are no-ops.
 */

export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
} as const;

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;

export async function impactAsync(): Promise<void> {
  // no-op
}

export async function notificationAsync(): Promise<void> {
  // no-op
}

export async function selectionAsync(): Promise<void> {
  // no-op
}
