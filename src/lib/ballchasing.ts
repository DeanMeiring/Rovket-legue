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

export type BallchasingReplay = {
  id: string;
  // "pending" while ballchasing parses a fresh upload, then "ok" or "failed"
  status?: string;
  title?: string;
  blue: { name?: string; goals?: number; players?: BallchasingPlayer[] };
  orange: { name?: string; goals?: number; players?: BallchasingPlayer[] };
};

// Accepts a bare replay id or a full ballchasing.com URL, e.g.
// https://ballchasing.com/replay/2a2b3c4d-1234-5678-90ab-cdef01234567
export function extractReplayId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/([0-9a-fA-F-]{8,})\/?$/);
  return match ? match[1] : null;
}

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

// Uploads a .replay file and returns its ballchasing id. A replay that was
// already uploaded (409) returns the existing id, so re-uploading is harmless.
export async function uploadReplay(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  const params = new URLSearchParams({ visibility: "private" });
  const group = groupId();
  if (group) params.set("group", group);
  const res = await fetch(`https://ballchasing.com/api/v2/upload?${params}`, {
    method: "POST",
    headers: { Authorization: apiKeyOrThrow() },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if ((res.status === 201 || res.status === 409) && data.id) return data.id as string;
  if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
  throw new Error(data.error ? `Ballchasing rejected the upload: ${data.error}` : `Ballchasing upload failed (${res.status}).`);
}

export async function fetchReplay(replayId: string): Promise<BallchasingReplay> {
  const res = await fetch(`https://ballchasing.com/api/replays/${replayId}`, {
    headers: { Authorization: apiKeyOrThrow() },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Replay not found on ballchasing.com.");
    if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
    throw new Error(`Ballchasing API error (${res.status}).`);
  }

  return res.json();
}
