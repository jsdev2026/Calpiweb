'use client';

import { useEffect, useState } from 'react';
import { X, UserMinus } from 'lucide-react';
import { useSharingStore } from '@/store/sharingStore';
import type { ProjectShare, ShareRole } from '@/types/sharing';

interface SharePanelProps {
  projectId: string;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: 'Aucun compte trouvé pour cet email.',
  ALREADY_SHARED: 'Déjà collaborateur sur ce projet.',
};

export const SharePanel = ({ projectId, onClose }: SharePanelProps) => {
  const { shares, shareProject, unshareProject, loadShares } = useSharingStore((s) => ({
    shares: s.shares,
    shareProject: s.shareProject,
    unshareProject: s.unshareProject,
    loadShares: s.loadShares,
  }));
  const collaborators = shares[projectId] ?? [];

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadShares(projectId); }, [projectId, loadShares]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await shareProject(projectId, email.trim(), role);
      setEmail('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      setError(ERROR_MESSAGES[msg] ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    try {
      await unshareProject(projectId, userId);
    } catch {
      setError('Une erreur est survenue lors de la révocation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="flex w-full max-w-sm flex-col rounded-2xl shadow-2xl"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--bdr)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Partager le projet</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Invite form */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--bdr)' }}>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="adresse@email.com"
              className="flex-1 rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite(); }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              className="rounded-lg px-2 py-2 text-[12px] outline-none"
              style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
            >
              <option value="editor">Éditeur</option>
              <option value="viewer">Lecteur</option>
            </select>
          </div>
          {error && (
            <p className="mt-2 text-[12px] text-red-400">{error}</p>
          )}
          <button
            type="button"
            className="btn-primary mt-3 w-full text-[13px]"
            onClick={() => void handleInvite()}
            disabled={loading || !email.trim()}
          >
            {loading ? 'Envoi…' : 'Inviter'}
          </button>
        </div>

        {/* Collaborators list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {collaborators.length === 0 ? (
            <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              Aucun collaborateur pour le moment.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {collaborators.map((c: ProjectShare) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}
                >
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                      {c.userDisplayName || c.userEmail}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{c.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--surf3)', color: 'var(--text2)' }}
                    >
                      {c.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(c.userId)}
                      aria-label={`Révoquer ${c.userEmail}`}
                      className="p-1 text-zinc-600 transition-colors hover:text-red-400"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
