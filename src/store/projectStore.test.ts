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
import { useProjectStore, selectActiveProject, selectRooms } from './projectStore';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

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

describe('projectStore — wall engine actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], activeProjectId: null, hydrated: false });
  });

  async function createAndInit() {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();
    useProjectStore.getState().initWallEngine();
  }

  it('initWallEngine sets wallEngine to empty nodes/walls', async () => {
    await createAndInit();
    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine).toEqual({ nodes: [], walls: [], excludedZones: [] });
  });

  it('addWall appends a wall to wallEngine', async () => {
    await createAndInit();
    const node1: WallNode = { id: 'n1', x: 0, y: 0 };
    const node2: WallNode = { id: 'n2', x: 100, y: 0 };
    useProjectStore.getState().addNode(node1);
    useProjectStore.getState().addNode(node2);
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    useProjectStore.getState().addWall(wall);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.walls).toHaveLength(1);
    expect(active?.wallEngine?.walls[0]).toEqual(wall);
  });

  it('removeWall removes a wall and orphan nodes', async () => {
    await createAndInit();
    const node1: WallNode = { id: 'n1', x: 0, y: 0 };
    const node2: WallNode = { id: 'n2', x: 100, y: 0 };
    useProjectStore.getState().addNode(node1);
    useProjectStore.getState().addNode(node2);
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().removeWall('w1');

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.walls).toHaveLength(0);
    expect(active?.wallEngine?.nodes).toHaveLength(0);
  });

  it('updateWall patches a wall by id', async () => {
    await createAndInit();
    const node1: WallNode = { id: 'n1', x: 0, y: 0 };
    const node2: WallNode = { id: 'n2', x: 100, y: 0 };
    useProjectStore.getState().addNode(node1);
    useProjectStore.getState().addNode(node2);
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().updateWall('w1', { thickness: 30 });

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.walls?.[0]?.thickness).toBe(30);
  });

  it('setWalls replaces the full walls list', async () => {
    await createAndInit();
    const node1: WallNode = { id: 'n1', x: 0, y: 0 };
    const node2: WallNode = { id: 'n2', x: 100, y: 0 };
    const node3: WallNode = { id: 'n3', x: 100, y: 100 };
    useProjectStore.getState().addNode(node1);
    useProjectStore.getState().addNode(node2);
    useProjectStore.getState().addNode(node3);
    const w1: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    const w2: Wall = { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 20 };
    useProjectStore.getState().addWall(w1);
    useProjectStore.getState().setWalls([w2]);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.walls).toHaveLength(1);
    expect(active?.wallEngine?.walls?.[0]?.id).toBe('w2');
  });

  it('addNode / updateNode / removeNode work correctly', async () => {
    await createAndInit();
    const node: WallNode = { id: 'n1', x: 0, y: 0 };
    useProjectStore.getState().addNode(node);

    let active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.nodes).toHaveLength(1);

    useProjectStore.getState().updateNode('n1', { x: 50, y: 50 });
    active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.nodes[0]).toEqual({ id: 'n1', x: 50, y: 50 });

    useProjectStore.getState().removeNode('n1');
    active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.nodes).toHaveLength(0);
  });

  it('setNodes replaces the full nodes list', async () => {
    await createAndInit();
    const n1: WallNode = { id: 'n1', x: 0, y: 0 };
    const n2: WallNode = { id: 'n2', x: 100, y: 0 };
    useProjectStore.getState().addNode(n1);
    useProjectStore.getState().setNodes([n2]);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.nodes).toHaveLength(1);
    expect(active?.wallEngine?.nodes?.[0]?.id).toBe('n2');
  });

  it('mergeNodes reassigns walls and removes dropId', async () => {
    await createAndInit();
    const n1: WallNode = { id: 'n1', x: 0, y: 0 };
    const n2: WallNode = { id: 'n2', x: 100, y: 0 };
    const n3: WallNode = { id: 'n3', x: 200, y: 0 };
    useProjectStore.getState().setNodes([n1, n2, n3]);
    const w1: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    const w2: Wall = { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 20 };
    useProjectStore.getState().setWalls([w1, w2]);

    // Merge n3 into n1 — w2 should become n2→n1
    useProjectStore.getState().mergeNodes('n1', 'n3');

    const active = selectActiveProject(useProjectStore.getState());
    // n3 should be gone
    expect(active?.wallEngine?.nodes.find((n) => n.id === 'n3')).toBeUndefined();
    // w2 node2Id should now be n1
    const w2updated = active?.wallEngine?.walls.find((w) => w.id === 'w2');
    expect(w2updated?.node2Id).toBe('n1');
    // w1 (n1→n2) still exists
    expect(active?.wallEngine?.walls).toHaveLength(2);
  });

  it('mergeNodes removes degenerate walls (node1Id === node2Id after merge)', async () => {
    await createAndInit();
    const n1: WallNode = { id: 'n1', x: 0, y: 0 };
    const n2: WallNode = { id: 'n2', x: 100, y: 0 };
    useProjectStore.getState().setNodes([n1, n2]);
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 };
    useProjectStore.getState().setWalls([wall]);

    // Merge n2 into n1 — wall becomes n1→n1, degenerate, should be removed
    useProjectStore.getState().mergeNodes('n1', 'n2');

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.wallEngine?.walls).toHaveLength(0);
    expect(active?.wallEngine?.nodes.find((n) => n.id === 'n2')).toBeUndefined();
  });
});

describe('selectRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], hydrated: false, activeProjectId: null });
  });

  it('returns [] when no active project', () => {
    expect(selectRooms(useProjectStore.getState())).toEqual([]);
  });

  it('returns project.rooms when wallEngine is undefined', () => {
    const rooms = [{ id: 'r1', name: 'R1', points: [{ x: 0, y: 0 }], edges: [] as never, partitions: [], excludedZones: [] }];
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms, wallEngine: undefined,
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    expect(selectRooms(useProjectStore.getState())).toBe(rooms);
  });

  it('returns [] from wallsToRooms when wallEngine has no walls', () => {
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms: [{ id: 'legacy', name: 'L', points: [], edges: [] as never, partitions: [], excludedZones: [] }],
        wallEngine: { walls: [], nodes: [], excludedZones: [] },
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    expect(selectRooms(useProjectStore.getState())).toEqual([]);
  });

  it('returns 1 room from wallsToRooms when wallEngine has a closed rectangle', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms: [],
        wallEngine: { walls, nodes, excludedZones: [] },
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    const result = selectRooms(useProjectStore.getState());
    expect(result).toHaveLength(1);
    expect(result[0]!.points).toHaveLength(4);
  });
});
