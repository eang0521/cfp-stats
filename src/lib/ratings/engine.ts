// Opponent-adjusted efficiency rating engine.
//
// Methodology (an approximation of Bill Connelly's SP+ approach, built from
// data CFBD exposes publicly):
//  1. Pull each team's per-game offensive/defensive PPA (predicted points
//     added per play) from CFBD's advanced box score stats.
//  2. Iteratively adjust each team's offense/defense for the strength of the
//     opponents it faced, converging on "adjusted PPA/play" ratings.
//  3. Blend that efficiency rating with a classic margin-based SRS (score
//     margin adjusted for opponent strength) for stability, especially early
//     in a season when the PPA sample size per team is small.
//
// This is intentionally transparent and re-computable from scratch on every
// ingest run (not an incremental/exponential update), which keeps it simple
// to reason about and debug.

export interface TeamInput {
  id: number;
  school: string;
  conference: string | null;
}

export interface GameInput {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
}

export interface EfficiencyRow {
  gameId: number;
  team: string;
  opponent: string;
  offensePpa: number | null;
  defensePpa: number | null;
}

export interface RatingRow {
  teamId: number;
  team: string;
  conference: string | null;
  offenseRating: number;
  defenseRating: number;
  overallRating: number;
  srsRating: number;
  sosRating: number;
  gamesPlayed: number;
  rank: number;
}

const PLAYS_PER_GAME_SCALE = 70; // translates PPA/play into a "points above average per game" scale
const MAX_ITERATIONS = 25;
const CONVERGENCE_EPSILON = 1e-4;
const EFFICIENCY_WEIGHT = 0.7;
const SRS_WEIGHT = 0.3;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Iteratively opponent-adjusts offensive & defensive PPA/play for every team. */
function computeAdjustedEfficiency(
  teamNames: string[],
  rows: EfficiencyRow[]
) {
  const byTeam = new Map<string, EfficiencyRow[]>();
  for (const name of teamNames) byTeam.set(name, []);
  for (const row of rows) {
    if (!byTeam.has(row.team)) byTeam.set(row.team, []);
    byTeam.get(row.team)!.push(row);
  }

  let adjOffense = new Map<string, number>();
  let adjDefense = new Map<string, number>();

  // Seed with raw (unadjusted) per-team averages.
  for (const [team, games] of byTeam) {
    adjOffense.set(
      team,
      mean(games.map((g) => g.offensePpa ?? 0).filter((v) => Number.isFinite(v)))
    );
    adjDefense.set(
      team,
      mean(games.map((g) => g.defensePpa ?? 0).filter((v) => Number.isFinite(v)))
    );
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const leagueAvgOffense = mean(Array.from(adjOffense.values()));
    const leagueAvgDefense = mean(Array.from(adjDefense.values()));

    const nextOffense = new Map<string, number>();
    const nextDefense = new Map<string, number>();

    for (const [team, games] of byTeam) {
      if (games.length === 0) {
        nextOffense.set(team, adjOffense.get(team) ?? 0);
        nextDefense.set(team, adjDefense.get(team) ?? 0);
        continue;
      }

      const offenseValues = games
        .filter((g) => g.offensePpa !== null)
        .map((g) => {
          const oppDefense = adjDefense.get(g.opponent) ?? leagueAvgDefense;
          return g.offensePpa! - (oppDefense - leagueAvgDefense);
        });

      const defenseValues = games
        .filter((g) => g.defensePpa !== null)
        .map((g) => {
          const oppOffense = adjOffense.get(g.opponent) ?? leagueAvgOffense;
          return g.defensePpa! - (oppOffense - leagueAvgOffense);
        });

      nextOffense.set(team, offenseValues.length ? mean(offenseValues) : leagueAvgOffense);
      nextDefense.set(team, defenseValues.length ? mean(defenseValues) : leagueAvgDefense);
    }

    let maxDelta = 0;
    for (const team of byTeam.keys()) {
      maxDelta = Math.max(
        maxDelta,
        Math.abs((nextOffense.get(team) ?? 0) - (adjOffense.get(team) ?? 0)),
        Math.abs((nextDefense.get(team) ?? 0) - (adjDefense.get(team) ?? 0))
      );
    }

    adjOffense = nextOffense;
    adjDefense = nextDefense;

    if (maxDelta < CONVERGENCE_EPSILON) break;
  }

  return { adjOffense, adjDefense, gamesByTeam: byTeam };
}

/** Classic iterative margin-based SRS: rating_i = avgMargin_i + mean(rating of opponents). */
function computeSrs(teamNames: string[], games: GameInput[]) {
  const byTeam = new Map<string, { opponent: string; margin: number }[]>();
  for (const name of teamNames) byTeam.set(name, []);

  for (const g of games) {
    if (!g.completed || g.homePoints === null || g.awayPoints === null) continue;
    if (!byTeam.has(g.homeTeam)) byTeam.set(g.homeTeam, []);
    if (!byTeam.has(g.awayTeam)) byTeam.set(g.awayTeam, []);
    byTeam.get(g.homeTeam)!.push({ opponent: g.awayTeam, margin: g.homePoints - g.awayPoints });
    byTeam.get(g.awayTeam)!.push({ opponent: g.homeTeam, margin: g.awayPoints - g.homePoints });
  }

  let srs = new Map<string, number>();
  for (const [team, results] of byTeam) {
    srs.set(team, mean(results.map((r) => r.margin)));
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const next = new Map<string, number>();
    for (const [team, results] of byTeam) {
      if (results.length === 0) {
        next.set(team, srs.get(team) ?? 0);
        continue;
      }
      next.set(
        team,
        mean(results.map((r) => r.margin + (srs.get(r.opponent) ?? 0)))
      );
    }

    // Re-center so the FBS-wide average SRS is 0 (prevents drift).
    const avg = mean(Array.from(next.values()));
    for (const team of next.keys()) next.set(team, next.get(team)! - avg);

    let maxDelta = 0;
    for (const team of byTeam.keys()) {
      maxDelta = Math.max(maxDelta, Math.abs((next.get(team) ?? 0) - (srs.get(team) ?? 0)));
    }
    srs = next;
    if (maxDelta < CONVERGENCE_EPSILON) break;
  }

  return { srs, gamesByTeam: byTeam };
}

export function computeRatings(
  teams: TeamInput[],
  games: GameInput[],
  efficiencyRows: EfficiencyRow[]
): RatingRow[] {
  const teamNames = teams.map((t) => t.school);
  const { adjOffense, adjDefense, gamesByTeam: effGamesByTeam } = computeAdjustedEfficiency(
    teamNames,
    efficiencyRows
  );
  const { srs, gamesByTeam: srsGamesByTeam } = computeSrs(teamNames, games);

  // Overall efficiency rating in "points above average per game" terms.
  const efficiencyOverall = new Map<string, number>();
  for (const team of teamNames) {
    const off = adjOffense.get(team) ?? 0;
    const def = adjDefense.get(team) ?? 0;
    efficiencyOverall.set(team, (off - def) * PLAYS_PER_GAME_SCALE);
  }

  const blendedOverall = new Map<string, number>();
  for (const team of teamNames) {
    const eff = efficiencyOverall.get(team) ?? 0;
    const margin = srs.get(team) ?? 0;
    blendedOverall.set(team, EFFICIENCY_WEIGHT * eff + SRS_WEIGHT * margin);
  }

  // Strength of schedule: average blended-overall rating of opponents actually played.
  const sos = new Map<string, number>();
  for (const team of teamNames) {
    const opponents = (srsGamesByTeam.get(team) ?? []).map((g) => g.opponent);
    sos.set(team, mean(opponents.map((o) => blendedOverall.get(o) ?? 0)));
  }

  const teamByName = new Map(teams.map((t) => [t.school, t]));

  const rows: RatingRow[] = teamNames.map((team) => {
    const t = teamByName.get(team)!;
    return {
      teamId: t.id,
      team,
      conference: t.conference,
      offenseRating: adjOffense.get(team) ?? 0,
      defenseRating: adjDefense.get(team) ?? 0,
      overallRating: blendedOverall.get(team) ?? 0,
      srsRating: srs.get(team) ?? 0,
      sosRating: sos.get(team) ?? 0,
      gamesPlayed: (effGamesByTeam.get(team) ?? []).length,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.overallRating - a.overallRating);
  rows.forEach((row, i) => (row.rank = i + 1));

  return rows;
}

/** Win probability & predicted margin for team A hosting (or neutral vs) team B. */
export function predictMatchup(
  ratingA: RatingRow,
  ratingB: RatingRow,
  opts: { neutralSite?: boolean } = {}
) {
  const HOME_FIELD_ADVANTAGE = 2.2; // points, applied to the home team only
  const homeBump = opts.neutralSite ? 0 : HOME_FIELD_ADVANTAGE;
  const predictedMargin = ratingA.overallRating - ratingB.overallRating + homeBump;

  // Logistic mapping from predicted point margin to win probability.
  // Scale factor chosen so that a ~14-point favorite is roughly an 80% favorite.
  const SCALE = 9.5;
  const winProbA = 1 / (1 + Math.exp(-predictedMargin / SCALE));

  return {
    predictedMargin,
    winProbA,
    winProbB: 1 - winProbA,
  };
}
