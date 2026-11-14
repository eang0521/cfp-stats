import type { RatingRow } from "./engine";

export interface GameForChampDetection {
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  notes: string | null;
  seasonType: string;
}

export interface RecordForStandings {
  team: string;
  conference: string | null;
  conferenceWins: number;
  conferenceLosses: number;
  conferenceTies: number;
}

export interface ConferenceChampion {
  conference: string;
  team: string;
  source: "championship-game" | "best-conference-record";
}

/**
 * Determine each conference's champion.
 *
 * Primary signal: a postseason/championship-week game whose `notes` field
 * names a conference championship (CFBD tags these, e.g. "Big Ten
 * Championship"), between two teams of that conference.
 *
 * Fallback (used before championship weekend is played, or for conferences
 * without a title game): the team with the best conference record, ties
 * broken by overall rating.
 */
export function determineConferenceChampions(
  games: GameForChampDetection[],
  records: RecordForStandings[],
  ratingByTeam: Map<string, RatingRow>
): ConferenceChampion[] {
  const conferences = new Set(
    records.map((r) => r.conference).filter((c): c is string => !!c)
  );

  const champFromGame = new Map<string, ConferenceChampion>();

  for (const g of games) {
    if (!g.completed || !g.notes) continue;
    if (g.homePoints === null || g.awayPoints === null) continue;
    if (!/championship/i.test(g.notes)) continue;

    for (const conf of conferences) {
      const notesHaveConf = g.notes.toLowerCase().includes(conf.toLowerCase());
      if (!notesHaveConf) continue;

      const winner = g.homePoints > g.awayPoints ? g.homeTeam : g.awayTeam;
      champFromGame.set(conf, {
        conference: conf,
        team: winner,
        source: "championship-game",
      });
    }
  }

  const champions: ConferenceChampion[] = [];

  for (const conf of conferences) {
    const fromGame = champFromGame.get(conf);
    if (fromGame) {
      champions.push(fromGame);
      continue;
    }

    const standings = records
      .filter((r) => r.conference === conf)
      .sort((a, b) => {
        const aWinPct =
          a.conferenceWins / Math.max(1, a.conferenceWins + a.conferenceLosses + a.conferenceTies);
        const bWinPct =
          b.conferenceWins / Math.max(1, b.conferenceWins + b.conferenceLosses + b.conferenceTies);
        if (bWinPct !== aWinPct) return bWinPct - aWinPct;
        const aRating = ratingByTeam.get(a.team)?.overallRating ?? -Infinity;
        const bRating = ratingByTeam.get(b.team)?.overallRating ?? -Infinity;
        return bRating - aRating;
      });

    if (standings.length > 0) {
      champions.push({
        conference: conf,
        team: standings[0].team,
        source: "best-conference-record",
      });
    }
  }

  return champions;
}

export interface CfpTeam {
  seed: number;
  team: string;
  conference: string | null;
  overallRating: number;
  rank: number;
  bidType: "champion-bye" | "champion" | "at-large";
  bye: boolean;
}

/**
 * Build the 12-team CFP field per the current format:
 *  - 5 highest-ranked conference champions get automatic bids
 *  - 4 highest-ranked of those champions get the top 4 seeds and a first-round bye
 *  - remaining 7 spots go to the highest-ranked at-large teams
 *  - seeds 5-12 are assigned by rank among the 5th champion + 7 at-large teams
 */
export function buildCfpField(
  ratings: RatingRow[],
  champions: ConferenceChampion[]
): CfpTeam[] {
  const championTeams = new Set(champions.map((c) => c.team));

  const rankedChampions = ratings
    .filter((r) => championTeams.has(r.team))
    .sort((a, b) => a.rank - b.rank);

  const top5Champions = rankedChampions.slice(0, 5);
  const fifthChampion = top5Champions[4];

  const atLarge = ratings
    .filter((r) => !championTeams.has(r.team))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 7);

  const field: CfpTeam[] = [];

  for (const champ of top5Champions.slice(0, 4)) {
    field.push({
      seed: 0,
      team: champ.team,
      conference: champ.conference,
      overallRating: champ.overallRating,
      rank: champ.rank,
      bidType: "champion-bye",
      bye: true,
    });
  }

  const seeds5to12 = [
    ...(fifthChampion ? [fifthChampion] : []),
    ...atLarge,
  ].sort((a, b) => a.rank - b.rank);

  for (const team of seeds5to12) {
    field.push({
      seed: 0,
      team: team.team,
      conference: team.conference,
      overallRating: team.overallRating,
      rank: team.rank,
      bidType: fifthChampion && team.team === fifthChampion.team ? "champion" : "at-large",
      bye: false,
    });
  }

  // Seeds 1-4 are the bye teams in rank order; 5-12 follow in rank order.
  field.sort((a, b) => {
    if (a.bye !== b.bye) return a.bye ? -1 : 1;
    return a.rank - b.rank;
  });
  field.forEach((team, i) => (team.seed = i + 1));

  return field;
}
