import type { Project } from '@/types/project';
import { createClient } from './client';

export const supabaseDb = {
  async getAll(): Promise<Project[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => row.data as Project);
  },

  async get(id: string): Promise<Project | undefined> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .single();
    if (error) return undefined;
    return data?.data as Project | undefined;
  },

  async save(project: Project): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: user.id,
      name: project.name,
      data: { ...project, updatedAt: Date.now() },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  async getProfile(): Promise<{ plan: 'free' | 'pro' }> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .single();
    if (error) throw error;
    return data as { plan: 'free' | 'pro' };
  },
};
