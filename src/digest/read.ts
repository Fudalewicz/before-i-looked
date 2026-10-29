import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

// Parse at the edge: anything that isn't a well-formed run line is null, and gets counted.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.job !== 'string' || o.job === '') return null;
  if (!STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== undefined && o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  };
}

export function digest(lines: RunLine[]): DigestRow[] {
  const byJob = new Map<string, RunLine[]>();
  for (const l of lines) byJob.set(l.job, [...(byJob.get(l.job) ?? []), l]);

  const rows: DigestRow[] = [];
  for (const [job, runs] of byJob) {
    // Stable sort by instant; times keep their own offset for display.
    const ordered = [...runs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    rows.push({
      job,
      owner: [...ordered].reverse().find((r) => r.owner !== null)?.owner ?? null,
      runs: ordered.length,
      retries: ordered.filter((r) => r.status === 'retry').length,
      fails: ordered.filter((r) => r.status === 'fail').length,
      lastStatus: last.status,
      lastError: last.error ?? null,
      firstAt: first.at,
      lastAt: last.at,
    });
  }
  return rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const parsed: RunLine[] = [];
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) parsed.push(line);
    else badLines++;
  }
  return { night, rows: digest(parsed), badLines };
};
