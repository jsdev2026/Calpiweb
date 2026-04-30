'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Plus, Search, Sun } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import type { Project, ProjectStatus } from '@/types/project';
import { NewProjectModal } from '@/components/NewProjectModal';
import type { ClientInfo } from '@/types/project';

const STATUS_LABELS: Record<ProjectStatus, string> = { new: 'Nouveau', wip: 'En cours', done: 'Terminé' };
const STATUS_CLASS: Record<ProjectStatus, string> = { new: 'tag-new', wip: 'tag-wip', done: 'tag-ok' };

type Filter = 'all' | ProjectStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'new', label: 'Nouveaux' },
  { id: 'wip', label: 'En cours' },
  { id: 'done', label: 'Terminés' },
];

// ─── Project card ─────────────────────────────────────────────────────────────

const ProjectCard = ({
  project,
  onOpen,
  onDelete,
}: { project: Project; onOpen: () => void; onDelete: () => void }) => {
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group cursor-pointer overflow-hidden rounded-[var(--r)] border transition-all duration-200"
      style={{
        background: 'var(--surf)',
        borderColor: 'var(--bdr)',
        boxShadow: 'var(--sh)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-md)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh)'; }}
    >
      {/* Miniature placeholder */}
      <div className="flex h-[140px] items-center justify-center" style={{ background: 'var(--surf2)' }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.2 }}>
          <rect x="4" y="4" width="15" height="15" rx="2" fill="var(--text)"/>
          <rect x="21" y="4" width="15" height="15" rx="2" fill="var(--text)"/>
          <rect x="4" y="21" width="15" height="15" rx="2" fill="var(--text)"/>
          <rect x="21" y="21" width="15" height="15" rx="2" fill="var(--text)"/>
        </svg>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3
            className="line-clamp-1 flex-1 text-[15px] font-semibold leading-snug"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
          >
            {project.name}
          </h3>
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Supprimer"
            className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1m1 0l-.7 8a.5.5 0 01-.5.5H5.2a.5.5 0 01-.5-.5l-.7-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        {project.client?.name && (
          <p className="mb-2 truncate text-[12.5px]" style={{ color: 'var(--text2)' }}>{project.client.name}</p>
        )}
        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
          {project.rooms.length} pièce{project.rooms.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-2.5" style={{ borderColor: 'var(--bdr)' }}>
        <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {new Date(project.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const hydrate = useProjectStore((s) => s.hydrate);
  const createProject = useProjectStore((s) => s.create);
  const removeProject = useProjectStore((s) => s.remove);
  const setActive = useProjectStore((s) => s.setActive);

  const user = useUiStore((s) => s.user);
  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    if (user === null && typeof window !== 'undefined') {
      const raw = localStorage.getItem('caleplan_user');
      if (!raw) router.push('/auth');
    }
  }, [user, router]);

  const handleCreate = async (name: string, client: ClientInfo | undefined) => {
    const project = await createProject({ name, client });
    router.push(`/project/${project.id}`);
  };

  const handleOpen = (project: Project) => {
    setActive(project.id);
    router.push(`/project/${project.id}`);
  };

  const filtered = projects.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const kpis = [
    { label: 'Total projets', value: projects.length },
    { label: 'Nouveaux', value: projects.filter(p => p.status === 'new').length },
    { label: 'En cours', value: projects.filter(p => p.status === 'wip').length },
    { label: 'Terminés', value: projects.filter(p => p.status === 'done').length, accent: true },
  ];

  const initials = user?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'CP';
  const planLabel: Record<string, string> = { free: 'Gratuit', pro: 'Pro', team: 'Équipe' };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>

      {/* Topbar */}
      <header className="shell-topbar px-6" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white"/>
              <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>CaléPlan</span>
        </div>

        {/* Separator */}
        <div className="mx-4 h-5 w-px" style={{ background: 'var(--bdr)' }} />

        {/* Search */}
        <div className="relative">
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            style={{ width: 240, paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Dark mode toggle */}
          <button type="button" onClick={toggleDarkMode} className="btn-icon" aria-label="Basculer le thème">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Avatar */}
          <div className="flex items-center gap-2.5 rounded-[var(--rs)] px-2.5 py-1.5" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
            <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials}</div>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{user?.name ?? 'Utilisateur'}</span>
            {user?.plan && (
              <span className="tag-pro rounded-full px-2 py-0.5 text-[10px] font-semibold">{planLabel[user.plan]}</span>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 px-7 py-6">
        <div className="mb-6">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }} className="mb-0.5">Mes projets</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Bonjour {user?.name?.split(' ')[0] ?? ''} — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className={`kpi-card${k.accent ? ' accent' : ''}`}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: k.accent ? 'var(--accent)' : 'var(--text)' }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={filter === f.id
                ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
                : { background: 'var(--surf)', color: 'var(--text2)', border: '1px solid var(--bdr2)', borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => handleOpen(p)}
              onDelete={() => { if (confirm('Supprimer ce projet ?')) void removeProject(p.id); }}
            />
          ))}

          {/* New project card */}
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="group flex flex-col items-center justify-center gap-3 rounded-[var(--r)] border-2 border-dashed transition-all"
            style={{ minHeight: 200, borderColor: 'var(--bdr2)', color: 'var(--muted)', cursor: 'pointer', background: 'transparent' }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'var(--accent)';
              el.style.background = 'var(--accent-l)';
              el.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'var(--bdr2)';
              el.style.background = 'transparent';
              el.style.color = 'var(--muted)';
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--surf3)' }}>
              <Plus size={22} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Nouveau projet</span>
          </button>
        </div>
      </main>

      {showNewModal && (
        <NewProjectModal
          defaultProjectName={`Nouveau projet ${projects.length + 1}`}
          onConfirm={(name, client) => { setShowNewModal(false); void handleCreate(name, client); }}
          onCancel={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
