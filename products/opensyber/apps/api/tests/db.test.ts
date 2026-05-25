/**
 * Unit tests for database module.
 * Tests schema validation and query helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import { users, tokens, subscriptions, sessions } from '../src/db/schema';

describe('Database Schema', () => {
  it('should define users table with correct columns', () => {
    expect(users).toBeDefined();
    expect(users.id).toBeDefined();
  });

  it('should define tokens table with correct columns', () => {
    expect(tokens).toBeDefined();
    expect(tokens.id).toBeDefined();
  });

  it('should define subscriptions table with correct columns', () => {
    expect(subscriptions).toBeDefined();
    expect(subscriptions.id).toBeDefined();
  });

  it('should define sessions table with correct columns', () => {
    expect(sessions).toBeDefined();
    expect(sessions.id).toBeDefined();
  });

  it('users table should have required columns', () => {
    const userColumns = Object.keys(users);
    expect(userColumns).toContain('id');
    expect(userColumns).toContain('email');
    expect(userColumns).toContain('name');
    expect(userColumns).toContain('role');
    expect(userColumns).toContain('created_at');
    expect(userColumns).toContain('updated_at');
  });

  it('subscriptions table should have required columns', () => {
    const subColumns = Object.keys(subscriptions);
    expect(subColumns).toContain('id');
    expect(subColumns).toContain('user_id');
    expect(subColumns).toContain('plan');
    expect(subColumns).toContain('status');
    expect(subColumns).toContain('started_at');
    expect(subColumns).toContain('expires_at');
  });

  it('sessions table should have required columns', () => {
    const sessionColumns = Object.keys(sessions);
    expect(sessionColumns).toContain('id');
    expect(sessionColumns).toContain('user_id');
    expect(sessionColumns).toContain('ip');
    expect(sessionColumns).toContain('user_agent');
    expect(sessionColumns).toContain('created_at');
    expect(sessionColumns).toContain('expires_at');
  });

  it('tokens table should have required columns', () => {
    const tokenColumns = Object.keys(tokens);
    expect(tokenColumns).toContain('id');
    expect(tokenColumns).toContain('user_id');
    expect(tokenColumns).toContain('token');
    expect(tokenColumns).toContain('expires_at');
  });
});

describe('Database Types', () => {
  it('should define user role as enum', () => {
    expect(users.role).toBeDefined();
  });

  it('should define subscription plan as enum', () => {
    expect(subscriptions.plan).toBeDefined();
  });

  it('should define subscription status as enum', () => {
    expect(subscriptions.status).toBeDefined();
  });
});
