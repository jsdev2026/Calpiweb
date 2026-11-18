'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Trash2, X } from 'lucide-react';
import { PlanEditor, type WorkspaceMode } from '@/components/plan/PlanEditor';
import { ProjectHeader, type ProjectSettingsTab } from '@/components/project/ProjectHeader';
import { Tutorial } from '@/components/onboarding/Tutorial';
import { useTutorialStore } from '@/store/tutorialStore';
import { modeFromParam, modeHref } from '@/components/project/workspaceMode';
import {
  QuantitiesPrintView,
  type PrintCompany,
} from '@/components/quantities/QuantitiesPrintView';
import { profileDb } from '@/lib/supabase/profile';
import {
  selectActiveProject,
  selectDoorOpenings,
  selectRooms,
  useProjectStore,
} from '@/store/projectStore';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '@/store/uiStore';
import { useSharingStore } from '@/store/sharingStore';

// ── Project Settings Modal ─────────────────────────────────────────────────

interface SettingsModalProps {
  projectName: string;
  description: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  notes: { id: string; text: string; createdAt: number; authorName: string }[];
  onSave: (data: {
    name: string;
    description: string;
    clientName: string;
    clientPhone: string;
    clientEmail: string;
    clientAddress: string;
  }) => void;
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
  /** Onglet ouvert à l'affichage */
  initialTab?: ProjectSettingsTab;
}

const SettingsModal = ({
  projectName,
  description,
  clientName,
  clientPhone,
  clientEmail,
  clientAddress,
  notes,
  onSave,
  onAddNote,
  onDeleteNote,
  onClose,
  initialTab = 'info',
}: SettingsModalProps) => {
  const [name, setName] = useState(projectName);
  const [desc, setDesc] = useState(description);
  const [cName, setCName] = useState(clientName);
  const [cPhone, setCPhone] = useState(clientPhone);
  const [cEmail, setCEmail] = useState(clientEmail);
  const [cAddr, setCAddr] = useState(clientAddress);
  const [noteText, setNoteText] = useState('');
  const [tab, setTab] = useState<ProjectSettingsTab>(initialTab);

  const handleSave = () => {
    onSave({
      name,
      description: desc,
      clientName: cName,
      clientPhone: cPhone,
      clientEmail: cEmail,
      clientAddress: cAddr,
    });
    onClose();
  };

  const handleAddNote = () => {
    const t = noteText.trim();
    if (!t) return;
    onAddNote(t);
    setNoteText('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl shadow-2xl"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--bdr)' }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Paramètres du projet
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Informations et notes
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--bdr)' }}>
          {(['info', 'notes'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-5 py-2.5 text-[13px] font-medium transition-colors"
              style={
                tab === t
                  ? {
                      color: 'var(--accent)',
                      borderBottom: '2px solid var(--accent)',
                      background: 'transparent',
                    }
                  : { color: 'var(--text2)', borderBottom: '2px solid transparent' }
              }
            >
              {t === 'info'
                ? 'Informations'
                : `Notes ${notes.length > 0 ? `(${notes.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'info' && (
            <div className="flex flex-col gap-4">
              <Field label="Nom du projet">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--bdr)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--bdr)';
                  }}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="Description du chantier, contexte…"
                  className="w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--bdr)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--bdr)';
                  }}
                />
              </Field>
              <div className="h-px" style={{ background: 'var(--bdr)' }} />
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                Client
              </p>
              <Field label="Nom">
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--bdr)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--bdr)';
                  }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone">
                  <input
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    type="tel"
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{
                      background: 'var(--surf2)',
                      border: '1px solid var(--bdr)',
                      color: 'var(--text)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--bdr)';
                    }}
                  />
                </Field>
                <Field label="E-mail">
                  <input
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    type="email"
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                    style={{
                      background: 'var(--surf2)',
                      border: '1px solid var(--bdr)',
                      color: 'var(--text)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--bdr)';
                    }}
                  />
                </Field>
              </div>
              <Field label="Adresse">
                <input
                  value={cAddr}
                  onChange={(e) => setCAddr(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--bdr)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--bdr)';
                  }}
                />
              </Field>
            </div>
          )}

          {tab === 'notes' && (
            <div className="flex flex-col gap-3">
              {/* New note input */}
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Ajouter une note…"
                  className="flex-1 resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
                  style={{
                    background: 'var(--surf2)',
                    border: '1px solid var(--bdr)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--bdr)';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-primary self-start px-3 py-2 text-[12px]"
                  onClick={handleAddNote}
                >
                  Ajouter
                </button>
              </div>
              {/* Notes list */}
              {notes.length === 0 && (
                <p className="py-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
                  Aucune note pour le moment
                </p>
              )}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group rounded-lg p-3"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      {note.authorName} ·{' '}
                      {new Date(note.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: 'var(--muted)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[13px]" style={{ color: 'var(--text)' }}>
                    {note.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: 'var(--bdr)' }}
        >
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          {tab === 'info' && (
            <button type="button" className="btn-primary" onClick={handleSave}>
              Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11.5px] font-semibold" style={{ color: 'var(--text2)' }}>
      {label}
    </label>
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
  const rooms = useProjectStore(selectRooms);
  const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));
  const rename = useProjectStore((s) => s.rename);
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

  // Mode affiché (Plan 2D / Calepinage / Quantitatif) : dans l'adresse (?mode=…)
  const searchParams = useSearchParams();
  const mode = modeFromParam(searchParams.get('mode'));
  const setMode = useCallback(
    (m: WorkspaceMode) => router.push(modeHref(id, m), { scroll: false }),
    [router, id],
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<ProjectSettingsTab>('info');
  const [printMounted, setPrintMounted] = useState(false);
  useEffect(() => {
    setPrintMounted(true);
  }, []);

  // Coordonnées de l'entreprise de l'utilisateur pour l'en-tête du PDF (Paramètres → Entreprise)
  const [printCompany, setPrintCompany] = useState<PrintCompany | null>(null);
  useEffect(() => {
    profileDb
      .get()
      .then((p) => {
        if (!p) return;
        const address = [p.addressLine, [p.postalCode, p.city].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');
        setPrintCompany({
          name: p.companyName,
          logoUrl: profileDb.logoUrl(p.logoPath),
          address: address || null,
          phone: p.phone,
          email: p.email,
          siret: p.siret,
        });
      })
      .catch(() => setPrintCompany(null));
  }, []);
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    if (hydrated) setActive(id);
  }, [id, hydrated, setActive]);

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
    const interval = setInterval(
      () => {
        void refreshLock(id);
      },
      10 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [id, lockStatus]);

  useEffect(() => {
    if (!activeProject) return;
    const isEditor = activeProject.myRole === 'editor' || activeProject.myRole === 'owner';
    if (!isEditor) return;
    const handler = () => {
      void releaseLock(id);
    };
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

  if (!hydrated) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: 'var(--bg)', color: 'var(--text2)', height: '100svh' }}
      >
        Chargement…
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg)', color: 'var(--text2)', height: '100svh' }}
      >
        <p>Projet introuvable.</p>
        <button type="button" className="btn-secondary" onClick={() => router.push('/')}>
          Retour à l&apos;accueil
        </button>
      </div>
    );
  }

  const canGoTiling = rooms.some((r) => r.points.length >= 3);
  const isReadOnly = lockStatus === 'locked_by_other' || activeProject.myRole === 'viewer';

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--bg)', height: '100svh' }}
    >
      <ProjectHeader
        projectName={activeProject.name}
        onRename={(name) => rename(activeProject.id, name)}
        status={activeProject.status}
        onStatusChange={setStatus}
        clientName={activeProject.client?.name}
        updatedAt={activeProject.updatedAt}
        readOnly={isReadOnly}
        user={user}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onBack={() => router.push('/dashboard')}
        notesCount={activeProject.notes?.length ?? 0}
        onOpenProjectSettings={(t = 'info') => {
          setSettingsTab(t);
          setShowSettings(true);
        }}
        onPrint={handlePrint}
        onOpenAccount={() => router.push('/settings')}
        onOpenPlan={() => router.push('/settings?tab=forfait')}
        onOpenTutorial={() => useTutorialStore.getState().show()}
        onLogout={() => void logout().then(() => router.push('/auth'))}
      />

      {/* Verrou : quelqu'un d'autre édite le projet */}
      {lockStatus === 'locked_by_other' && (
        <div
          role="status"
          className="flex items-center gap-2 border-b px-3 py-1.5 text-[12px] mouse:px-5 md:px-5"
          style={{
            background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
            borderColor: 'var(--bdr)',
            color: 'var(--accent)',
          }}
        >
          <Lock size={13} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">
            Lecture seule — édition en cours par{' '}
            <strong>{lockInfo?.lockedByDisplayName ?? 'un autre utilisateur'}</strong>
          </span>
        </div>
      )}

      {/* Content — un seul plan, trois modes (Plan 2D / Calepinage / Quantitatif) */}
      <main className="flex flex-1 overflow-hidden">
        <PlanEditor
          mode={canGoTiling ? mode : 'PLAN'}
          onModeChange={setMode}
          readOnly={isReadOnly}
          onNavigateBack={() => router.push('/')}
        />
      </main>

      {/* Tutoriel : première visite, ou menu en haut à droite */}
      <Tutorial autoOpen />

      {/* Cible d'impression — portal sur document.body pour que @media print
          puisse masquer tous les autres enfants de body sans position:fixed */}
      {printMounted &&
        createPortal(
          <div id="quantities-print-target">
            {activeProject && (
              <QuantitiesPrintView
                project={activeProject}
                rooms={rooms}
                doorOpenings={doorOpenings}
                company={printCompany}
              />
            )}
          </div>,
          document.body,
        )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          initialTab={settingsTab}
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
              client: clientName
                ? {
                    name: clientName,
                    phone: clientPhone,
                    email: clientEmail,
                    address: clientAddress,
                  }
                : undefined,
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
