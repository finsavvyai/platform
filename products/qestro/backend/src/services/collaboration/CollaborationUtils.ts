/**
 * Collaboration Utilities
 * Helper functions for session and participant management
 */

import type { Participant } from './types.js';

/**
 * Generate a unique color for participant cursors
 */
export function generateParticipantColor(index: number): string {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
  ];
  return colors[index % colors.length];
}

/**
 * Find participant in list
 */
export function findParticipant(participants: Participant[], userId: string): Participant | undefined {
  return participants.find(p => p.userId === userId);
}

/**
 * Remove participant from list
 */
export function removeParticipant(participants: Participant[], userId: string): Participant[] {
  return participants.filter(p => p.userId !== userId);
}

/**
 * Get active participants
 */
export function getActiveParticipants(participants: Participant[]): Participant[] {
  return participants.filter(p => p.presence.status !== 'idle');
}

/**
 * Check if participants list is full
 */
export function isSessionFull(participants: Participant[], maxParticipants: number): boolean {
  return participants.length >= maxParticipants;
}

/**
 * Create initial participant
 */
export function createParticipant(
  userId: string,
  userName: string,
  email: string,
  color: string
): Participant {
  return {
    userId,
    userName,
    email,
    joinedAt: new Date(),
    presence: {
      userId,
      userName,
      status: 'viewing',
      lastSeen: new Date(),
    },
    color,
  };
}
