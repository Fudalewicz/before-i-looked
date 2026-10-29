import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import type { DigestRow } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCounts[];
};

// A night on disk with its run lines by status, for the board's link to its digest.
export type NightCounts = { night: string; ok: number; retry: number; fail: number };

export function nightCounts(runsDir: string, night: string): NightCounts {
  const rows = readNight(runsDir, night)?.rows ?? [];
  const sum = (f: (r: DigestRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const retry = sum((r) => r.retries);
  const fail = sum((r) => r.fails);
  return { night, ok: sum((r) => r.runs) - retry - fail, retry, fail };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => nightCounts(config.runsDir, n)),
  };
}
