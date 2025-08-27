import type { GenerateImageResponse, JudgeResponse } from './types';

async function post<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

export const api = {
  health: async () => {
    const res = await fetch('/api/health');
    return res.json();
  },
  generateImage: (description: string) =>
    post<GenerateImageResponse>('/api/generate-image', { description }),
  judge: (originalDescription: string, guess: string) =>
    post<JudgeResponse>('/api/judge', { originalDescription, guess })
};
