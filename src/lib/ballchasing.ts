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
  };
};

export type BallchasingReplay = {
  id: string;
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

export async function fetchReplay(replayId: string): Promise<BallchasingReplay> {
  const apiKey = process.env.BALLCHASING_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BALLCHASING_API_KEY isn't configured — get one from ballchasing.com/upload and set it in the environment."
    );
  }

  const res = await fetch(`https://ballchasing.com/api/replays/${replayId}`, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Replay not found on ballchasing.com.");
    if (res.status === 401) throw new Error("Ballchasing API key is invalid.");
    throw new Error(`Ballchasing API error (${res.status}).`);
  }

  return res.json();
}
