import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the browser client before importing db
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockGetUser = vi.fn();
const mockIn = vi.fn();
const mockGt = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

const mockChain = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  upsert: mockUpsert,
  delete: mockDelete,
  in: mockIn,
  gt: mockGt,
  update: mockUpdate,
  insert: mockInsert,
};

// Each method returns mockChain so calls can be chained
const resetChain = () => {
  mockSelect.mockReturnValue(mockChain);
  mockEq.mockReturnValue(mockChain);
  mockOrder.mockReturnValue(mockChain);
  mockDelete.mockReturnValue(mockChain);
  mockIn.mockReturnValue(mockChain);
  mockGt.mockReturnValue(mockChain);
  mockUpdate.mockReturnValue(mockChain);
};
resetChain();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue(mockChain),
    auth: { getUser: mockGetUser },
  }),
}));

import { supabaseDb } from './db';
import type { Project } from '@/types/project';

const makeProject = (id = 'proj-1'): Project => ({
  id,
  name: 'Test',
  status: 'new',
  createdAt: 1000,
  updatedAt: 1000,
  rooms: [],
  config: {
    width: 300,
    height: 600,
    joint: 3,
    offsetX: 0,
    offsetY: 0,
    stagger: 33,
    angle: 0,
    chevronAngle: 45,
    color: '#93c5fd',
    layout: 'STRAIGHT',
  },
  wallThickness: 100,
  constraints: [],
  notes: [],
});

describe('supabaseDb.getAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('returns projects from Supabase rows', async () => {
    const p = makeProject();
    mockOrder.mockResolvedValueOnce({
      data: [{ id: p.id, user_id: 'user-1', data: p }],
      error: null,
    });
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    mockGt.mockResolvedValueOnce({ data: [], error: null });
    const result = await supabaseDb.getAll();
    expect(result[0]).toMatchObject({ id: p.id, name: p.name });
  });

  it('returns empty array when no data', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    const result = await supabaseDb.getAll();
    expect(result).toEqual([]);
  });

  it('returns empty array when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await supabaseDb.getAll();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    await expect(supabaseDb.getAll()).rejects.toThrow('DB error');
  });
});

describe('supabaseDb.get', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a project when found', async () => {
    const p = makeProject('proj-42');
    mockSingle.mockResolvedValueOnce({ data: { data: p }, error: null });
    const result = await supabaseDb.get('proj-42');
    expect(result).toEqual(p);
  });

  it('returns undefined when not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('not found') });
    const result = await supabaseDb.get('missing');
    expect(result).toBeUndefined();
  });
});

describe('supabaseDb.save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('met à jour un projet existant sans jamais toucher user_id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'editor-2' } } });
    // update(...).eq(...).select('id') → une ligne mise à jour
    mockSelect.mockResolvedValueOnce({ data: [{ id: 'proj-1' }], error: null });
    await supabaseDb.save({ ...makeProject(), myRole: 'editor' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ user_id: expect.anything() }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }));
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('insère un nouveau projet avec user_id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockSelect.mockResolvedValueOnce({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({ error: null });
    await supabaseDb.save(makeProject());
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj-1', user_id: 'user-1', name: 'Test' }),
    );
  });

  it('traduit le refus RLS en PROJECT_LIMIT_REACHED', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockSelect.mockResolvedValueOnce({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    await expect(supabaseDb.save(makeProject())).rejects.toThrow('PROJECT_LIMIT_REACHED');
  });

  it("ne recrée jamais à son nom un projet partagé qu'il ne peut pas modifier", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'viewer-3' } } });
    mockSelect.mockResolvedValueOnce({ data: [], error: null });
    await expect(supabaseDb.save({ ...makeProject(), myRole: 'viewer' })).rejects.toThrow(
      'PROJECT_READ_ONLY',
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('throws when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(supabaseDb.save(makeProject())).rejects.toThrow('NOT_AUTHENTICATED');
  });
});

describe('supabaseDb.delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes project by id', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await supabaseDb.delete('proj-1');
    expect(mockEq).toHaveBeenCalledWith('id', 'proj-1');
  });
});

describe('supabaseDb.getProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns profile plan when profile exists', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const profile = await supabaseDb.getProfile();
    expect(profile.plan).toBe('pro');
  });

  it('returns project credits', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { plan: 'free', project_credits: 2 },
      error: null,
    });
    expect(await supabaseDb.getProfile()).toEqual({ plan: 'free', projectCredits: 2 });
  });

  it('returns free plan when profile row does not exist', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const profile = await supabaseDb.getProfile();
    expect(profile.plan).toBe('free');
  });

  it('returns free plan when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const profile = await supabaseDb.getProfile();
    expect(profile.plan).toBe('free');
  });

  it('throws on Supabase error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'XXXXX', message: 'DB error' },
    });
    await expect(supabaseDb.getProfile()).rejects.toThrow('[XXXXX] DB error');
  });
});

describe('supabaseDb.getAll — with shared projects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets myRole to owner when user_id matches', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const p = makeProject();
    // projects query
    mockOrder.mockResolvedValueOnce({
      data: [{ id: p.id, user_id: 'user-1', data: p }],
      error: null,
    });
    // shares query
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    // locks query — mockGt is the terminal call (after .in())
    mockGt.mockResolvedValueOnce({ data: [], error: null });

    const result = await supabaseDb.getAll();
    expect(result[0]?.myRole).toBe('owner');
  });

  it('sets myRole to editor for shared project', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const p = makeProject('shared-proj');
    mockOrder.mockResolvedValueOnce({
      data: [{ id: p.id, user_id: 'user-99', data: p }],
      error: null,
    });
    mockOrder.mockResolvedValueOnce({ data: [{ project_id: p.id, role: 'editor' }], error: null });
    mockGt.mockResolvedValueOnce({ data: [], error: null });

    const result = await supabaseDb.getAll();
    expect(result[0]?.myRole).toBe('editor');
  });
});
