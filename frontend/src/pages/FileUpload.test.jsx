import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FileUpload from './FileUpload';
import { api } from '../services/api';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('FileUpload', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to redirect_url when upload succeeds', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        redirect_url: '/analysis/99',
      },
    });

    render(<FileUpload />);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['hello world'], 'sample.txt', { type: 'text/plain' });

    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Upload and analyze/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/analysis/99');
    });
  });

  it('renders backend JSON error when upload fails', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Error processing file: ingestion exploded',
        },
      },
    });

    render(<FileUpload />);

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['hello world'], 'sample.txt', { type: 'text/plain' });

    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Upload and analyze/i }));

    await waitFor(() => {
      expect(screen.getByText('Error processing file: ingestion exploded')).toBeInTheDocument();
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
