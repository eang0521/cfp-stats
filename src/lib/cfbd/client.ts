const BASE_URL = "https://api.collegefootballdata.com";

class CfbdError extends Error {
  constructor(public status: number, public url: string, body: string) {
    super(`CFBD request failed (${status}) for ${url}: ${body.slice(0, 500)}`);
  }
}

async function cfbdFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) {
    throw new Error("CFBD_API_KEY is not set");
  }

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    // Advanced stats / season data don't change second-to-second; let the
    // ingest route control freshness instead of relying on fetch caching.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new CfbdError(res.status, url.toString(), body);
  }

  return (await res.json()) as T;
}

export interface CfbdTeam {
  id: number;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  division: string | null;
  classification: string | null;
  color: string | null;
  altColor: string | null;
  logos: string[] | null;
}

export interface CfbdGame {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  notes: string | null;
  venue: string | null;
  homeTeamId: number | null;
  homeTeam: string;
  homeConference: string | null;
  homePoints: number | null;
  awayTeamId: number | null;
  awayTeam: string;
  awayConference: string | null;
  awayPoints: number | null;
}

export interface CfbdAdvancedGameStat {
  gameId: number;
  season: number;
  week: number;
  team: string;
  opponent: string;
  offense: {
    plays: number | null;
    ppa: number | null;
    successRate: number | null;
    explosiveness: number | null;
  };
  defense: {
    plays: number | null;
    ppa: number | null;
    successRate: number | null;
    explosiveness: number | null;
  };
}

export interface CfbdTeamRecord {
  year: number;
  teamId: number;
  team: string;
  conference: string | null;
  total: { wins: number; losses: number; ties: number };
  conferenceGames: { wins: number; losses: number; ties: number };
}

export const cfbd = {
  teams: (params: { year?: number } = {}) =>
    cfbdFetch<CfbdTeam[]>("/teams/fbs", params),

  games: (params: { year: number; seasonType?: string; week?: number }) =>
    cfbdFetch<CfbdGame[]>("/games", params),

  advancedGameStats: (params: { year: number; week?: number }) =>
    cfbdFetch<CfbdAdvancedGameStat[]>("/stats/game/advanced", params),

  records: (params: { year: number }) =>
    cfbdFetch<CfbdTeamRecord[]>("/records", params),
};
