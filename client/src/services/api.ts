import { GenerationStatusResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export async function uploadTranscript(file: File): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append('transcript', file);

  const res = await fetch(`${API_BASE}/generations`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${res.status}`);
  }

  return res.json();
}

export async function getGenerationStatus(id: string): Promise<GenerationStatusResponse> {
  const res = await fetch(`${API_BASE}/generations/${id}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch status (${res.status})`);
  }
  return res.json();
}

export function getDownloadUrl(id: string): string {
  return `${API_BASE}/generations/${id}/download`;
}
