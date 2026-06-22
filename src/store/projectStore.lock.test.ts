import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase/db', () => ({
  supabaseDb: {
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getProfile: vi.fn(),
  },
}));

import { useProjectStore } from './projectStore';

const INITIAL_PROJECT = {
  id: 'p1',
  name: 'Test',
  status: 'new' as const,
  createdAt: 1000,
  updatedAt: 1000,
  rooms: [],
  config: {} as never,
  wallThickness: 100,
  constraints: [],
  notes: [],
  wallEngine: {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    walls: [],
    excludedZones: [],
  },
};

describe('updateNode — locked field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({
      projects: [INITIAL_PROJECT],
      activeProjectId: 'p1',
    });
  });

  it('persists locked: true on a node', () => {
    const { updateNode } = useProjectStore.getState();
    updateNode('n1', { locked: true });
    const node = useProjectStore.getState()
      .projects[0]!.wallEngine!.nodes.find((n) => n.id === 'n1');
    expect(node?.locked).toBe(true);
  });

  it('persists locked: false on a node', () => {
    useProjectStore.setState((s) => ({
      projects: s.projects.map((p) =>
        p.id === 'p1'
          ? {
              ...p,
              wallEngine: {
                ...p.wallEngine!,
                nodes: [{ id: 'n1', x: 0, y: 0, locked: true }],
              },
            }
          : p,
      ),
    }));
    const { updateNode } = useProjectStore.getState();
    updateNode('n1', { locked: false });
    const node = useProjectStore.getState()
      .projects[0]!.wallEngine!.nodes.find((n) => n.id === 'n1');
    expect(node?.locked).toBe(false);
  });
});
