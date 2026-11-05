import { json } from '@sveltejs/kit';
import { ZodError } from 'zod';
import { DomainError } from './db';
export async function readJson(request: Request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > 512000) throw new DomainError(413, 'Dane są zbyt duże.');
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError(400, 'Nieprawidłowy format żądania.');
  }
}
export function apiError(e: unknown): Response {
  if (e instanceof DomainError) return json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError)
    return json(
      {
        error: 'Sprawdź poprawność wpisanych wartości.',
        details: e.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      { status: 422 },
    );
  console.error('Exilium operation failed:', e instanceof Error ? e.name : 'UnknownError');
  return json({ error: 'Zapis nie powiódł się. Dane nie zostały zmienione.' }, { status: 500 });
}
