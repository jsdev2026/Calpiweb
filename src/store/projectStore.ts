import { create } from 'zustand';
import type { Project } from '@/types/project';
import type { Plan } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { projectsDb } from '@/lib/db';
import { generateId } from '@/utils/id';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  create: () => Promise<Project>;
  rename: (id: string, name: string) => void;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  updateActive: (updater: (project: Project) => Project) => void;
  setPlan: (plan: Plan) => void;
  setConfig: (config: TilingConfig) => void;
}

const sortByUpdatedDesc = (a: Project, b: Project) => b.updatedAt - a.updatedAt;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const all = await projectsDb.getAll();
    set({ projects: all.sort(sortByUpdatedDesc), hydrated: true });
  },

  create: async () => {
    const now = Date.now();
    const newProject: Project = {
      id: generateId(),
      name: `Nouveau projet ${get().projects.length + 1}`,
      createdAt: now,
      updatedAt: now,
      plan: [],
      config: { ...DEFAULT_TILING_CONFIG },
    };
    await projectsDb.save(newProject);
    set({
      projects: [newProject, ...get().projects],
      activeProjectId: newProject.id,
    });
    return newProject;
  },

  rename: (id, name) => {
    set({
      projects: get().projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
    });
    const target = get().projects.find((p) => p.id === id);
    if (target) void projectsDb.save(target);
  },

  remove: async (id) => {
    await projectsDb.delete(id);
    set({
      projects: get().projects.filter((p) => p.id !== id),
      activeProjectId: get().activeProjectId === id ? null : get().activeProjectId,
    });
  },

  setActive: (id) => set({ activeProjectId: id }),

  updateActive: (updater) => {
    const id = get().activeProjectId;
    if (!id) return;
    const next = get().projects.map((p) => (p.id === id ? { ...updater(p), updatedAt: Date.now() } : p));
    set({ projects: next });
    const updated = next.find((p) => p.id === id);
    if (updated) void projectsDb.save(updated);
  },

  setPlan: (plan) => get().updateActive((p) => ({ ...p, plan })),
  setConfig: (config) => get().updateActive((p) => ({ ...p, config })),
}));

export const selectActiveProject = (state: ProjectState): Project | null =>
  state.projects.find((p) => p.id === state.activeProjectId) ?? null;
