'use client';

import { Trash2 } from 'lucide-react';
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
      className="group flex h-48 cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between">
        <h3 className="truncate font-semibold text-slate-800 group-hover:text-blue-600">
          {project.name}
        </h3>
        <button
          type="button"
          onClick={handleDelete}
          className="p-1 text-slate-400 hover:text-red-500"
          aria-label="Supprimer le projet"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex-1 space-y-2 text-sm text-slate-500">
        <p>Dernière modif : {new Date(project.updatedAt).toLocaleDateString()}</p>
        <p>{project.plan.length > 2 ? 'Plan dessiné' : 'Plan vide'}</p>
        <p>
          Format : {project.config.width}×{project.config.height} mm
        </p>
      </div>
    </div>
  );
};
