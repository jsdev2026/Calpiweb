import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockFindUserByEmail,
  mockAddShare,
  mockRemoveShare,
  mockAddNotification,
  mockAcquireLock,
  mockReleaseLock,
  mockRefreshLock,
  mockGetNotifications,
  mockMarkNotificationsSeen,
  mockGetShares,
} = vi.hoisted(() => ({
  mockFindUserByEmail: vi.fn(),
  mockAddShare: vi.fn(),
  mockRemoveShare: vi.fn(),
  mockAddNotification: vi.fn(),
  mockAcquireLock: vi.fn(),
  mockReleaseLock: vi.fn(),
  mockRefreshLock: vi.fn(),
  mockGetNotifications: vi.fn(),
  mockMarkNotificationsSeen: vi.fn(),
  mockGetShares: vi.fn(),
}));

vi.mock('@/lib/supabase/sharing', () => ({
  sharingDb: {
    findUserByEmail: mockFindUserByEmail,
    addShare: mockAddShare,
    removeShare: mockRemoveShare,
    addNotification: mockAddNotification,
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
    refreshLock: mockRefreshLock,
    getNotifications: mockGetNotifications,
    markNotificationsSeen: mockMarkNotificationsSeen,
    getShares: mockGetShares,
  },
}));

import { useSharingStore } from './sharingStore';

describe('sharingStore.shareProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSharingStore.setState({ shares: {}, notifications: [], unseenCount: 0 });
  });

  it('throws USER_NOT_FOUND when email not registered', async () => {
    mockFindUserByEmail.mockResolvedValueOnce(null);
    await expect(
      useSharingStore.getState().shareProject('proj-1', 'ghost@x.com', 'editor'),
    ).rejects.toThrow('USER_NOT_FOUND');
  });

  it('calls addShare + addNotification on success', async () => {
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-2', displayName: 'Alice' });
    mockGetShares.mockResolvedValueOnce([]);
    mockAddShare.mockResolvedValueOnce(undefined);
    mockAddNotification.mockResolvedValueOnce(undefined);
    mockGetShares.mockResolvedValueOnce([]);
    await useSharingStore.getState().shareProject('proj-1', 'alice@x.com', 'editor');
    expect(mockAddShare).toHaveBeenCalledWith('proj-1', 'user-2', 'editor');
    expect(mockAddNotification).toHaveBeenCalledWith('user-2', 'proj-1', 'share_added');
  });

  it('throws ALREADY_SHARED when user is already a collaborator', async () => {
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-2', displayName: 'Alice' });
    mockGetShares.mockResolvedValueOnce([
      { id: 's1', projectId: 'proj-1', userId: 'user-2', userEmail: 'alice@x.com', userDisplayName: 'Alice', role: 'editor', createdAt: '2026-01-01' },
    ]);
    await expect(
      useSharingStore.getState().shareProject('proj-1', 'alice@x.com', 'viewer'),
    ).rejects.toThrow('ALREADY_SHARED');
  });
});

describe('sharingStore.acquireLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSharingStore.setState({ shares: {}, notifications: [], unseenCount: 0 });
  });

  it('returns acquired when lock is free', async () => {
    mockAcquireLock.mockResolvedValueOnce('acquired');
    const result = await useSharingStore.getState().acquireLock('proj-1');
    expect(result).toBe('acquired');
  });

  it('returns locked_by_other when another user has the lock', async () => {
    mockAcquireLock.mockResolvedValueOnce('locked_by_other');
    const result = await useSharingStore.getState().acquireLock('proj-1');
    expect(result).toBe('locked_by_other');
  });
});
