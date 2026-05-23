import type { ProjectShare, ProjectLock, ProjectNotification, ShareRole } from '@/types/sharing';
import { createClient } from './client';

export const sharingDb = {
  async findUserByEmail(email: string): Promise<{ id: string; displayName: string } | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (!data) return null;
    return { id: data.id as string, displayName: (data.display_name as string | null) ?? email };
  },

  async getShares(projectId: string): Promise<ProjectShare[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('project_shares')
      .select('id, project_id, user_id, role, created_at, profiles(email, display_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data ?? []).map((row) => {
      const profile = row.profiles as { email: string; display_name: string | null } | null;
      return {
        id: row.id as string,
        projectId: row.project_id as string,
        userId: row.user_id as string,
        userEmail: profile?.email ?? '',
        userDisplayName: profile?.display_name ?? profile?.email ?? '',
        role: row.role as ShareRole,
        createdAt: row.created_at as string,
      };
    });
  },

  async addShare(projectId: string, userId: string, role: ShareRole): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_shares')
      .insert({ project_id: projectId, user_id: userId, role });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async removeShare(projectId: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async addNotification(
    userId: string,
    projectId: string,
    type: 'share_added' | 'share_removed',
  ): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_notifications')
      .insert({ user_id: userId, project_id: projectId, type });
    if (error) console.error('[sharingDb.addNotification]', error.message);
  },

  async acquireLock(projectId: string): Promise<'acquired' | 'locked_by_other'> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');

    const { data: existing } = await supabase
      .from('project_locks')
      .select('locked_by, expires_at')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing && (existing.locked_by as string) !== user.id) {
      return 'locked_by_other';
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('project_locks')
      .upsert({
        project_id: projectId,
        locked_by: user.id,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return 'acquired';
  },

  async releaseLock(projectId: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('project_locks')
      .delete()
      .eq('project_id', projectId)
      .eq('locked_by', user.id);
    if (error) console.error('[sharingDb.releaseLock]', error.message);
  },

  async refreshLock(projectId: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase
      .from('project_locks')
      .update({ expires_at: expiresAt })
      .eq('project_id', projectId)
      .eq('locked_by', user.id);
  },

  async getActiveLock(projectId: string): Promise<ProjectLock | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('project_locks')
      .select('project_id, locked_by, expires_at, profiles(display_name, email)')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const profile = data.profiles as { display_name: string | null; email: string } | null;
    return {
      projectId,
      lockedBy: data.locked_by as string,
      lockedByDisplayName: profile?.display_name ?? profile?.email ?? 'Autre utilisateur',
      expiresAt: data.expires_at as string,
    };
  },

  async getNotifications(): Promise<ProjectNotification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('project_notifications')
      .select('id, project_id, type, seen, created_at, projects(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      projectName: (row.projects as { name: string } | null)?.name ?? '',
      type: row.type as 'share_added' | 'share_removed',
      seen: row.seen as boolean,
      createdAt: row.created_at as string,
    }));
  },

  async markNotificationsSeen(): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_notifications')
      .update({ seen: true })
      .eq('seen', false);
    if (error) console.error('[sharingDb.markNotificationsSeen]', error.message);
  },
};
