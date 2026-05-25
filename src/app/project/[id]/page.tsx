'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FileDown, LogOut, Moon, Settings, Sun, Trash2, X } from 'lucide-react';
import { PlanEditor } from '@/components/plan/PlanEditor';
import { TilingEditor } from '@/components/tiling/TilingEditor';
import { QuantitiesPanel } from '@/components/quantities/QuantitiesPanel';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { useSharingStore } from '@/store/sharingStore';
import type { ProjectStatus } from '@/types/project';

type WorkspaceTab = 'PLAN' | 'TILING' | 'QUANTITIES';

const STATUS_CYCLE: Record<ProjectStatus, ProjectStatus> = { new: 'wip', wip: 'done', done: 'new' };
const STATUS_LABELS: Record<ProjectStatus, string> = { new: 'Nouveau', wip: 'En cours', done: 'Terminé' };
const STATUS_CLASS: Record<ProjectStatus, string> = { new: 'tag-new', wip: 'tag-wip', done: 'tag-ok' };

const TAB_ICONS: Record<WorkspaceTab, JSX.Element> = {
  PLAN: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5h12M5 5v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  TILING: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" fillOpacity=".4"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" fillOpacity=".4"/></svg>
  ),
  QUANTITIES: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
};

// ── Project Settings Modal ─────────────────────────────────────────────────

interface SettingsModalProps {
  projectName: string;
  description: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  notes: { id: string; text: string; createdAt: number; authorName: string }[];
  onSave: (data: { name: string; description: string; clientName: string; clientPhone: string; clientEmail: string; clientAddress: string }) => void;
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
}

const SettingsModal = ({
  projectName, description, clientName, clientPhone, clientEmail, clientAddress,
  notes, onSave, onAddNote, onDeleteNote, onClose,
}: SettingsModalProps) => {
  const [name, setName] = useState(projectName);
  const [desc, setDesc] = useState(description);
  const [cName, setCName] = useState(clientName);
  const [cPhone, setCPhone] = useState(clientPhone);
  const [cEmail, setCEmail] = useState(clientEmail);
  const [cAddr, setCAddr] = useState(clientAddress);
  const [noteText, setNoteText] = useState('');
  const [tab, setTab] = useState<'info' | 'notes'>('info');

  const handleSave = () => {
    onSave({ name, description: desc, clientName: cName, clientPhone: cPhone, clientEmail: cEmail, clientAddress: cAddr });
    onClose();
  };

  const handleAddNote = () => {
    const t = noteText.trim();
    if (!t) return;
    onAddNote(t);
    setNoteText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex w-full max-w-lg flex-col rounded-2xl shadow-2xl" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--bdr)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Paramètres du projet</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Informations et notes</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--bdr)' }}>
          {(['info', 'notes'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className="px-5 py-2.5 text-[13px] font-medium transition-colors"
              style={tab === t
                ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)', background: 'transparent' }
                : { color: 'var(--text2)', borderBottom: '2px solid transparent' }}>
              {t === 'info' ? 'Informations' : `Notes ${notes.length > 0 ? `(${notes.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'info' && (
            <div className="flex flex-col gap-4">
              <Field label="Nom du projet">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              </Field>
              <Field label="Description">
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                  placeholder="Description du chantier, contexte…"
                  className="w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              </Field>
              <div className="h-px" style={{ background: 'var(--bdr)' }} />
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Client</p>
              <Field label="Nom">
                <input value={cName} onChange={(e) => setCName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone">
                  <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} type="tel"
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
                </Field>
                <Field label="E-mail">
                  <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} type="email"
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
                </Field>
              </div>
              <Field label="Adresse">
                <input value={cAddr} onChange={(e) => setCAddr(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }} />
              </Field>
            </div>
          )}

          {tab === 'notes' && (
            <div className="flex flex-col gap-3">
              {/* New note input */}
              <div className="flex gap-2">
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2}
                  placeholder="Ajouter une note…"
                  className="flex-1 resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddNote(); } }} />
                <button type="button" className="btn-primary self-start px-3 py-2 text-[12px]" onClick={handleAddNote}>
                  Ajouter
                </button>
              </div>
              {/* Notes list */}
              {notes.length === 0 && (
                <p className="py-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>Aucune note pour le moment</p>
              )}
              {notes.map((note) => (
                <div key={note.id} className="group rounded-lg p-3" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      {note.authorName} · {new Date(note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button type="button" onClick={() => onDeleteNote(note.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: 'var(--muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px]" style={{ color: 'var(--text)' }}>{note.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--bdr)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          {tab === 'info' && (
            <button type="button" className="btn-primary" onClick={handleSave}>Enregistrer</button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11.5px] font-semibold" style={{ color: 'var(--text2)' }}>{label}</label>
    {children}
  </div>
);

// ── Workspace Page ─────────────────────────────────────────────────────────

interface WorkspacePageProps {
  params: { id: string };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  const router = useRouter();

  const hydrated = useProjectStore((s) => s.hydrated);
  const hydrate = useProjectStore((s) => s.hydrate);
  const setActive = useProjectStore((s) => s.setActive);
  const activeProject = useProjectStore(selectActiveProject);
  const rename = useProjectStore((s) => s.rename);
  const setConfig = useProjectStore((s) => s.setConfig);
  const setStatus = useProjectStore((s) => s.setStatus);
  const setProjectInfo = useProjectStore((s) => s.setProjectInfo);
  const addNote = useProjectStore((s) => s.addNote);
  const removeNote = useProjectStore((s) => s.removeNote);

  const acquireLock = useSharingStore((s) => s.acquireLock);
  const releaseLock = useSharingStore((s) => s.releaseLock);
  const refreshLock = useSharingStore((s) => s.refreshLock);

  const [lockStatus, setLockStatus] = useState<'idle' | 'acquired' | 'locked_by_other'>('idle');
  const [lockInfo, setLockInfo] = useState<{ lockedByDisplayName: string } | null>(null);

  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);
  const user = useUiStore((s) => s.user);
  const logout = useUiStore((s) => s.logout);

  const [tab, setTab] = useState<WorkspaceTab>('PLAN');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (tab === 'PLAN') return;
    const style = document.createElement('style');
    style.id = '__cp_print__';
    style.textContent = `@media print { body * { visibility: hidden !important; } #print-target, #print-target * { visibility: visible !important; overflow: visible !important; max-height: none !important; } #print-target { position: absolute !important; inset: 0 !important; width: 100% !important; height: auto !important; } }`;
    document.head.appendChild(style);
    window.addEventListener('afterprint', () => document.getElementById('__cp_print__')?.remove(), { once: true });
    window.print();
  }, [tab]);

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated) setActive(id); }, [id, hydrated, setActive]);

  useEffect(() => {
    if (!hydrated || !activeProject) return;
    const isEditor = activeProject.myRole === 'editor' || activeProject.myRole === 'owner';
    if (!isEditor) return;

    void acquireLock(id).then((status) => {
      setLockStatus(status);
      if (status === 'locked_by_other' && activeProject.lock) {
        setLockInfo({ lockedByDisplayName: activeProject.lock.lockedByDisplayName });
      }
    });

    return () => {
      void releaseLock(id);
      setLockInfo(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hydrated, activeProject?.myRole]);

  useEffect(() => {
    if (lockStatus !== 'acquired') return;
    const interval = setInterval(() => { void refreshLock(id); }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [id, lockStatus]);

  useEffect(() => {
    if (!activeProject) return;
    const isEditor = activeProject.myRole === 'editor' || activeProject.myRole === 'owner';
    if (!isEditor) return;
    const handler = () => { void releaseLock(id); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [id, activeProject?.myRole]);

  useEffect(() => {
    if (lockStatus !== 'locked_by_other') return;
    const interval = setInterval(async () => {
      const status = await acquireLock(id);
      setLockStatus(status);
      if (status === 'acquired') setLockInfo(null);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [id, lockStatus]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
        Chargement…
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
        <p>Projet introuvable.</p>
        <button type="button" className="btn-secondary" onClick={() => router.push('/')}>Retour à l&apos;accueil</button>
      </div>
    );
  }

  const canGoTiling = activeProject.rooms.some((r) => r.points.length >= 3);
  const roomCount = activeProject.rooms.filter(r => r.points.length >= 3).length;
  const isReadOnly = lockStatus === 'locked_by_other' || activeProject.myRole === 'viewer';
  const initials = user?.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'CP';
  const planLabel: Record<string, string> = { free: 'Gratuit', pro: 'Pro', team: 'Équipe' };

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Topbar */}
      <header className="shell-topbar px-5 gap-0">
        {/* Logo */}
        <div className="hidden md:flex items-center gap-2 mr-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: 'var(--accent)' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white"/>
              <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>CaléPlan</span>
        </div>

        <div className="hidden md:block h-4 w-px mx-3" style={{ background: 'var(--bdr)' }} />

        {/* Mobile-only back button */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex md:hidden btn-icon mr-1"
          aria-label="Retour aux projets"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--text2)' }}>
          <button type="button" onClick={() => router.push('/dashboard')} className="hover:underline hidden md:inline" style={{ color: 'var(--text2)' }}>
            Projets
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="hidden md:block" style={{ opacity: 0.4 }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            readOnly={isReadOnly}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              color: 'var(--text)', minWidth: 120, maxWidth: 260,
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surf2)'; e.target.style.borderRadius = 'var(--rs)'; e.target.style.padding = '2px 6px'; }}
            onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.padding = '0'; }}
          />
        </div>

        <div className="hidden md:block mx-3 h-4 w-px" style={{ background: 'var(--bdr)' }} />

        {/* Status badge */}
        <button
          type="button"
          onClick={() => setStatus(STATUS_CYCLE[activeProject.status])}
          title="Cliquer pour changer le statut"
          className={`hidden md:inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-75 ${STATUS_CLASS[activeProject.status]}`}
        >
          {STATUS_LABELS[activeProject.status]}
        </button>

        {/* Client */}
        {activeProject.client?.name && (
          <div className="hidden md:flex mx-3 items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 10c0-2 2-3.5 4.5-3.5S10.5 8 10.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span>{activeProject.client.name}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{new Date(activeProject.updatedAt).toLocaleDateString('fr-FR')}</span>
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={toggleDarkMode} className="btn-icon" aria-label="Thème">
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className="hidden md:flex btn-secondary items-center gap-1.5 text-[12.5px]"
            style={{ padding: '5px 10px' }}
            onClick={handlePrint}
            disabled={tab === 'PLAN'}
          >
            <FileDown size={13} /> PDF
          </button>
          <button type="button" className="btn-icon" aria-label="Paramètres" onClick={() => setShowSettings(true)} disabled={isReadOnly}>
            <Settings size={14} />
          </button>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 rounded-[var(--rs)] px-2 py-1.5 transition-colors"
              style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
              <div className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--accent)' }}>{initials}</div>
              {user?.plan && <span className="tag-pro rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{planLabel[user.plan] ?? user.plan}</span>}
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
                  onClick={() => { setShowUserMenu(false); router.push('/auth?tab=plans'); }}
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
      </header>

      {/* Lock banner */}
      {lockStatus === 'locked_by_other' && (
        <div
          className="flex items-center gap-2 border-b px-5 py-2 text-[12px]"
          style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'var(--bdr)', color: '#f97316' }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 6V4.5a2 2 0 1 1 4 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Édition en cours par{' '}
          <strong>{lockInfo?.lockedByDisplayName ?? 'un autre utilisateur'}</strong>.{' '}
          Vous êtes en lecture seule.
        </div>
      )}

      {/* Tab bar */}
      <div className="shell-tabs px-1">
        {([
          { id: 'PLAN', label: 'Plan 2D' },
          { id: 'TILING', label: 'Calepinage' },
          { id: 'QUANTITIES', label: 'Quantitatif', badge: roomCount > 0 ? roomCount : undefined },
        ] as { id: WorkspaceTab; label: string; badge?: number }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.id !== 'PLAN' && !canGoTiling}
            onClick={() => canGoTiling || t.id === 'PLAN' ? setTab(t.id) : undefined}
            className={`shell-tab${tab === t.id ? ' active' : ''}${t.id !== 'PLAN' && !canGoTiling ? ' opacity-40 cursor-not-allowed' : ''}`}
          >
            {TAB_ICONS[t.id]}
            {t.label}
            {t.badge !== undefined && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--surf3)', color: 'var(--text2)' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex flex-1 overflow-hidden">
        {tab === 'PLAN' && <PlanEditor onNavigateBack={() => router.push('/')} />}
        {tab === 'QUANTITIES' && (
          <div id="print-target" className="flex flex-1 overflow-hidden">
            <QuantitiesPanel />
          </div>
        )}
        {tab === 'TILING' && (
          <div id="print-target" className="flex flex-1 overflow-hidden">
            <TilingEditor
              rooms={activeProject.rooms}
              config={activeProject.config}
              wallThickness={activeProject.wallThickness}
              setConfig={setConfig}
            />
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          projectName={activeProject.name}
          description={activeProject.description ?? ''}
          clientName={activeProject.client?.name ?? ''}
          clientPhone={activeProject.client?.phone ?? ''}
          clientEmail={activeProject.client?.email ?? ''}
          clientAddress={activeProject.client?.address ?? ''}
          notes={activeProject.notes}
          onSave={({ name, description, clientName, clientPhone, clientEmail, clientAddress }) => {
            setProjectInfo({
              name,
              description,
              client: clientName ? { name: clientName, phone: clientPhone, email: clientEmail, address: clientAddress } : undefined,
            });
          }}
          onAddNote={(text) => addNote(text, user?.name ?? 'Utilisateur')}
          onDeleteNote={removeNote}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
