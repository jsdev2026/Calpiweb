'use client';

import { Plus } from 'lucide-react';
import type { Project } from '@/types/project';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: Project[];
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export const ProjectList = ({ projects, onCreate, onOpen, onDelete }: ProjectListProps) => (
  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {projects.map((p) => (
      <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => onDelete(p)} />
    ))}
    <button
      type="button"
      onClick={onCreate}
      className="group flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-zinc-800 text-zinc-600 transition-all hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-500/60"
    >
      <div className="rounded-full bg-zinc-900 p-4 transition-colors group-hover:bg-blue-500/10">
        <Plus size={40} />
      </div>
      <span className="text-xs font-black uppercase tracking-[0.2em]">Créer un projet</span>
    </button>
  </div>
);
