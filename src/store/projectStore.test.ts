import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/db', () => ({
  supabaseDb: {
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getProfile: vi.fn(),
  },
}));

import { supabaseDb } from '@/lib/supabase/db';
import { useProjectStore, selectActiveProject } from './projectStore';
import type { Wall } from '@/types/wall';

const mockSupabaseDb = vi.mocked(supabaseDb);

describe('projectStore — free plan limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests
    useProjectStore.setState({ projects: [], hydrated: false });
  });

  it('allows creating a project when under the free limit', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    useProjectStore.setState({ projects: [] });

    const project = await useProjectStore.getState().create();
    expect(project.id).toBeDefined();
  });

  it('throws PROJECT_LIMIT_REACHED for free users at 1 project', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    const existing = {
      id: 'existing', name: 'Existing', status: 'new' as const,
      createdAt: 1000, updatedAt: 1000, rooms: [], config: {} as never,
      wallThickness: 100, constraints: [], notes: [],
    };
    useProjectStore.setState({ projects: [existing] });

    await expect(useProjectStore.getState().create()).rejects.toThrow('PROJECT_LIMIT_REACHED');
  });

  it('allows creating a project for pro users regardless of count', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'pro' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    const existing = {
      id: 'existing', name: 'Existing', status: 'new' as const,
      createdAt: 1000, updatedAt: 1000, rooms: [], config: {} as never,
      wallThickness: 100, constraints: [], notes: [],
    };
    useProjectStore.setState({ projects: [existing] });

    const project = await useProjectStore.getState().create();
    expect(project.id).toBeDefined();
  });
});

describe('projectStore — wall actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], activeProjectId: null, hydrated: false });
  });

  it('addWall appends a wall to the active project', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toHaveLength(1);
    expect(active?.walls?.[0]).toEqual(wall);
  });

  it('removeWall removes a wall by id', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().removeWall('w1');

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls ?? []).toHaveLength(0);
  });

  it('updateWall patches a wall by id', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().updateWall('w1', { thickness: 30 });

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls?.[0].thickness).toBe(30);
  });

  it('setWalls replaces the full walls list', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const w1: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    const w2: Wall = { id: 'w2', p1: { x: 100, y: 0 }, p2: { x: 100, y: 100 }, thickness: 20 };
    useProjectStore.getState().addWall(w1);
    useProjectStore.getState().setWalls([w2]);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toHaveLength(1);
    expect(active?.walls?.[0].id).toBe('w2');
  });

  it('initWallEngine sets walls to empty array', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    useProjectStore.getState().initWallEngine();

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toEqual([]);
  });
});
