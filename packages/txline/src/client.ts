import type { TxLineConfig } from "./config";
import type {
  RawFixtureSnapshotItem,
  RawScoresEvent,
  RawStatValidationV1,
  RawStatValidationV2,
} from "./raw";
import type { TxLineSession } from "./auth";

/**
 * `/api/scores/historical/{fixtureId}` responds with
 * `content-type: text/event-stream` and SSE framing (`data: {...}\nid: <n>\n\n`
 * per event) even though the OpenAPI spec describes its response body as a
 * plain JSON array — confirmed by fetching a real historical response.
 * Parses the "data:" line(s) of each blank-line-separated block.
 */
function parseSseEvents<T>(text: string): T[] {
  const events: T[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim());
    if (dataLines.length === 0) continue;
    events.push(JSON.parse(dataLines.join("\n")) as T);
  }
  return events;
}

/**
 * `path` must NOT include a leading "api/" — config.apiBase already ends in
 * "/api/", and URL resolution against a base ending in "/" appends rather
 * than replacing, so "api/x" here would resolve to ".../api/api/x" (this
 * was a real bug, caught by testing against the live devnet API).
 */
async function authedFetch(
  config: TxLineConfig,
  session: TxLineSession,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<Response> {
  const url = new URL(path, config.apiBase);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.jwt}`,
      "X-Api-Token": session.apiToken,
      "Accept-Encoding": "gzip",
    },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

async function authedGetJson<T>(
  config: TxLineConfig,
  session: TxLineSession,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const res = await authedFetch(config, session, path, params);
  return res.json() as Promise<T>;
}

async function authedGetSse<T>(
  config: TxLineConfig,
  session: TxLineSession,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const res = await authedFetch(config, session, path, params);
  return parseSseEvents<T>(await res.text());
}

export type LiveStreamEvent = { type: "data"; event: RawScoresEvent } | { type: "heartbeat"; ts: number };

/**
 * CLAUDE.md Phase 7 / Section 6.3: `/api/scores/stream`, the real live SSE
 * firehose. Confirmed against a real connection: `text/event-stream`
 * framing like historical, but a SINGLE global stream (no fixtureId
 * param — it carries whatever fixtures are currently live) with a
 * `event: heartbeat` block roughly every 15s to keep the connection
 * alive between real match events. Unlike `authedGetSse` (which reads
 * the whole body before parsing — fine for a bounded historical
 * response), this has to parse incrementally since the stream never
 * ends on its own; the caller drives reconnection by aborting `signal`
 * and calling again.
 */
export async function* consumeScoresStream(
  config: TxLineConfig,
  session: TxLineSession,
  signal?: AbortSignal,
): AsyncGenerator<LiveStreamEvent> {
  const url = new URL("scores/stream", config.apiBase);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.jwt}`,
      "X-Api-Token": session.apiToken,
    },
    signal,
  });
  if (!res.ok) {
    throw new Error(`GET scores/stream failed: ${res.status} ${await res.text()}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex = buffer.search(/\r?\n\r?\n/);
      while (sepIndex !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex).replace(/^(\r?\n)+/, "");

        const lines = block.split(/\r?\n/);
        const dataLines = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice("data:".length).trim());
        const eventLine = lines.find((l) => l.startsWith("event:"));
        if (dataLines.length > 0) {
          const payload = JSON.parse(dataLines.join("\n"));
          if (eventLine?.slice("event:".length).trim() === "heartbeat") {
            yield { type: "heartbeat", ts: payload.Ts };
          } else {
            yield { type: "data", event: payload as RawScoresEvent };
          }
        }
        sepIndex = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function getFixturesSnapshot(
  config: TxLineConfig,
  session: TxLineSession,
  params?: { startEpochDay?: number; competitionId?: number },
): Promise<RawFixtureSnapshotItem[]> {
  return authedGetJson(config, session, "fixtures/snapshot", params);
}

export function getScoresHistorical(
  config: TxLineConfig,
  session: TxLineSession,
  fixtureId: string | number,
): Promise<RawScoresEvent[]> {
  return authedGetSse(config, session, `scores/historical/${fixtureId}`);
}

/**
 * Confirmed against a real response: plain JSON (not SSE, unlike
 * historical), and an ARRAY of recent events (37 for one real fixture
 * tested), not a single object as originally assumed — each one foldable
 * through the same `reduceMatchState` reducer used everywhere else, which
 * is exactly what makes it usable for reconnect rehydration (CLAUDE.md
 * Section 6.5).
 */
export function getScoresSnapshot(
  config: TxLineConfig,
  session: TxLineSession,
  fixtureId: string | number,
): Promise<RawScoresEvent[]> {
  return authedGetJson(config, session, `scores/snapshot/${fixtureId}`);
}

/** V1 (legacy): pass statKey (and optionally statKey2) for a single/two-stat proof. */
export function getStatValidationV1(
  config: TxLineConfig,
  session: TxLineSession,
  params: { fixtureId: string | number; seq: number; statKey: number; statKey2?: number },
): Promise<RawStatValidationV1> {
  return authedGetJson(config, session, "scores/stat-validation", params);
}

/** V2: pass statKeys (comma-separated) for a multi-stat proof. */
export function getStatValidationV2(
  config: TxLineConfig,
  session: TxLineSession,
  params: { fixtureId: string | number; seq: number; statKeys: string },
): Promise<RawStatValidationV2> {
  return authedGetJson(config, session, "scores/stat-validation", params);
}
