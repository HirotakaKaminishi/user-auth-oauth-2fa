/**
 * User domain types
 * Based on design.md Data Layer specification
 */

export type UserId = string; // UUID

export type OAuthProvider = 'google' | 'github' | 'microsoft';

export type OAuthConnection = {
  provider: OAuthProvider;
  providerId: string;
  connectedAt: Date;
  lastUsedAt: Date;
};

export type User = {
  id: UserId;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  createdAt: Date;
  updatedAt: Date;
  oauthConnections: OAuthConnection[];
  accountStatus: 'active' | 'locked' | 'suspended';
  failedLoginAttempts: number;
  lockedUntil?: Date;
};

export type OAuthUserProfile = {
  providerId: string;
  provider: OAuthProvider;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  rawProfile: Record<string, unknown>;
};

export type RepositoryError =
  | { type: 'NOT_FOUND'; entityId: string }
  | { type: 'DUPLICATE_EMAIL'; email: string }
  | { type: 'DUPLICATE_OAUTH_CONNECTION'; provider: OAuthProvider; providerId: string }
  | { type: 'DATABASE_ERROR'; cause: Error }
  | { type: 'OPTIMISTIC_LOCK_ERROR'; entityId: string };
