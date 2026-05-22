export type ShareRole = 'viewer' | 'editor';
export type MyRole = 'owner' | ShareRole;

export interface ProjectShare {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  role: ShareRole;
  createdAt: string;
}

export interface ProjectLock {
  projectId: string;
  lockedBy: string;
  lockedByDisplayName: string;
  expiresAt: string;
}

export interface ProjectNotification {
  id: string;
  projectId: string;
  projectName: string;
  type: 'share_added' | 'share_removed';
  seen: boolean;
  createdAt: string;
}
