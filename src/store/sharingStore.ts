import { create } from 'zustand';
import { sharingDb } from '@/lib/supabase/sharing';
import type { ProjectShare, ProjectNotification, ShareRole } from '@/types/sharing';

interface SharingState {
  shares: Record<string, ProjectShare[]>;
  notifications: ProjectNotification[];
  unseenCount: number;

  loadShares: (projectId: string) => Promise<void>;
  shareProject: (projectId: string, email: string, role: ShareRole) => Promise<void>;
  unshareProject: (projectId: string, userId: string) => Promise<void>;
  acquireLock: (projectId: string) => Promise<'acquired' | 'locked_by_other'>;
  releaseLock: (projectId: string) => Promise<void>;
  refreshLock: (projectId: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsSeen: () => Promise<void>;
}

export const useSharingStore = create<SharingState>((set, get) => ({
  shares: {},
  notifications: [],
  unseenCount: 0,

  loadShares: async (projectId) => {
    const shares = await sharingDb.getShares(projectId);
    set((s) => ({ shares: { ...s.shares, [projectId]: shares } }));
  },

  shareProject: async (projectId, email, role) => {
    const user = await sharingDb.findUserByEmail(email);
    if (!user) throw new Error('USER_NOT_FOUND');

    const existingShares = await sharingDb.getShares(projectId);
    if (existingShares.some((s) => s.userId === user.id)) throw new Error('ALREADY_SHARED');

    await sharingDb.addShare(projectId, user.id, role);
    await sharingDb.addNotification(user.id, projectId, 'share_added');
    await get().loadShares(projectId);
  },

  unshareProject: async (projectId, userId) => {
    await sharingDb.removeShare(projectId, userId);
    await sharingDb.addNotification(userId, projectId, 'share_removed');
    await get().loadShares(projectId);
  },

  acquireLock: async (projectId) => sharingDb.acquireLock(projectId),

  releaseLock: async (projectId) => sharingDb.releaseLock(projectId),

  refreshLock: async (projectId) => sharingDb.refreshLock(projectId),

  loadNotifications: async () => {
    const notifications = await sharingDb.getNotifications();
    const unseenCount = notifications.filter((n) => !n.seen).length;
    set({ notifications, unseenCount });
  },

  markNotificationsSeen: async () => {
    await sharingDb.markNotificationsSeen();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, seen: true })),
      unseenCount: 0,
    }));
  },
}));
