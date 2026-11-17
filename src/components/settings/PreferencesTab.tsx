'use client';

import { useState } from 'react';
import type { TileLayout } from '@/types/tiling';
import type { UserProfile } from '@/types/profile';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { WALL_THICKNESS_MM } from '@/constants/businessRules';
import { profileDb } from '@/lib/supabase/profile';
import { parseDecimal } from '@/components/tiling/NumberStepper';
import {
  Field,
  Grid2,
  SaveBar,
  Section,
  SelectInput,
  TextInput,
  friendlyError,
  type SaveState,
} from './settingsUi';

const POSES: { value: string; label: string; layout: TileLayout; stagger: number }[] = [
  { value: 'STRAIGHT_0', label: 'Droit', layout: 'STRAIGHT', stagger: 0 },
  { value: 'STRAIGHT_33', label: 'Décalé 1/3', layout: 'STRAIGHT', stagger: 33 },
  { value: 'STRAIGHT_50', label: 'Décalé 1/2', layout: 'STRAIGHT', stagger: 50 },
  { value: 'HERRINGBONE', label: 'Bâton rompu', layout: 'HERRINGBONE', stagger: 0 },
  { value: 'CHEVRON', label: 'Point de Hongrie', layout: 'CHEVRON', stagger: 0 },
];

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export const PreferencesTab = ({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<void>;
}) => {
  const base = { ...DEFAULT_TILING_CONFIG, ...(profile.defaultTileConfig ?? {}) };
  const initialPose =
    base.layout === 'STRAIGHT'
      ? base.stagger >= 45
        ? 'STRAIGHT_50'
        : base.stagger >= 20
          ? 'STRAIGHT_33'
          : 'STRAIGHT_0'
      : base.layout;

  const [width, setWidth] = useState(fmt(base.width / 10));
  const [height, setHeight] = useState(fmt(base.height / 10));
  const [joint, setJoint] = useState(fmt(base.joint));
  const [pose, setPose] = useState(initialPose);
  const [wall, setWall] = useState(fmt((profile.defaultWallThickness ?? WALL_THICKNESS_MM) / 10));
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const touch =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setState('idle');
    };

  const save = async () => {
    const w = parseDecimal(width);
    const h = parseDecimal(height);
    const j = parseDecimal(joint);
    const t = parseDecimal(wall);
    if (!(w > 0 && w <= 400 && h > 0 && h <= 400)) return fail('Format : entre 0,1 et 400 cm.');
    if (!(j >= 0 && j <= 30)) return fail('Joint : entre 0 et 30 mm.');
    if (!(t >= 5 && t <= 100)) return fail('Épaisseur de mur : entre 5 et 100 cm.');
    const p = POSES.find((x) => x.value === pose) ?? POSES[1]!;
    setState('saving');
    setError(null);
    try {
      await profileDb.update({
        defaultTileConfig: {
          width: Math.round(w * 10),
          height: Math.round(h * 10),
          joint: j,
          layout: p.layout,
          stagger: p.stagger,
        },
        defaultWallThickness: Math.round(t * 10),
      });
      await onSaved();
      setState('saved');
    } catch (e) {
      fail(friendlyError(e));
    }
  };

  function fail(msg: string) {
    setState('error');
    setError(msg);
  }

  return (
    <Section
      title="Valeurs par défaut des nouveaux projets"
      description="Préremplies à chaque création de projet ; modifiables ensuite dans le calepinage."
    >
      <Grid2>
        <Field label="Largeur du carreau (cm)">
          <TextInput
            inputMode="decimal"
            value={width}
            onChange={(e) => touch(setWidth)(e.target.value)}
          />
        </Field>
        <Field label="Longueur du carreau (cm)">
          <TextInput
            inputMode="decimal"
            value={height}
            onChange={(e) => touch(setHeight)(e.target.value)}
          />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="Joint (mm)">
          <TextInput
            inputMode="decimal"
            value={joint}
            onChange={(e) => touch(setJoint)(e.target.value)}
          />
        </Field>
        <Field label="Pose">
          <SelectInput
            value={pose}
            onChange={(e) => touch(setPose)(e.target.value || 'STRAIGHT_33')}
            options={POSES}
            placeholder="Choisir…"
          />
        </Field>
      </Grid2>
      <Field label="Épaisseur des murs (cm)">
        <TextInput
          inputMode="decimal"
          value={wall}
          onChange={(e) => touch(setWall)(e.target.value)}
        />
      </Field>
      <SaveBar state={state} error={error} onSave={() => void save()} />
    </Section>
  );
};
