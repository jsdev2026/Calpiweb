import { createClient } from './client';
import type {
  EditableProfile,
  SupportCategory,
  SupportRequest,
  UserProfile,
} from '@/types/profile';

// Correspondance champs TypeScript ↔ colonnes public.profiles
const COLUMNS: Record<keyof EditableProfile, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  profileType: 'profile_type',
  companyName: 'company_name',
  siret: 'siret',
  vatNumber: 'vat_number',
  addressLine: 'address_line',
  postalCode: 'postal_code',
  city: 'city',
  interventionArea: 'intervention_area',
  companySize: 'company_size',
  monthlyJobs: 'monthly_jobs',
  acquisitionSource: 'acquisition_source',
  newsletterOptIn: 'newsletter_opt_in',
  logoPath: 'logo_path',
  defaultTileConfig: 'default_tile_config',
  defaultWallThickness: 'default_wall_thickness',
  tileFormats: 'tile_formats',
};

type Row = Record<string, unknown>;

export function rowToProfile(r: Row): UserProfile {
  const s = (k: string) => (r[k] == null ? null : String(r[k]));
  return {
    id: String(r.id),
    email: s('email'),
    plan: r.plan === 'pro' ? 'pro' : 'free',
    projectCredits: Number(r.project_credits ?? 0),
    displayName: s('display_name'),
    firstName: s('first_name'),
    lastName: s('last_name'),
    phone: s('phone'),
    profileType: s('profile_type') as UserProfile['profileType'],
    companyName: s('company_name'),
    siret: s('siret'),
    vatNumber: s('vat_number'),
    addressLine: s('address_line'),
    postalCode: s('postal_code'),
    city: s('city'),
    interventionArea: s('intervention_area'),
    companySize: s('company_size') as UserProfile['companySize'],
    monthlyJobs: s('monthly_jobs'),
    acquisitionSource: s('acquisition_source'),
    newsletterOptIn: r.newsletter_opt_in === true,
    newsletterOptInAt: s('newsletter_opt_in_at'),
    logoPath: s('logo_path'),
    defaultTileConfig: (r.default_tile_config as UserProfile['defaultTileConfig']) ?? null,
    defaultWallThickness:
      r.default_wall_thickness == null ? null : Number(r.default_wall_thickness),
    tileFormats: Array.isArray(r.tile_formats)
      ? (r.tile_formats as UserProfile['tileFormats'])
      : null,
  };
}

export function profilePatchToRow(patch: EditableProfile): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = COLUMNS[key as keyof EditableProfile];
    if (col && value !== undefined) row[col] = value;
  }
  return row;
}

async function currentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('NOT_AUTHENTICATED');
  return user.id;
}

export const profileDb = {
  async get(): Promise<UserProfile | null> {
    const supabase = createClient();
    const id = await currentUserId();
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return data ? rowToProfile(data as Row) : null;
  },

  async update(patch: EditableProfile): Promise<void> {
    const row = profilePatchToRow(patch);
    if (Object.keys(row).length === 0) return;
    const supabase = createClient();
    const id = await currentUserId();
    const { error } = await supabase.from('profiles').update(row).eq('id', id);
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  /** Changement d'e-mail : Supabase envoie un lien de confirmation à la nouvelle adresse. */
  async changeEmail(email: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/callback` },
    );
    if (error) throw new Error(error.message);
  },

  // ── Logo d'entreprise (bucket public « logos », dossier <user_id>/) ─────────

  logoUrl(path: string | null): string | null {
    if (!path) return null;
    return createClient().storage.from('logos').getPublicUrl(path).data.publicUrl;
  },

  async uploadLogo(file: File): Promise<string> {
    if (file.size > 1024 * 1024) throw new Error('Le logo doit faire moins de 1 Mo.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      throw new Error('Formats acceptés : PNG, JPG, WebP ou SVG.');
    }
    const supabase = createClient();
    const id = await currentUserId();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  },

  async removeLogo(path: string): Promise<void> {
    const supabase = createClient();
    await supabase.storage.from('logos').remove([path]);
  },

  // ── Demandes de contact ─────────────────────────────────────────────────────

  async sendRequest(category: SupportCategory, message: string, contactEmail: string | null) {
    const supabase = createClient();
    const id = await currentUserId();
    const { error } = await supabase
      .from('support_requests')
      .insert({ user_id: id, category, message: message.trim(), contact_email: contactEmail });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async listRequests(): Promise<SupportRequest[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('support_requests')
      .select('id, category, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      category: r.category as SupportCategory,
      message: r.message as string,
      status: r.status as SupportRequest['status'],
      createdAt: r.created_at as string,
    }));
  },

  // ── Confidentialité (RGPD) ──────────────────────────────────────────────────

  /** Toutes les données de l'utilisateur, au format JSON (droit à la portabilité). */
  async exportData(): Promise<Record<string, unknown>> {
    const supabase = createClient();
    const id = await currentUserId();
    const [profile, projects, requests] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('projects').select('id, name, data, created_at, updated_at').eq('user_id', id),
      supabase.from('support_requests').select('*').eq('user_id', id),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: profile.data,
      projects: projects.data ?? [],
      supportRequests: requests.data ?? [],
    };
  },

  /** Suppression définitive du compte et de toutes ses données. */
  async deleteAccount(logoPath: string | null): Promise<void> {
    const supabase = createClient();
    if (logoPath) await supabase.storage.from('logos').remove([logoPath]);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    await supabase.auth.signOut();
  },
};
