export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'user' | 'admin' | 'enterprise';
  subscription: 'free' | 'pro' | 'enterprise';
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedUser {
  userId: string;
  id: string; // Add id field for compatibility
  email: string;
  role: string;
  name?: string;
  avatarUrl?: string;
  teamId?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}
