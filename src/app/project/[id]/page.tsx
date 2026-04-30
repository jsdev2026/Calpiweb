'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, Moon, Settings, Sun } from 'lucide-react';
import { PlanEditor } from '@/components/plan/PlanEditor';
import { TilingEditor } from '@/components/tiling/TilingEditor';
import { QuantitiesPanel } from '@/components/quantities/QuantitiesPanel';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
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

  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);

  const [tab, setTab] = useState<WorkspaceTab>('PLAN');

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

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Topbar */}
      <header className="shell-topbar px-5 gap-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-3">
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

        {/* Separator */}
        <div className="h-4 w-px mx-3" style={{ background: 'var(--bdr)' }} />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--text2)' }}>
          <button type="button" onClick={() => router.push('/')} className="hover:underline" style={{ color: 'var(--text2)' }}>
            Projets
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              color: 'var(--text)', minWidth: 120, maxWidth: 260,
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surf2)'; e.target.style.borderRadius = 'var(--rs)'; e.target.style.padding = '2px 6px'; }}
            onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.padding = '0'; }}
          />
        </div>

        <div className="mx-3 h-4 w-px" style={{ background: 'var(--bdr)' }} />

        {/* Status badge */}
        <button
          type="button"
          onClick={() => setStatus(STATUS_CYCLE[activeProject.status])}
          title="Cliquer pour changer le statut"
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-75 ${STATUS_CLASS[activeProject.status]}`}
        >
          {STATUS_LABELS[activeProject.status]}
        </button>

        {/* Client */}
        <div className="mx-3 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 10c0-2 2-3.5 4.5-3.5S10.5 8 10.5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span>{activeProject.client?.name || 'Client'}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{new Date(activeProject.updatedAt).toLocaleDateString('fr-FR')}</span>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={toggleDarkMode} className="btn-icon" aria-label="Thème">
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-1.5 text-[12.5px]"
            style={{ padding: '5px 10px' }}
            onClick={handlePrint}
            disabled={tab === 'PLAN'}
          >
            <FileDown size={13} /> PDF
          </button>
          <button type="button" className="btn-icon" aria-label="Paramètres">
            <Settings size={14} />
          </button>
        </div>
      </header>

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
        {tab === 'PLAN' && <PlanEditor />}
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
              setConfig={setConfig}
            />
          </div>
        )}
      </main>
    </div>
  );
}
