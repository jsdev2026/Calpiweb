'use client';

import { ChevronLeft, FileDown, Grid, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PlanEditor } from '@/components/plan/PlanEditor';
import { TilingEditor } from '@/components/tiling/TilingEditor';
import { QuantitiesPanel } from '@/components/quantities/QuantitiesPanel';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';

type WorkspaceTab = 'PLAN' | 'TILING' | 'QUANTITIES';

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

  const [tab, setTab] = useState<WorkspaceTab>('PLAN');

  const handlePrint = useCallback(() => {
    if (tab === 'PLAN') return;
    const style = document.createElement('style');
    style.id = '__tilea_print__';
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #print-target, #print-target * {
          visibility: visible !important;
          overflow: visible !important;
          max-height: none !important;
        }
        #print-target {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: auto !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.addEventListener('afterprint', () => {
      document.getElementById('__tilea_print__')?.remove();
    }, { once: true });
    window.print();
  }, [tab]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) setActive(id);
  }, [id, hydrated, setActive]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400">
        <p>Projet introuvable.</p>
        <Button onClick={() => router.push('/')}>Retour à l&apos;accueil</Button>
      </div>
    );
  }

  const canGoTiling = activeProject.rooms.some((r) => r.points.length >= 3);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      <header className="z-30 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-3 shadow-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ChevronLeft size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600">
              <Grid size={14} className="text-white" />
            </div>
            <span className="text-sm font-black tracking-tight text-orange-400">TILEA</span>
          </div>
          <div className="mx-1 h-8 w-px bg-zinc-800" />
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            className="min-w-[200px] rounded bg-transparent px-2 py-1 text-lg font-bold text-zinc-100 outline-none transition-colors hover:bg-zinc-800 focus:text-orange-400"
          />
        </div>

        {/* Pill tab switcher */}
        <div className="flex items-center rounded-full border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setTab('PLAN')}
            className={`rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'PLAN'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            1. Plan 2D
          </button>
          <button
            type="button"
            disabled={!canGoTiling}
            onClick={() => canGoTiling && setTab('TILING')}
            className={`rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'TILING'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30'
                : 'text-zinc-500 hover:text-zinc-300'
            } ${!canGoTiling ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            2. Calepinage
          </button>
          <button
            type="button"
            disabled={!canGoTiling}
            onClick={() => canGoTiling && setTab('QUANTITIES')}
            className={`rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
              tab === 'QUANTITIES'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/30'
                : 'text-zinc-500 hover:text-zinc-300'
            } ${!canGoTiling ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            3. Quantitatif
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
            <Save size={16} /> Sauvegardé
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={tab === 'PLAN'}
            className={tab === 'PLAN' ? 'cursor-not-allowed opacity-40' : ''}
          >
            <FileDown size={16} /> PDF
          </Button>
        </div>
      </header>

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
