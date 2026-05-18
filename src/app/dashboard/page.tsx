'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { List, LayoutGrid, LogOut, Moon, Plus, Search, Settings, Sun, X } from 'lucide-react';
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

// ── Plan miniature ────────────────────────────────────────────────────────────

const PlanMiniature = ({ project, size = 140 }: { project: Project; size?: number }) => {
  const allPoints = project.rooms.flatMap((r) => r.points);
  if (allPoints.length < 3) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--surf2)' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.18 }}>
          <rect x="3" y="3" width="12" height="12" rx="2" fill="var(--text)"/>
          <rect x="17" y="3" width="12" height="12" rx="2" fill="var(--text)"/>
          <rect x="3" y="17" width="12" height="12" rx="2" fill="var(--text)"/>
          <rect x="17" y="17" width="12" height="12" rx="2" fill="var(--text)"/>
        </svg>
      </div>
    );
  }

  const pad = 10;
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const s = (size - pad * 2) / Math.max(w, h);
  const ox = (size - w * s) / 2 - minX * s;
  const oy = (size - h * s) / 2 - minY * s;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--surf2)' }}>
      {project.rooms.map((room) => {
        if (room.points.length < 3) return null;
        const pts = room.points.map((p) => `${p.x * s + ox},${p.y * s + oy}`).join(' ');
        return (
          <g key={room.id}>
            <polygon points={pts} fill="var(--surf3)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
};

// ── Project quick-settings modal ─────────────────────────────────────────────

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'new', label: 'Nouveau' },
  { value: 'wip', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
];

const ProjectSettingsModal = ({
  project,
  onClose,
  onSave,
}: {
  project: Project;
  onClose: () => void;
  onSave: (name: string, status: ProjectStatus, client: ClientInfo | undefined) => void;
}) => {
  const addNote = useProjectStore((s) => s.addNote);
  const removeNote = useProjectStore((s) => s.removeNote);
  const updateNote = useProjectStore((s) => s.updateNote);
  const user = useUiStore((s) => s.user);

  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [clientName, setClientName] = useState(project.client?.name ?? '');
  const [clientPhone, setClientPhone] = useState(project.client?.phone ?? '');
  const [clientEmail, setClientEmail] = useState(project.client?.email ?? '');
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleSave = () => {
    const client: ClientInfo | undefined = clientName.trim()
      ? { name: clientName.trim(), phone: clientPhone.trim() || undefined, email: clientEmail.trim() || undefined }
      : undefined;
    onSave(name.trim() || project.name, status, client);
    onClose();
  };

  const handleAddNote = () => {
    const text = noteText.trim();
    if (!text) return;
    addNote(text, user?.name ?? 'Utilisateur');
    setNoteText('');
  };

  const startEdit = (note: { id: string; text: string }) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
  };

  const commitEdit = () => {
    if (editingNoteId && editingText.trim()) {
      updateNote(editingNoteId, editingText.trim());
    }
    setEditingNoteId(null);
  };

  const fieldStyle = { background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 'var(--rs)', padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%' };
  const labelStyle = { fontSize: 11, fontWeight: 600 as const, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block' as const, marginBottom: 4 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-2xl shadow-2xl" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Paramètres du projet</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 transition-colors" style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          <div>
            <label style={labelStyle}>Nom du projet</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
          </div>

          <div>
            <label style={labelStyle}>Statut</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                  className="flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all"
                  style={status === opt.value
                    ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                    : { background: 'var(--surf2)', color: 'var(--text2)', border: '1px solid var(--bdr)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>Client</label>
            <div className="space-y-2">
              <input placeholder="Nom" value={clientName} onChange={(e) => setClientName(e.target.value)} style={fieldStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              <input placeholder="Téléphone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={fieldStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              <input placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} style={fieldStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>Notes</label>
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Ajouter une note… (Ctrl+Entrée)"
                rows={2}
                style={{ ...fieldStyle, resize: 'none', lineHeight: '1.5' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="shrink-0 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)', alignSelf: 'flex-end', paddingTop: 7, paddingBottom: 7 }}
              >
                Ajouter
              </button>
            </div>

            {project.notes.length > 0 && (
              <div className="mt-3 space-y-2">
                {project.notes.map((note) => (
                  <div key={note.id} className="group rounded-lg p-3" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
                    {editingNoteId === note.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitEdit(); }
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                          rows={3}
                          style={{ background: 'var(--surf)', border: '1px solid var(--accent)', borderRadius: 'var(--rs)', padding: '6px 8px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%', resize: 'none', lineHeight: '1.5' }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={commitEdit}
                            className="rounded-md px-3 py-1 text-[12px] font-semibold text-white"
                            style={{ background: 'var(--accent)' }}>
                            Enregistrer
                          </button>
                          <button type="button" onClick={() => setEditingNoteId(null)}
                            className="rounded-md px-3 py-1 text-[12px] font-medium"
                            style={{ background: 'var(--surf3)', color: 'var(--text2)' }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            onClick={() => startEdit(note)}
                            style={{ fontSize: 13, color: 'var(--text)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'text' }}
                            title="Cliquer pour modifier"
                          >{note.text}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                            {note.authorName} · {new Date(note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNote(note.id)}
                          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: 'var(--muted)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--bdr)' }}>
          <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--surf2)', color: 'var(--text2)', border: '1px solid var(--bdr)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf3)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}>
            Annuler
          </button>
          <button type="button" onClick={handleSave} className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-d)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'; }}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Project card (grid view) ──────────────────────────────────────────────────

const ProjectCard = ({
  project, onOpen, onDelete, onSettings,
}: { project: Project; onOpen: () => void; onDelete: () => void; onSettings: (e: React.MouseEvent) => void }) => {
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); };
  const handleSettings = (e: React.MouseEvent) => { e.stopPropagation(); onSettings(e); };

  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group cursor-pointer overflow-hidden rounded-[var(--r)] border transition-all duration-200"
      style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', boxShadow: 'var(--sh)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-md)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh)'; }}
    >
      {/* Miniature */}
      <div className="relative overflow-hidden" style={{ height: 140 }}>
        <PlanMiniature project={project} size={140} />
        <button
          type="button" onClick={handleSettings}
          aria-label="Paramètres"
          className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: 'var(--surf)', color: 'var(--muted)', border: '1px solid var(--bdr)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}>
          <Settings size={11} />
        </button>
        <button
          type="button" onClick={handleDelete}
          aria-label="Supprimer"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: 'var(--surf)', color: 'var(--muted)', border: '1px solid var(--bdr)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1m1 0l-.7 8a.5.5 0 01-.5.5H5.2a.5.5 0 01-.5-.5l-.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Body */}
      <div className="p-3.5">
        <h3 className="line-clamp-1 text-[14px] font-semibold leading-snug" style={{ color: 'var(--text)' }}>{project.name}</h3>
        {project.client?.name && (
          <p className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--text2)' }}>{project.client.name}</p>
        )}
        <p className="mt-1 text-[11.5px]" style={{ color: 'var(--muted)' }}>
          {project.rooms.length} pièce{project.rooms.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-3.5 py-2" style={{ borderColor: 'var(--bdr)' }}>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
          {new Date(project.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>
    </div>
  );
};

// ── Project row (list view) ───────────────────────────────────────────────────

const ProjectRow = ({
  project, onOpen, onDelete, onSettings,
}: { project: Project; onOpen: () => void; onDelete: () => void; onSettings: (e: React.MouseEvent) => void }) => {
  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(); };
  const handleSettings = (e: React.MouseEvent) => { e.stopPropagation(); onSettings(e); };

  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group flex cursor-pointer items-center gap-4 rounded-[var(--rs)] border px-4 py-3 transition-all"
      style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', boxShadow: 'var(--sh)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surf2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surf)'; }}
    >
      {/* Mini thumbnail */}
      <div className="shrink-0 overflow-hidden rounded" style={{ width: 48, height: 48 }}>
        <PlanMiniature project={project} size={48} />
      </div>

      {/* Info */}
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{project.name}</h3>
          <p className="truncate text-[12px]" style={{ color: 'var(--text2)' }}>
            {project.client?.name || '—'} · {project.rooms.length} pièce{project.rooms.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
        <span className="shrink-0 w-24 text-right text-[12px]" style={{ color: 'var(--muted)' }}>
          {new Date(project.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Settings + Delete */}
      <button
        type="button" onClick={handleSettings}
        className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}>
        <Settings size={14} />
      </button>
      <button
        type="button" onClick={handleDelete}
        className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1m1 0l-.7 8a.5.5 0 01-.5.5H5.2a.5.5 0 01-.5-.5l-.7-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list';

export default function DashboardPage() {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const hydrate = useProjectStore((s) => s.hydrate);
  const createProject = useProjectStore((s) => s.create);
  const removeProject = useProjectStore((s) => s.remove);
  const setActive = useProjectStore((s) => s.setActive);

  const user = useUiStore((s) => s.user);
  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);
  const logout = useUiStore((s) => s.logout);

  const setProjectInfo = useProjectStore((s) => s.setProjectInfo);
  const setStatus = useProjectStore((s) => s.setStatus);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void hydrate(); }, [hydrate]);


  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async (name: string, client: ClientInfo | undefined) => {
    setCreateError(null);
    try {
      const project = await createProject({ name, client });
      router.push(`/project/${project.id}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'PROJECT_LIMIT_REACHED') {
        setShowNewModal(false);
      } else {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        setCreateError(msg);
        console.error('Erreur création projet:', err);
      }
    }
  };

  const handleOpen = (project: Project) => {
    setActive(project.id);
    router.push(`/project/${project.id}`);
  };

  const handleSaveSettings = (name: string, status: ProjectStatus, client: ClientInfo | undefined) => {
    if (!settingsProjectId) return;
    setActive(settingsProjectId);
    setProjectInfo({ name, client });
    setStatus(status);
  };

  const settingsProject = settingsProjectId
    ? projects.find((p) => p.id === settingsProjectId) ?? null
    : null;

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
  const planLabel: Record<'free' | 'pro', string> = { free: 'Gratuit', pro: 'Pro' };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>

      {/* Topbar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center border-b px-4 md:px-6"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', minHeight: 'var(--topbar)' }}>

        {/* Row 1 */}
        <div className="flex h-[var(--topbar)] w-full items-center md:contents">
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

          {/* Desktop: separator + search */}
          <div className="mx-4 hidden h-5 w-px md:block" style={{ background: 'var(--bdr)' }} />
          <div className="relative hidden md:block">
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

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search toggle — mobile only */}
            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="btn-icon md:hidden" aria-label="Rechercher">
              <Search size={15} />
            </button>

            {/* View toggle — desktop only */}
            <div className="hidden md:flex rounded-[var(--rs)] p-0.5" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
              <button type="button" onClick={() => setViewMode('grid')} className="flex h-6 w-6 items-center justify-center rounded transition-colors"
                style={viewMode === 'grid' ? { background: 'var(--surf)', color: 'var(--accent)', boxShadow: 'var(--sh)' } : { color: 'var(--muted)' }}>
                <LayoutGrid size={13} />
              </button>
              <button type="button" onClick={() => setViewMode('list')} className="flex h-6 w-6 items-center justify-center rounded transition-colors"
                style={viewMode === 'list' ? { background: 'var(--surf)', color: 'var(--accent)', boxShadow: 'var(--sh)' } : { color: 'var(--muted)' }}>
                <List size={13} />
              </button>
            </div>

            {/* Dark mode toggle */}
            <button type="button" onClick={toggleDarkMode} className="btn-icon" aria-label="Basculer le thème">
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* User avatar + menu */}
            <div className="relative" ref={userMenuRef}>
              <button type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2.5 rounded-[var(--rs)] px-2.5 py-1.5 transition-colors"
                style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
                <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials}</div>
                <span className="hidden sm:block" style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{user?.name ?? 'Utilisateur'}</span>
                {user?.plan && (
                  <span className="tag-pro hidden sm:block rounded-full px-2 py-0.5 text-[10px] font-semibold">{planLabel[user.plan]}</span>
                )}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl p-1 shadow-xl"
                  style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
                  <div className="px-3 py-2">
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? 'Utilisateur'}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{user?.email ?? ''}</p>
                  </div>
                  <div className="my-1 h-px" style={{ background: 'var(--bdr)' }} />
                  <button type="button"
                    onClick={() => { setShowUserMenu(false); router.push('/account'); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors"
                    style={{ color: 'var(--text2)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L9 5h4l-3.2 2.4 1.2 3.9L7 9.1 3 11.3l1.2-3.9L1 5h4L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    Changer de forfait
                  </button>
                  <button type="button"
                    onClick={() => void logout().then(() => router.push('/auth'))}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surf2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    <LogOut size={13} />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Search expanded (mobile only) */}
        {searchOpen && (
          <div className="w-full pb-2 md:hidden">
            <div className="relative">
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un projet…"
                autoFocus
                style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 'var(--rs)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 px-7 py-6">
        <div className="mb-6">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }} className="mb-0.5">Mes projets</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Bonjour {user?.name?.split(' ')[0] ?? ''} — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Error banner */}
        {createError && (
          <div className="mb-5 flex items-center justify-between rounded-xl border px-5 py-3" style={{ background: '#fef2f2', borderColor: '#ef4444' }}>
            <p className="text-[13px]" style={{ color: '#dc2626' }}>Erreur : {createError}</p>
            <button type="button" onClick={() => setCreateError(null)} style={{ color: '#dc2626', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className={`kpi-card${k.accent ? ' accent' : ''}`}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: k.accent ? 'var(--accent)' : 'var(--text)' }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Upsell banner — free users at project limit */}
        {user?.plan === 'free' && projects.length >= 1 && (
          <div className="mb-5 flex items-center justify-between rounded-xl border px-5 py-3" style={{ background: 'var(--accent-l)', borderColor: 'var(--accent)' }}>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>Limite du plan gratuit atteinte</p>
              <p className="text-[12px]" style={{ color: 'var(--accent)' }}>Passez Pro pour créer des projets illimités — 9 €/mois</p>
            </div>
            <a href="/account" className="btn-primary shrink-0 px-4 py-2 text-[12px]">Passer Pro →</a>
          </div>
        )}

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

        {/* Grid view — always on mobile, toggled on desktop */}
        <div className={viewMode === 'list' ? 'block md:hidden' : 'block'}>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => handleOpen(p)}
                onDelete={() => { if (confirm('Supprimer ce projet ?')) void removeProject(p.id); }}
                onSettings={() => { setActive(p.id); setSettingsProjectId(p.id); }}
              />
            ))}
            {/* New project card — hidden on mobile (FAB is used instead) */}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="group hidden md:flex flex-col items-center justify-center gap-3 rounded-[var(--r)] border-2 border-dashed transition-all"
              style={{ minHeight: 200, borderColor: 'var(--bdr2)', color: 'var(--muted)', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-l)'; el.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--bdr2)'; el.style.background = 'transparent'; el.style.color = 'var(--muted)'; }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--surf3)' }}>
                <Plus size={22} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Nouveau projet</span>
            </button>
          </div>
        </div>

        {/* List view — desktop only */}
        {viewMode === 'list' && (
          <div className="hidden md:flex flex-col gap-2">
            <div className="grid grid-cols-[48px_1fr_120px_140px_32px] items-center gap-4 px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              <span />
              <span>Projet</span>
              <span className="text-center">Statut</span>
              <span className="text-right">Modifié</span>
              <span />
            </div>
            {filtered.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onOpen={() => handleOpen(p)}
                onDelete={() => { if (confirm('Supprimer ce projet ?')) void removeProject(p.id); }}
                onSettings={() => { setActive(p.id); setSettingsProjectId(p.id); }}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-3 rounded-[var(--rs)] border-2 border-dashed px-4 py-3 transition-all"
              style={{ borderColor: 'var(--bdr2)', color: 'var(--muted)', cursor: 'pointer', background: 'transparent' }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-l)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = 'var(--bdr2)'; el.style.color = 'var(--muted)'; el.style.background = 'transparent'; }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: 'var(--surf3)' }}>
                <Plus size={16} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Nouveau projet</span>
            </button>
          </div>
        )}
      </main>

      {/* FAB — mobile only */}
      <button
        type="button"
        onClick={() => setShowNewModal(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl md:hidden"
        style={{ background: 'var(--accent)', color: '#fff' }}
        aria-label="Nouveau projet"
      >
        <Plus size={26} />
      </button>

      {showNewModal && (
        <NewProjectModal
          defaultProjectName={`Nouveau projet ${projects.length + 1}`}
          onConfirm={(name, client) => { setShowNewModal(false); void handleCreate(name, client); }}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      {settingsProject && (
        <ProjectSettingsModal
          project={settingsProject}
          onClose={() => setSettingsProjectId(null)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
