import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockShareProject = vi.fn();
const mockUnshareProject = vi.fn();
const mockLoadShares = vi.fn();

vi.mock('@/store/sharingStore', () => ({
  useSharingStore: (sel: (s: unknown) => unknown) =>
    sel({
      shares: {
        'proj-1': [
          {
            id: 's1', projectId: 'proj-1', userId: 'user-2',
            userEmail: 'alice@x.com', userDisplayName: 'Alice',
            role: 'editor', createdAt: '2026-01-01',
          },
        ],
      },
      shareProject: mockShareProject,
      unshareProject: mockUnshareProject,
      loadShares: mockLoadShares,
    }),
}));

import { SharePanel } from './SharePanel';

const defaultProps = {
  projectId: 'proj-1',
  onClose: vi.fn(),
};

describe('SharePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders existing collaborators', () => {
    render(<SharePanel {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('alice@x.com')).toBeDefined();
  });

  it('shows error when email not found', async () => {
    mockShareProject.mockRejectedValueOnce(new Error('USER_NOT_FOUND'));
    render(<SharePanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('adresse@email.com'), {
      target: { value: 'ghost@x.com' },
    });
    fireEvent.click(screen.getByText('Inviter'));
    await waitFor(() => {
      expect(screen.getByText('Aucun compte trouvé pour cet email.')).toBeDefined();
    });
  });

  it('shows error when already shared', async () => {
    mockShareProject.mockRejectedValueOnce(new Error('ALREADY_SHARED'));
    render(<SharePanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('adresse@email.com'), {
      target: { value: 'alice@x.com' },
    });
    fireEvent.click(screen.getByText('Inviter'));
    await waitFor(() => {
      expect(screen.getByText('Déjà collaborateur sur ce projet.')).toBeDefined();
    });
  });

  it('calls unshareProject on revoke', async () => {
    mockUnshareProject.mockResolvedValueOnce(undefined);
    render(<SharePanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Révoquer alice@x.com'));
    await waitFor(() => {
      expect(mockUnshareProject).toHaveBeenCalledWith('proj-1', 'user-2');
    });
  });
});
