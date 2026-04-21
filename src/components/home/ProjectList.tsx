'use client';

import { FolderOpen } from 'lucide-react';
import type { Project } from '@/types/project';
import { Button } from '@/components/ui/Button';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: Project[];
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export const ProjectList = ({ projects, onCreate, onOpen, onDelete }: ProjectListProps) => {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <FolderOpen size={48} className="mx-auto mb-4 text-slate-300" />
        <h3 className="text-lg font-medium text-slate-700">Aucun projet</h3>
        <p className="mb-6 mt-1 text-slate-500">Commencez par créer votre premier calepinage.</p>
        <Button onClick={onCreate}>Créer un projet</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => onDelete(p)} />
      ))}
    </div>
  );
};
