'use client';

import { ChevronRight, Share2, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
}

const ROLE_LABELS: Record<string, string> = { viewer: 'Lecteur', editor: 'Éditeur' };

export const ProjectCard = ({ project, onOpen, onDelete, onShare }: ProjectCardProps) => {
  const isOwner = !project.myRole || project.myRole === 'owner';
  const roleLabel = !isOwner ? ROLE_LABELS[project.myRole ?? ''] : null;

  const handleDelete = (e: MouseEvent) => { e.stopPropagation(); onDelete(); };
  const handleShare = (e: MouseEvent) => { e.stopPropagation(); onShare(); };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="group flex h-64 cursor-pointer flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-sm transition-all duration-500 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-500/5"
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-zinc-200 transition-colors group-hover:text-blue-400">
            {project.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={handleShare}
                className="p-1 text-zinc-600 transition-colors hover:text-blue-400"
                aria-label="Partager le projet"
              >
                <Share2 size={14} />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 text-zinc-600 transition-colors hover:text-red-400"
                aria-label="Supprimer le projet"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs font-medium text-zinc-500">
          {project.rooms.length} pièce{project.rooms.length > 1 ? 's' : ''} —{' '}
          {project.rooms.reduce((n, r) => n + r.points.length, 0)} sommets
        </p>
        {roleLabel && (
          <span className="mt-2 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            {roleLabel}
          </span>
        )}
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
