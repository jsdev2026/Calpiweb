'use client';

import { Grid, Plus } from 'lucide-react';
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
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-600 p-2">
            <Grid className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">TileLayout Pro</h1>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus size={18} /> Nouveau Projet
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-8">
        <h2 className="mb-6 text-2xl font-bold text-slate-800">Vos Projets</h2>
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
