import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// runs/ is read-only: every test reads from a temp copy.
let runsDir: string;
const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  copyFileSync('runs/2026-10-28.jsonl', join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-25.jsonl'),
    '{"at":"2026-10-25T23:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\nnot json\n',
  );
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('renders the night, sorted by job, with the marked rows', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app().request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('rig/rotate-logs'));
    expect(html).toContain('<tr class="warn"><td>fixtures/refresh</td>');
    expect(html).toContain('<tr class="warn"><td>notes/backup</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('1 line in runs/2026-10-28.jsonl could not be read');
  });

  it('404s for a night with no file', async () => {
    const res = await app().request('/digest/2026-10-01');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app().request('/digest/2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line', async () => {
    const res = await app().request('/digest/2026-10-25');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 line in runs/2026-10-25.jsonl could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the same jobs, in the same order, as the page', async () => {
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    const html = await (await app().request('/digest/2026-10-28')).text();
    const pageJobs = [...html.matchAll(/<tr(?: class="warn")?><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(night.rows.map((r) => r.job)).toEqual(pageJobs);
  });

  it('404s for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-10-01')).status).toBe(404);
  });

  it('returns no rows for an empty night, and counts a bad line', async () => {
    expect(((await (await app().request('/api/digest/2026-10-26')).json()) as Night).rows).toEqual([]);
    expect(((await (await app().request('/api/digest/2026-10-25')).json()) as Night).badLines).toBe(1);
  });
});
