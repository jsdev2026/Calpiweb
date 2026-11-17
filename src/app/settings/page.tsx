'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';
import type { UserProfile } from '@/types/profile';
import { fullName } from '@/types/profile';
import { profileDb } from '@/lib/supabase/profile';
import { ownedProjects } from '@/lib/entitlements';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { friendlyError } from '@/components/settings/settingsUi';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { CompanyTab } from '@/components/settings/CompanyTab';
import { PreferencesTab } from '@/components/settings/PreferencesTab';
import { PlanTab } from '@/components/settings/PlanTab';
import { ContactTab } from '@/components/settings/ContactTab';
import { PrivacyTab } from '@/components/settings/PrivacyTab';

const SETTINGS_TABS = [
  { id: 'profil', label: 'Profil' },
  { id: 'entreprise', label: 'Entreprise' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'forfait', label: 'Forfait' },
  { id: 'contact', label: 'Contact' },
  { id: 'confidentialite', label: 'Confidentialité' },
] as const;

type TabId = (typeof SETTINGS_TABS)[number]['id'];

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab: TabId = SETTINGS_TABS.some((t) => t.id === requested)
    ? (requested as TabId)
    : 'profil';

  const logout = useUiStore((s) => s.logout);
  const initUi = useUiStore((s) => s.init);
  const projects = useProjectStore((s) => s.projects);
  const hydrateProjects = useProjectStore((s) => s.hydrate);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const p = await profileDb.get();
      setProfile(p);
      setLoadError(p ? null : 'Profil introuvable.');
    } catch (e) {
      setLoadError(friendlyError(e));
    }
  }, []);

  useEffect(() => {
    void reload();
    void hydrateProjects();
  }, [reload, hydrateProjects]);

  // Après un enregistrement : relire le profil + rafraîchir le nom affiché dans les menus
  const onSaved = useCallback(async () => {
    await reload();
    void initUi();
  }, [reload, initUi]);

  const goTab = (id: TabId) => router.replace(`/settings?tab=${id}`, { scroll: false });

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <header className="shell-topbar gap-2 px-3 md:px-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-ghost min-h-[40px] gap-1 text-[13px]"
        >
          <ChevronLeft size={16} /> Mes projets
        </button>
        <span
          className="ml-1 truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Paramètres
        </span>
      </header>

      {/* Onglets — défilement horizontal sur mobile */}
      <nav
        className="sticky top-0 z-10 border-b"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
        aria-label="Sections des paramètres"
      >
        <div
          className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 md:px-6"
          style={{ scrollbarWidth: 'none' }}
        >
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className="shrink-0 whitespace-nowrap px-3 py-3 text-[13.5px] font-medium transition-colors"
              style={
                tab === t.id
                  ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
                  : { color: 'var(--text2)', borderBottom: '2px solid transparent' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-5 md:px-6 md:py-8">
        {loadError && (
          <p
            className="mb-4 rounded-lg px-3 py-2 text-[13px]"
            style={{ background: '#fef2f2', color: '#dc2626' }}
          >
            {loadError}
          </p>
        )}

        {!profile && !loadError && (
          <p className="py-10 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            Chargement…
          </p>
        )}

        {profile && (
          <>
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {fullName(profile).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
                  {fullName(profile)}
                </p>
                <p className="truncate text-[12.5px]" style={{ color: 'var(--muted)' }}>
                  {profile.companyName ? `${profile.companyName} · ` : ''}
                  {profile.email}
                </p>
              </div>
            </div>

            {tab === 'profil' && (
              <ProfileTab key={`p-${profile.id}`} profile={profile} onSaved={onSaved} />
            )}
            {tab === 'entreprise' && <CompanyTab profile={profile} onSaved={onSaved} />}
            {tab === 'preferences' && <PreferencesTab profile={profile} onSaved={onSaved} />}
            {tab === 'forfait' && (
              <PlanTab profile={profile} ownedProjects={ownedProjects(projects).length} />
            )}
            {tab === 'contact' && <ContactTab profile={profile} />}
            {tab === 'confidentialite' && <PrivacyTab profile={profile} onSaved={onSaved} />}
          </>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void logout().then(() => router.push('/auth'))}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border px-5 text-[13.5px] font-medium"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsInner />
    </Suspense>
  );
}
