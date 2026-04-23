'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}

export const ProjectCard = ({ project, onOpen, onDelete }: ProjectCardProps) => {
  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className="group flex h-64 cursor-pointer flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-sm transition-all duration-500 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-500/5"
    >
      <div>
        <div className="mb-2 flex items-start justify-between">
          <h3 className="line-clamp-2 text-lg font-bold text-zinc-200 transition-colors group-hover:text-blue-400">
            {project.name}
          </h3>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 text-zinc-600 transition-colors hover:text-red-400"
            aria-label="Supprimer le projet"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <p className="text-xs font-medium text-zinc-500">
          {project.rooms.length} pièce{project.rooms.length > 1 ? 's' : ''} —{' '}
          {project.rooms.reduce((n, r) => n + r.points.length, 0)} sommets
        </p>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-tighter text-zinc-600">
            Dernière édition
          </p>
          <p className="font-mono text-xs text-zinc-400">
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-all group-hover:bg-blue-600 group-hover:text-white">
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
};
