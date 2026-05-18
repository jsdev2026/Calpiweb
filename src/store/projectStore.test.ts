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
import { useProjectStore } from './projectStore';

const mockSupabaseDb = supabaseDb as {
  getAll: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getProfile: ReturnType<typeof vi.fn>;
};

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
