export type BallchasingPlayer = {
  name: string;
  stats: {
    core: {
      shots?: number;
      goals?: number;
      assists?: number;
      saves?: number;
      score?: number;
      mvp?: boolean;
    };
    boost?: { bpm?: number; avg_amount?: number; [k: string]: number | undefined };
    movement?: { avg_speed?: number; [k: string]: number | undefined };
    positioning?: {
      percent_behind_ball?: number;
      percent_most_back?: number;
      avg_distance_to_mates?: number;
      goals_against_while_last_defender?: number;
      [k: string]: number | undefined;
    };
    demo?: { inflicted?: number; taken?: number };
  };
};

export type BallchasingTeam = {
  name?: string;
  goals?: number;
  stats?: { core?: { goals?: number } };
  players?: BallchasingPlayer[];
};

export type BallchasingReplay = {
  id: string;
  // "pending" while ballchasing parses a fresh upload, then "ok" or "failed"
  status?: string;
  title?: string;
  blue: BallchasingTeam;
  orange: BallchasingTeam;
};

// Accepts a bare replay id or a full ballchasing.com URL, e.g.
// https://ballchasing.com/replay/2a2b3c4d-1234-5678-90ab-cdef01234567
export function extractReplayId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/([0-9a-fA-F-]{8,})\/?$/);
  return match ? match[1] : null;
}

// Tells a replay link (or bare replay id) from a group link, e.g.
// https://ballchasing.com/group/monday-practise-88i5kpsirh
export function parseBallchasingLink(input: string): { kind: "replay" | "group"; id: string } | null {
  const trimmed = input.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  const group = trimmed.match(/\/group\/([\w-]+)$/);
  if (group) return { kind: "group", id: group[1] };
  const path = trimmed.match(/\/replay\/([\w-]+)$/);
  if (path) return { kind: "replay", id: path[1] };
  const uuid = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuid) return { kind: "replay", id: uuid[1] };
  // A bare group id, like "monday-practise-88i5kpsirh".
  if (/^[\w-]+$/.test(trimmed)) return { kind: "group", id: trimmed };
  const replay = extractReplayId(trimmed);
  if (replay) return { kind: "replay", id: replay };
  return null;
}

// Overridable only so tests can point at a fake server.
const API = process.env.BALLCHASING_API_BASE || "https://ballchasing.com/api";

function apiKeyOrThrow(): string {
  const apiKey = process.env.BALLCHASING_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BALLCHASING_API_KEY isn't configured — get one from ballchasing.com/upload and set it in the environment."
    );
  }
  return apiKey;
}

// Optional BALLCHASING_GROUP_ID puts uploads in that ballchasing group. Accepts
// the bare id or the whole group link, e.g. https://ballchasing.com/group/tryouts-a1b2c3
function groupId(): string | null {
  const raw = process.env.BALLCHASING_GROUP_ID?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "").split("/").pop() || null;
}

// Ballchasing limits how fast a key can upload; the caller should wait and retry.
export class BallchasingBusy extends Error {
  constructor() {
    super("Ballchasing is busy, try again in a few seconds.");
  }
}

// Uploads a .replay file and returns its ballchasing id. A replay that was
// already uploaded (409) returns the existing id, so re-uploading is harmless.
export async function uploadReplay(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  const params = new URLSearchParams({ visibility: "private" });
  const group = groupId();
  if (group) params.set("group", group);
  const res = await fetch(`${API}/v2/upload?${params}`, {
    method: "POST",
    headers: { Authorization: apiKeyOrThrow() },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if ((res.status === 201 || res.status === 409) && data.id) return data.id as string;
  if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
  if (res.status === 429) throw new BallchasingBusy();
  throw new Error(data.error ? `Ballchasing rejected the upload: ${data.error}` : `Ballchasing upload failed (${res.status}).`);
}

export async function fetchReplay(replayId: string): Promise<BallchasingReplay> {
  const res = await fetch(`${API}/replays/${replayId}`, {
    headers: { Authorization: apiKeyOrThrow() },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Replay not found on ballchasing.com.");
    if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
    throw new Error(`Ballchasing API error (${res.status}).`);
  }

  return res.json();
}

// Ids of every replay directly in a ballchasing group, oldest first.
export async function listGroupReplays(group: string): Promise<{ id: string; title?: string }[]> {
  const out: { id: string; title?: string; date?: string }[] = [];
  let url: string | null =
    `${API}/replays?${new URLSearchParams({ group, count: "200", "sort-by": "replay-date", "sort-dir": "asc" })}`;
  while (url && out.length < 1000) {
    const res: Response = await fetch(url, { headers: { Authorization: apiKeyOrThrow() } });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Group not found on ballchasing.com.");
      if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
      throw new Error(`Ballchasing API error (${res.status}).`);
    }
    const data = await res.json();
    out.push(...(data.list ?? []));
    url = data.next ?? null;
  }
  return out.map((r) => ({ id: r.id, title: r.title }));
}

// Ballchasing gives a team's goals under stats.core; older fixtures had them
// at the top level. Fall back to adding up the players' goals.
export function teamGoals(team: BallchasingTeam | undefined): number {
  if (!team) return 0;
  const fromStats = team.stats?.core?.goals ?? team.goals;
  if (typeof fromStats === "number") return fromStats;
  return (team.players || []).reduce((n, p) => n + (p.stats?.core?.goals ?? 0), 0);
}
