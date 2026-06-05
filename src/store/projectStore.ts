import { create } from 'zustand';
import type { Project, Room, EdgeType, ProjectStatus, ClientInfo, Constraint, ProjectNote, TilingDimension } from '@/types/project';
import type { Plan, Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import type { Wall, WallNode, WallExcludedZone, DoorOpening } from '@/types/wall';
import { supabaseDb } from '@/lib/supabase/db';
import { wallsToRooms } from '@/engine/geometry/wallFaces';
import { generateId } from '@/utils/id';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { WALL_THICKNESS_MM } from '@/constants/businessRules';

export interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  create: (data?: { name?: string; client?: ClientInfo }) => Promise<Project>;
  rename: (id: string, name: string) => void;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  updateActive: (updater: (project: Project) => Project) => void;

  addRoom: () => string;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, points: Plan, edges: EdgeType[]) => void;
  renameRoom: (roomId: string, name: string) => void;
  renameWallRoom: (roomId: string, name: string) => void;

  setConfig: (config: TilingConfig) => void;
  setWallThickness: (mm: number) => void;
  setStatus: (status: ProjectStatus) => void;
  setClient: (client: ClientInfo) => void;
  setProjectInfo: (info: { name?: string; description?: string; client?: ClientInfo }) => void;

  addNote: (text: string, authorName: string) => void;
  removeNote: (noteId: string) => void;
  updateNote: (noteId: string, text: string) => void;

  // Constraint actions
  addConstraint: (c: Constraint) => void;
  removeConstraint: (id: string) => void;
  updateConstraintValue: (id: string, value: Constraint['value']) => void;
  updateConstraintDisplayOffset: (id: string, offset: number) => void;
  /** Shift vertex indices for a given room when vertices are inserted/removed. */
  shiftConstraintIndices: (roomId: string, afterIdx: number, delta: number) => void;

  restoreSnapshot: (
    rooms: Room[],
    constraints: Constraint[],
    wallEngine?: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] }
  ) => void;

  // Partition actions
  addPartition: (roomId: string, p1: Point, p2: Point, thickness: number) => void;
  updatePartition: (roomId: string, partitionId: string, p1: Point, p2: Point) => void;
  removePartition: (roomId: string, partitionId: string) => void;
  updatePartitionThickness: (roomId: string, partitionId: string, thickness: number) => void;
  setEdgeThickness: (roomId: string, edgeIdx: number, thickness: number) => void;

  // Excluded zone actions
  addExcludedZone: (roomId: string, points: Point[]) => void;
  removeExcludedZone: (roomId: string, zoneId: string) => void;
  updateExcludedZonePoints: (roomId: string, zoneId: string, points: Point[]) => void;

  clearPartitionsAndZones: (roomId: string) => void;

  // Wall engine — node actions
  addNode: (node: WallNode) => void;
  updateNode: (id: string, patch: Partial<Pick<WallNode, 'x' | 'y'>>) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: WallNode[]) => void;
  mergeNodes: (keepId: string, dropId: string) => void;
  // Wall engine — wall actions
  addWall: (wall: Wall) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  setWalls: (walls: Wall[]) => void;
  initWallEngine: () => void;
  addWallExcludedZone: (points: Point[]) => void;
  removeWallExcludedZone: (id: string) => void;
  splitWall: (wallId: string, newNode: WallNode) => void;

  // Tiling dimension actions
  addTilingDimension: (dim: TilingDimension) => void;
  removeTilingDimension: (id: string) => void;
  updateTilingDimensionPerpOffset: (id: string, perpOffset: number) => void;
  updateTilingDimension: (id: string, patch: Partial<TilingDimension>) => void;
}

/** Pure helper — splits a wall at newNode, returns new wallEngine state. */
export function splitWallInEngine(
  we: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] },
  wallId: string,
  newNode: WallNode,
): { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] } {
  const wall = we.walls.find(w => w.id === wallId);
  if (!wall) return we;
  const wall1: Wall = { ...wall, id: generateId(), node1Id: wall.node1Id, node2Id: newNode.id };
  const wall2: Wall = { ...wall, id: generateId(), node1Id: newNode.id,  node2Id: wall.node2Id };
  return {
    ...we,
    nodes: [...we.nodes, newNode],
    walls:  [...we.walls.filter(w => w.id !== wallId), wall1, wall2],
  };
}

const sortByUpdatedDesc = (a: Project, b: Project) => b.updatedAt - a.updatedAt;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const all = await supabaseDb.getAll();
    set({ projects: all.sort(sortByUpdatedDesc), hydrated: true });
  },

  create: async (data) => {
    const profile = await supabaseDb.getProfile();
    if (profile.plan === 'free' && get().projects.length >= 1) {
      throw new Error('PROJECT_LIMIT_REACHED');
    }
    const now = Date.now();
    const newProject: Project = {
      id: generateId(),
      name: data?.name ?? `Nouveau projet ${get().projects.length + 1}`,
      client: data?.client,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      rooms: [],
      wallEngine: { nodes: [], walls: [], excludedZones: [] },
      config: { ...DEFAULT_TILING_CONFIG },
      wallThickness: WALL_THICKNESS_MM,
      constraints: [],
      notes: [],
    };
    await supabaseDb.save(newProject);
    set({ projects: [newProject, ...get().projects], activeProjectId: newProject.id });
    return newProject;
  },

  rename: (id, name) => {
    set({ projects: get().projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)) });
    const target = get().projects.find((p) => p.id === id);
    if (target) void supabaseDb.save(target);
  },

  remove: async (id) => {
    await supabaseDb.delete(id);
    set({
      projects: get().projects.filter((p) => p.id !== id),
      activeProjectId: get().activeProjectId === id ? null : get().activeProjectId,
    });
  },

  setActive: (id) => set({ activeProjectId: id }),

  updateActive: (updater) => {
    const id = get().activeProjectId;
    if (!id) return;
    const next = get().projects.map((p) =>
      p.id === id ? { ...updater(p), updatedAt: Date.now() } : p,
    );
    set({ projects: next });
    const updated = next.find((p) => p.id === id);
    if (updated) void supabaseDb.save(updated);
  },

  addRoom: () => {
    const id = generateId();
    get().updateActive((p) => ({ ...p, rooms: [...p.rooms, { id, points: [], edges: [], partitions: [], excludedZones: [] }] }));
    return id;
  },

  removeRoom: (roomId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.filter((r) => r.id !== roomId),
      constraints: p.constraints.filter((c) => c.pts.every((ref) => ref.roomId !== roomId)),
    }));
  },

  updateRoom: (roomId, points, edges) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, points, edges } : r)),
    }));
  },

  renameRoom: (roomId, name) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)),
    }));
  },

  renameWallRoom: (roomId, name) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        wallEngine: {
          ...p.wallEngine,
          wallRoomNames: { ...(p.wallEngine.wallRoomNames ?? {}), [roomId]: name },
        },
      };
    });
  },

  setConfig: (config) => get().updateActive((p) => ({ ...p, config })),
  setWallThickness: (mm) => get().updateActive((p) => ({ ...p, wallThickness: mm })),
  setStatus: (status) => get().updateActive((p) => ({ ...p, status })),
  setClient: (client) => get().updateActive((p) => ({ ...p, client })),
  setProjectInfo: ({ name, description, client }) => {
    get().updateActive((p) => ({
      ...p,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(client !== undefined ? { client } : {}),
    }));
  },

  addNote: (text, authorName) => {
    const note: ProjectNote = { id: generateId(), text, createdAt: Date.now(), authorName };
    get().updateActive((p) => ({ ...p, notes: [note, ...p.notes] }));
  },
  removeNote: (noteId) => {
    get().updateActive((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) }));
  },
  updateNote: (noteId: string, text: string) => {
    get().updateActive((p) => ({
      ...p,
      notes: p.notes.map((n) => (n.id === noteId ? { ...n, text } : n)),
    }));
  },

  addConstraint: (c) => {
    get().updateActive((p) => ({ ...p, constraints: [...p.constraints, c] }));
  },

  removeConstraint: (id) => {
    get().updateActive((p) => ({ ...p, constraints: p.constraints.filter((c) => c.id !== id) }));
  },

  updateConstraintValue: (id, value) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) => (c.id === id ? { ...c, value } : c)),
    }));
  },

  updateConstraintDisplayOffset: (id, offset) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) =>
        c.id === id ? { ...c, displayOffset: offset } : c
      ),
    }));
  },

  shiftConstraintIndices: (roomId, afterIdx, delta) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) => ({
        ...c,
        pts: c.pts.map((ref) =>
          ref.roomId === roomId && ref.vertexIdx > afterIdx
            ? { ...ref, vertexIdx: ref.vertexIdx + delta }
            : ref,
        ),
      })),
    }));
  },

  restoreSnapshot: (rooms, constraints, wallEngine) => {
    get().updateActive((p) => ({
      ...p,
      rooms,
      constraints,
      ...(wallEngine !== undefined
        ? { wallEngine: { ...wallEngine, wallRoomNames: p.wallEngine?.wallRoomNames } }
        : {}),
    }));
  },

  addPartition: (roomId, p1, p2, thickness) => {
    const id = generateId();
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: [...(r.partitions ?? []), { id, p1, p2, thickness }] } : r,
      ),
    }));
  },

  updatePartition: (roomId, partitionId, p1, p2) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: (r.partitions ?? []).map((pt) => pt.id === partitionId ? { ...pt, p1, p2 } : pt) } : r,
      ),
    }));
  },

  removePartition: (roomId, partitionId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: (r.partitions ?? []).filter((pt) => pt.id !== partitionId) } : r,
      ),
    }));
  },

  setEdgeThickness: (roomId, edgeIdx, thickness) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const thicknesses = [...(r.edgeThicknesses ?? new Array(r.edges.length).fill(undefined) as (number | undefined)[])];
        thicknesses[edgeIdx] = thickness;
        return { ...r, edgeThicknesses: thicknesses };
      }),
    }));
  },

  updatePartitionThickness: (roomId, partitionId, thickness) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId
          ? { ...r, partitions: (r.partitions ?? []).map((pt) => pt.id === partitionId ? { ...pt, thickness } : pt) }
          : r,
      ),
    }));
  },

  addExcludedZone: (roomId, points) => {
    const id = generateId();
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, excludedZones: [...(r.excludedZones ?? []), { id, points }] } : r,
      ),
    }));
  },

  removeExcludedZone: (roomId, zoneId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, excludedZones: (r.excludedZones ?? []).filter((z) => z.id !== zoneId) } : r,
      ),
      constraints: p.constraints.filter((c) => !c.pts.some((pt) => pt.roomId === zoneId)),
    }));
  },

  updateExcludedZonePoints: (roomId, zoneId, points) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId
          ? { ...r, excludedZones: (r.excludedZones ?? []).map((z) => (z.id === zoneId ? { ...z, points } : z)) }
          : r,
      ),
    }));
  },

  clearPartitionsAndZones: (roomId) => {
    get().updateActive((p) => {
      const zoneIds = new Set((p.rooms.find((r) => r.id === roomId)?.excludedZones ?? []).map((z) => z.id));
      return {
        ...p,
        rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, partitions: [], excludedZones: [] } : r)),
        constraints: p.constraints.filter((c) => !c.pts.some((pt) => zoneIds.has(pt.roomId))),
      };
    });
  },

  addNode: (node) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes: [...p.wallEngine.nodes, node] } };
    });
  },

  updateNode: (id, patch) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        wallEngine: {
          ...p.wallEngine,
          nodes: p.wallEngine.nodes.map((n) => n.id === id ? { ...n, ...patch } : n),
        },
      };
    });
  },

  removeNode: (id) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes: p.wallEngine.nodes.filter((n) => n.id !== id) } };
    });
  },

  setNodes: (nodes) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes } };
    });
  },

  mergeNodes: (keepId, dropId) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      const walls = p.wallEngine.walls
        .map((w) => ({
          ...w,
          node1Id: w.node1Id === dropId ? keepId : w.node1Id,
          node2Id: w.node2Id === dropId ? keepId : w.node2Id,
        }))
        .filter((w) => w.node1Id !== w.node2Id);
      const nodes = p.wallEngine.nodes.filter((n) => n.id !== dropId);
      return { ...p, wallEngine: { nodes, walls, excludedZones: p.wallEngine.excludedZones ?? [] } };
    });
  },

  addWall: (wall) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, walls: [...p.wallEngine.walls, wall] } };
    });
  },

  removeWall: (id) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      const walls = p.wallEngine.walls.filter((w) => w.id !== id);
      const referencedIds = new Set(walls.flatMap((w) => [w.node1Id, w.node2Id]));
      const nodes = p.wallEngine.nodes.filter((n) => referencedIds.has(n.id));
      return { ...p, wallEngine: { nodes, walls, excludedZones: p.wallEngine.excludedZones ?? [] } };
    });
  },

  updateWall: (id, patch) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        wallEngine: {
          ...p.wallEngine,
          walls: p.wallEngine.walls.map((w) => w.id === id ? { ...w, ...patch } : w),
        },
      };
    });
  },

  setWalls: (walls) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, walls } };
    });
  },

  initWallEngine: () => {
    get().updateActive((p) => ({
      ...p,
      wallEngine: p.wallEngine ?? { nodes: [], walls: [], excludedZones: [] },
    }));
  },

  addWallExcludedZone: (points) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        wallEngine: {
          ...p.wallEngine,
          excludedZones: [
            ...(p.wallEngine.excludedZones ?? []),
            { id: generateId(), points },
          ],
        },
      };
    });
  },

  removeWallExcludedZone: (id) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        wallEngine: {
          ...p.wallEngine,
          excludedZones: (p.wallEngine.excludedZones ?? []).filter(z => z.id !== id),
        },
      };
    });
  },

  splitWall: (wallId, newNode) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: splitWallInEngine(p.wallEngine, wallId, newNode) };
    });
  },

  addTilingDimension: (dim) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: [...(p.tilingDimensions ?? []), dim],
  })),

  removeTilingDimension: (id) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).filter((d) => d.id !== id),
  })),

  updateTilingDimensionPerpOffset: (id, perpOffset) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, perpOffset } : d,
    ),
  })),

  updateTilingDimension: (id, patch) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, ...patch } : d,
    ),
  })),
}));

export const selectActiveProject = (state: ProjectState): Project | null =>
  state.projects.find((p) => p.id === state.activeProjectId) ?? null;

export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we !== undefined) {
    const rooms = wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
    const names = we.wallRoomNames ?? {};
    return rooms.map((r) => {
      const customName = names[r.id];
      return customName ? { ...r, name: customName } : r;
    });
  }
  return project.rooms;
}

export function selectDoorOpenings(s: ProjectState): DoorOpening[] {
  const project = selectActiveProject(s);
  if (!project?.wallEngine) return [];
  const { walls, nodes } = project.wallEngine;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return walls
    .filter((w) => w.isDoor)
    .flatMap((w) => {
      const n1 = nodeMap.get(w.node1Id);
      const n2 = nodeMap.get(w.node2Id);
      if (!n1 || !n2) return [];
      return [{ from: { x: n1.x, y: n1.y }, to: { x: n2.x, y: n2.y }, thickness: w.thickness }];
    });
}
