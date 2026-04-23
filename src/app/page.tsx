'use client';

import { Grid, Home, Plus, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ProjectList } from '@/components/home/ProjectList';
import { useProjectStore } from '@/store/projectStore';
import type { Project } from '@/types/project';

export default function HomePage() {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const hydrate = useProjectStore((s) => s.hydrate);
  const createProject = useProjectStore((s) => s.create);
  const removeProject = useProjectStore((s) => s.remove);
  const setActive = useProjectStore((s) => s.setActive);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const handleCreate = async () => {
    const project = await createProject();
    router.push(`/project/${project.id}`);
  };

  const handleOpen = (project: Project) => {
    setActive(project.id);
    router.push(`/project/${project.id}`);
  };

  const handleDelete = (project: Project) => {
    if (confirm('Supprimer ce projet ?')) {
      void removeProject(project.id);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Logo */}
        <div className="border-b border-zinc-800 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 shadow-lg shadow-orange-900/30">
              <Grid size={20} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-zinc-50">TILEA</span>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Calepinage Pro
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400"
          >
            <Home size={18} /> Accueil
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <Grid size={18} /> Projets
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <Settings size={18} /> Préférences
          </button>
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <Button onClick={handleCreate} className="w-full justify-center">
            <Plus size={16} /> Nouveau projet
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-10">
        <h2 className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <div className="h-px w-8 bg-zinc-800" /> Travaux récents
        </h2>
        <ProjectList
          projects={projects}
          onCreate={handleCreate}
          onOpen={handleOpen}
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}
