import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the browser client before importing db
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockGetUser = vi.fn();

const mockChain = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  upsert: mockUpsert,
  delete: mockDelete,
};

// Each method returns mockChain so calls can be chained
mockSelect.mockReturnValue(mockChain);
mockEq.mockReturnValue(mockChain);
mockOrder.mockReturnValue(mockChain);
mockDelete.mockReturnValue(mockChain);

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
    width: 300, height: 600, joint: 3,
    offsetX: 0, offsetY: 0, stagger: 33,
    angle: 0, chevronAngle: 45,
    color: '#93c5fd', layout: 'STRAIGHT',
  },
  wallThickness: 100,
  constraints: [],
  notes: [],
});

describe('supabaseDb.getAll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns projects from Supabase rows', async () => {
    const p = makeProject();
    mockOrder.mockResolvedValueOnce({ data: [{ data: p }], error: null });
    const result = await supabaseDb.getAll();
    expect(result).toEqual([p]);
  });

  it('returns empty array when no data', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
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
  beforeEach(() => vi.clearAllMocks());

  it('upserts project with user_id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockUpsert.mockResolvedValueOnce({ error: null });
    const p = makeProject();
    await supabaseDb.save(p);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj-1', user_id: 'user-1', name: 'Test' }),
    );
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

  it('returns profile plan', async () => {
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const profile = await supabaseDb.getProfile();
    expect(profile.plan).toBe('pro');
  });
});
