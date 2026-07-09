import { describe, it, expect } from 'vitest';

// We test the route classification logic independently of the Supabase call
import { classifyRoute } from '../middleware';

describe('classifyRoute', () => {
  it('marks /dashboard as protected', () => {
    expect(classifyRoute('/dashboard')).toBe('protected');
  });

  it('marks /project/abc as protected', () => {
    expect(classifyRoute('/project/abc-123')).toBe('protected');
  });

  it('marks /account as protected', () => {
    expect(classifyRoute('/account')).toBe('protected');
  });

  it('marks /auth as auth-only', () => {
    expect(classifyRoute('/auth')).toBe('auth');
  });

  it('marks /auth/callback as auth-only', () => {
    expect(classifyRoute('/auth/callback')).toBe('auth');
  });

  it('marks / as public', () => {
    expect(classifyRoute('/')).toBe('public');
  });
});
