'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  CreditCard,
  FileDown,
  GraduationCap,
  LogOut,
  Moon,
  NotebookPen,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import type { ProjectStatus } from '@/types/project';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  new: 'Nouveau',
  wip: 'En cours',
  done: 'Terminé',
};
/** Couleur du point de statut (lisible en thème clair et sombre) */
const STATUS_DOT: Record<ProjectStatus, string> = {
  new: '#8b5cf6',
  wip: '#f59e0b',
  done: '#10b981',
};
const STATUSES: ProjectStatus[] = ['new', 'wip', 'done'];

export type ProjectSettingsTab = 'info' | 'notes';

export interface ProjectHeaderProps {
  projectName: string;
  onRename: (name: string) => void;
  status: ProjectStatus;
  onStatusChange: (status: ProjectStatus) => void;
  clientName?: string | null;
  /** Nombre de notes du projet (affiché dans le menu Projet) */
  notesCount?: number;
  updatedAt: number | string;
  readOnly: boolean;
  user: { name: string; email: string; plan?: string } | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
  /** Ouvre la fenêtre des informations du projet (client, description) ou des notes */
  onOpenProjectSettings: (tab?: ProjectSettingsTab) => void;
  onPrint: () => void;
  onOpenAccount: () => void;
  onOpenPlan: () => void;
  /** Rouvre le tutoriel de prise en main */
  onOpenTutorial?: () => void;
  onLogout: () => void;
}

const PLAN_LABEL: Record<string, string> = { free: 'Gratuit', pro: 'Pro', team: 'Équipe' };

/** Ferme un menu au clic / toucher en dehors, et avec Échap. */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const MenuItem = ({
  icon,
  children,
  onClick,
  danger = false,
  trailing,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors hover:bg-[var(--surf2)]"
    style={{ color: danger ? '#ef4444' : 'var(--text2)' }}
  >
    <span className="flex w-4 shrink-0 justify-center" aria-hidden>
      {icon}
    </span>
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
  </button>
);

const MenuDivider = () => <div className="my-1 h-px" style={{ background: 'var(--bdr)' }} />;

const menuStyle = { background: 'var(--surf)', border: '1px solid var(--bdr)' };
/** Cadre commun des boutons du bandeau (Projet, compte) : même hauteur, même style */
const CHIP =
  'flex h-9 shrink-0 items-center rounded-[var(--rs)] transition-colors hover:bg-[var(--surf3)] mouse:h-8 md:h-8';
const fieldLabel = 'mb-1 block text-[10.5px] font-bold uppercase tracking-wider';

const StatusDot = ({ status }: { status: ProjectStatus }) => (
  <span
    aria-hidden
    className="inline-block h-2 w-2 shrink-0 rounded-full"
    style={{ background: STATUS_DOT[status] }}
  />
);

/**
 * En-tête de la page projet, en deux zones :
 * - à gauche, le retour aux projets puis le bouton « Projet » (nom, statut, client) qui ouvre
 *   un menu regroupant tout le projet : nom, statut, client et description, notes, export PDF ;
 * - à droite, seulement le compte (thème, paramètres, forfait, tutoriel, déconnexion).
 * Même organisation sur ordinateur et sur smartphone.
 */
export const ProjectHeader = ({
  projectName,
  onRename,
  status,
  onStatusChange,
  clientName,
  notesCount = 0,
  updatedAt,
  readOnly,
  user,
  darkMode,
  onToggleDarkMode,
  onBack,
  onOpenProjectSettings,
  onPrint,
  onOpenAccount,
  onOpenPlan,
  onOpenTutorial,
  onLogout,
}: ProjectHeaderProps) => {
  const [projectOpen, setProjectOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const projectRef = useOutside(projectOpen, () => setProjectOpen(false));
  const userRef = useOutside(userOpen, () => setUserOpen(false));

  const initials =
    user?.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? 'CP';
  const date = new Date(updatedAt).toLocaleDateString('fr-FR');
  const run = (close: () => void, action: () => void) => () => {
    close();
    action();
  };
  const closeProject = () => setProjectOpen(false);
  const ThemeIcon = darkMode ? Sun : Moon;
  const themeLabel = darkMode ? 'Thème clair' : 'Thème sombre';
  const subtitle = [STATUS_LABELS[status], clientName].filter(Boolean).join(' · ');

  return (
    <header className="shell-topbar gap-2 px-2 mouse:gap-3 mouse:px-4 md:gap-3 md:px-4">
      {/* Retour aux projets : logo (ordinateur) ou flèche (smartphone) */}
      {/* .btn-icon fixe display : on masque via un conteneur */}
      <span className="flex shrink-0 mouse:hidden md:hidden">
        <button type="button" onClick={onBack} aria-label="Retour aux projets" className="btn-icon">
          <ChevronLeft size={18} />
        </button>
      </span>
      <button
        type="button"
        onClick={onBack}
        title="Retour aux projets"
        className="hidden shrink-0 items-center gap-2 mouse:flex md:flex"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: 'var(--accent)' }}
          aria-hidden
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" />
            <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7" />
            <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7" />
            <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white" />
          </svg>
        </span>
        <span className="text-[12.5px] hover:underline" style={{ color: 'var(--text2)' }}>
          Projets
        </span>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }} aria-hidden>
          ›
        </span>
      </button>

      {/* ── Projet : tout ce qui concerne le projet, au même endroit ── */}
      {/* (.shell-topbar impose gap: 0 sur smartphone : espacement par marges) */}
      <div
        className="relative ml-1.5 min-w-0 flex-1 mouse:ml-0 mouse:flex-initial md:ml-0 md:flex-initial"
        ref={projectRef}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={projectOpen}
          aria-label={`Projet : ${projectName} — ${STATUS_LABELS[status]}`}
          onClick={() => setProjectOpen((o) => !o)}
          title={subtitle}
          className={`${CHIP} w-full min-w-0 gap-2 px-2.5 text-left mouse:max-w-[340px] md:max-w-[340px]`}
          style={{
            background: 'var(--surf2)',
            border: `1px solid ${projectOpen ? 'var(--accent)' : 'var(--bdr)'}`,
          }}
        >
          <StatusDot status={status} />
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {projectName || 'Sans nom'}
            </span>
            {clientName && (
              <span
                className="hidden min-w-0 truncate text-[12px] mouse:inline md:inline"
                style={{ color: 'var(--muted)' }}
              >
                · {clientName}
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            aria-hidden
            className="shrink-0 transition-transform"
            style={{
              color: 'var(--muted)',
              transform: projectOpen ? 'rotate(180deg)' : undefined,
            }}
          />
        </button>

        {projectOpen && (
          <div
            role="dialog"
            aria-label="Projet"
            className="fixed left-2 right-2 top-[calc(var(--topbar)+4px)] z-50 rounded-xl p-3 shadow-xl mouse:absolute mouse:left-0 mouse:right-auto mouse:top-full mouse:mt-1 mouse:w-80 md:absolute md:left-0 md:right-auto md:top-full md:mt-1 md:w-80"
            style={menuStyle}
          >
            <label className={fieldLabel} style={{ color: 'var(--muted)' }} htmlFor="project-name">
              Nom du projet
            </label>
            <input
              id="project-name"
              type="text"
              aria-label="Nom du projet"
              value={projectName}
              onChange={(e) => onRename(e.target.value)}
              readOnly={readOnly}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-[var(--rs)] border px-2.5 py-1.5 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]"
              style={{
                borderColor: 'var(--bdr2)',
                background: 'var(--surf)',
                color: 'var(--text)',
              }}
            />

            <span className={`${fieldLabel} mt-3`} style={{ color: 'var(--muted)' }}>
              Statut
            </span>
            <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Statut">
              {STATUSES.map((s) => {
                const active = s === status;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={readOnly}
                    onClick={() => onStatusChange(s)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-semibold transition-colors disabled:cursor-default"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--bdr)',
                      background: active
                        ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                        : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text2)',
                      opacity: readOnly && !active ? 0.5 : 1,
                    }}
                  >
                    <StatusDot status={s} />
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t pt-1.5" style={{ borderColor: 'var(--bdr)' }} role="menu">
              {!readOnly && (
                <>
                  <MenuItem
                    icon={<UserRound size={14} />}
                    onClick={run(closeProject, () => onOpenProjectSettings('info'))}
                    trailing={
                      <span className="text-[11.5px]" style={{ color: 'var(--accent)' }}>
                        Modifier
                      </span>
                    }
                  >
                    {clientName ? `Client : ${clientName}` : 'Client et description'}
                  </MenuItem>
                  <MenuItem
                    icon={<NotebookPen size={14} />}
                    onClick={run(closeProject, () => onOpenProjectSettings('notes'))}
                    trailing={
                      <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
                        {notesCount === 0
                          ? 'Aucune'
                          : `${notesCount} note${notesCount > 1 ? 's' : ''}`}
                      </span>
                    }
                  >
                    Notes du projet
                  </MenuItem>
                </>
              )}
              <MenuItem icon={<FileDown size={14} />} onClick={run(closeProject, onPrint)}>
                Exporter en PDF
              </MenuItem>
            </div>
            <p className="mt-1.5 px-1 text-[11px]" style={{ color: 'var(--muted)' }}>
              {readOnly ? 'Lecture seule · ' : ''}Modifié le {date}
            </p>
          </div>
        )}
      </div>

      <span className="hidden flex-1 mouse:block md:block" />

      {/* ── Compte (ordinateur et smartphone) ── */}
      <div className="relative ml-2 shrink-0 mouse:ml-0 md:ml-0" ref={userRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={userOpen}
          aria-label="Mon compte"
          onClick={() => setUserOpen((o) => !o)}
          className={`${CHIP} gap-2 px-1.5 mouse:px-2 md:px-2`}
          style={{
            background: 'var(--surf2)',
            border: `1px solid ${userOpen ? 'var(--accent)' : 'var(--bdr)'}`,
          }}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {initials}
          </span>
          {user?.plan && (
            <span className="tag-pro hidden rounded-full px-1.5 py-0.5 text-[10px] font-semibold mouse:inline md:inline">
              {PLAN_LABEL[user.plan] ?? user.plan}
            </span>
          )}
        </button>
        {userOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl p-1 shadow-xl"
            style={menuStyle}
          >
            <div className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                  {user?.name ?? 'Utilisateur'}
                </p>
                <p className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {user?.email ?? ''}
                </p>
              </div>
              {user?.plan && (
                <span className="tag-pro shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {PLAN_LABEL[user.plan] ?? user.plan}
                </span>
              )}
            </div>
            <MenuDivider />
            <MenuItem icon={<ThemeIcon size={14} />} onClick={onToggleDarkMode}>
              {themeLabel}
            </MenuItem>
            <MenuItem
              icon={<Settings size={14} />}
              onClick={run(() => setUserOpen(false), onOpenAccount)}
            >
              Paramètres
            </MenuItem>
            <MenuItem
              icon={<CreditCard size={14} />}
              onClick={run(() => setUserOpen(false), onOpenPlan)}
            >
              Changer de forfait
            </MenuItem>
            {onOpenTutorial && (
              <MenuItem
                icon={<GraduationCap size={14} />}
                onClick={run(() => setUserOpen(false), onOpenTutorial)}
              >
                Tutoriel
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem
              icon={<LogOut size={13} />}
              danger
              onClick={run(() => setUserOpen(false), onLogout)}
            >
              Se déconnecter
            </MenuItem>
          </div>
        )}
      </div>
    </header>
  );
};
