'use client';

import { ChevronLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StepIndicator, type WorkspaceTab } from '@/components/ui/StepIndicator';
import { PlanEditor } from '@/components/plan/PlanEditor';
import { TilingEditor } from '@/components/tiling/TilingEditor';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';

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
  const setPlan = useProjectStore((s) => s.setPlan);
  const setConfig = useProjectStore((s) => s.setConfig);

  const [tab, setTab] = useState<WorkspaceTab>('PLAN');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) setActive(id);
  }, [id, hydrated, setActive]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">Chargement…</div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-slate-600">
        <p>Projet introuvable.</p>
        <Button onClick={() => router.push('/')}>Retour à l&apos;accueil</Button>
      </div>
    );
  }

  const canGoTiling = activeProject.plan.length >= 3;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="-ml-2">
            <ChevronLeft size={24} />
          </Button>
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            className="w-64 rounded border-none bg-transparent px-2 py-1 text-lg font-bold text-slate-800 hover:bg-slate-100 focus:ring-0"
          />
        </div>

        <StepIndicator active={tab} canGoTiling={canGoTiling} onChange={setTab} />

        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <Save size={16} /> Sauvegardé
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {tab === 'PLAN' && <PlanEditor plan={activeProject.plan} setPlan={setPlan} />}
        {tab === 'TILING' && (
          <TilingEditor
            plan={activeProject.plan}
            config={activeProject.config}
            setConfig={setConfig}
          />
        )}
      </main>
    </div>
  );
}
