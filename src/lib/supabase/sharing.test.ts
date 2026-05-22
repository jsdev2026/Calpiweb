import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGt = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockGetUser = vi.fn();

const mockChain = {
  select: mockSelect,
  eq: mockEq,
  gt: mockGt,
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
  delete: mockDelete,
  update: mockUpdate,
  upsert: mockUpsert,
  in: mockIn,
  order: mockOrder,
};

Object.values(mockChain).forEach((fn) => {
  (fn as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue(mockChain),
    auth: { getUser: mockGetUser },
  }),
}));

import { sharingDb } from './sharing';

describe('sharingDb.findUserByEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user when found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-2', display_name: 'Alice' }, error: null,
    });
    const result = await sharingDb.findUserByEmail('alice@example.com');
    expect(result).toEqual({ id: 'user-2', displayName: 'Alice' });
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await sharingDb.findUserByEmail('unknown@example.com');
    expect(result).toBeNull();
  });
});

describe('sharingDb.addShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a share row', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await sharingDb.addShare('proj-1', 'user-2', 'editor');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'proj-1', user_id: 'user-2', role: 'editor' }),
    );
  });

  it('throws on Supabase error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
    await expect(sharingDb.addShare('proj-1', 'user-2', 'editor')).rejects.toThrow('[23505]');
  });
});

describe('sharingDb.removeShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the share row', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await sharingDb.removeShare('proj-1', 'user-2');
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('sharingDb.acquireLock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns acquired when no active lock', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockUpsert.mockResolvedValueOnce({ error: null });
    const result = await sharingDb.acquireLock('proj-1');
    expect(result).toBe('acquired');
  });

  it('returns locked_by_other when another user holds the lock', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { locked_by: 'other-user', expires_at: new Date(Date.now() + 10000).toISOString() },
      error: null,
    });
    const result = await sharingDb.acquireLock('proj-1');
    expect(result).toBe('locked_by_other');
  });
});

describe('sharingDb.markNotificationsSeen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates unseen notifications', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await sharingDb.markNotificationsSeen();
    expect(mockUpdate).toHaveBeenCalledWith({ seen: true });
  });
});
