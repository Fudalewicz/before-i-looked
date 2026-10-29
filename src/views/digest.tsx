import type { DigestRow, Night } from '../digest/types.js';

const dash = (v: string | null) => v ?? '—';

function marked(r: DigestRow) {
  return r.retries >= 3 || r.fails > 0;
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr class={marked(r) ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td>{r.retries >= 3 ? <strong>{r.retries}</strong> : r.retries}</td>
                <td>{r.lastStatus === 'fail' ? <strong>fail</strong> : r.fails > 0 ? `${r.lastStatus} · ${r.fails} fail` : r.lastStatus}</td>
                <td>{dash(r.lastError)}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} in runs/{night.night}.jsonl could not be read
        </p>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for this night</p>
    </>
  );
}
