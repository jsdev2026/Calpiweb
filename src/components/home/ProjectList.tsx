'use client';

import { useEffect } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Project } from '@/types/project';
import { useSharingStore } from '@/store/sharingStore';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: Project[];
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
  onShare: (project: Project) => void;
}

export const ProjectList = ({ projects, onCreate, onOpen, onDelete, onShare }: ProjectListProps) => {
  const { unseenCount, loadNotifications, markNotificationsSeen } = useSharingStore();

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const ownProjects = projects.filter((p) => !p.myRole || p.myRole === 'owner');
  const sharedProjects = projects.filter((p) => p.myRole === 'viewer' || p.myRole === 'editor');

  const handleOpenShared = (project: Project) => {
    void markNotificationsSeen();
    onOpen(project);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Mes projets */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Mes projets
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ownProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpen(p)}
              onDelete={() => onDelete(p)}
              onShare={() => onShare(p)}
            />
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
      </section>

      {/* Partagés avec moi */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Partagés avec moi
          </h2>
          {unseenCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
              {unseenCount}
            </span>
          )}
        </div>
        {sharedProjects.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-800">
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <Users size={20} />
              <span className="text-xs">Aucun projet partagé avec vous</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sharedProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => handleOpenShared(p)}
                onDelete={() => onDelete(p)}
                onShare={() => onShare(p)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
