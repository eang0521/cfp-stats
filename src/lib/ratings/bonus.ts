// Supplementary, purely data-derived "resume" stats. Kept separate from
// engine.ts's opponent-adjustment math - these are straightforward season
// aggregates computed directly from raw CFBD data, not part of the
// iterative rating solve.
import type { CfbdBettingLine, CfbdGameTeamStats, CfbdPollWeek } from "../cfbd/client";

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

interface AdvancedStatInput {
  team: string;
  offenseSuccessRate: number | null;
  offenseExplosiveness: number | null;
  defenseSuccessRate: number | null;
  defenseExplosiveness: number | null;
}

/**
 * Raw (not opponent-adjusted) net success rate and explosiveness: this
 * team's offensive average minus its defensive average (i.e. allowed).
 * Unlike the engine's adjusted PPA ratings, these aren't solved against
 * opponent strength - they're a direct season snapshot.
 */
export function computeSuccessRateExplosiveness(
  rows: AdvancedStatInput[]
): Map<string, { successRateNet: number; explosivenessNet: number }> {
  const byTeam = new Map<string, AdvancedStatInput[]>();
  for (const r of rows) {
    if (!byTeam.has(r.team)) byTeam.set(r.team, []);
    byTeam.get(r.team)!.push(r);
  }

  const result = new Map<string, { successRateNet: number; explosivenessNet: number }>();
  for (const [team, teamRows] of byTeam) {
    const offSR = mean(teamRows.map((g) => g.offenseSuccessRate).filter(isNum));
    const defSR = mean(teamRows.map((g) => g.defenseSuccessRate).filter(isNum));
    const offExp = mean(teamRows.map((g) => g.offenseExplosiveness).filter(isNum));
    const defExp = mean(teamRows.map((g) => g.defenseExplosiveness).filter(isNum));
    result.set(team, { successRateNet: offSR - defSR, explosivenessNet: offExp - defExp });
  }
  return result;
}

/**
 * Average (opponent turnovers - own turnovers) per game. CFBD's box-score
 * "turnovers" category per team per game; a game only counts if both sides'
 * turnover counts are present.
 */
export function computeTurnoverMargin(
  games: CfbdGameTeamStats[],
  fbsTeamNames: Set<string>
): Map<string, number> {
  const perTeam = new Map<string, number[]>();

  for (const game of games) {
    const withTurnovers = game.teams
      .map((t) => {
        const stat = t.stats.find((s) => s.category.toLowerCase() === "turnovers");
        const turnovers = stat ? Number(stat.stat) : NaN;
        return { team: t.team, turnovers };
      })
      .filter((t) => Number.isFinite(t.turnovers));

    if (withTurnovers.length !== 2) continue; // need both sides to compute a margin
    const [a, b] = withTurnovers;

    if (fbsTeamNames.has(a.team)) {
      if (!perTeam.has(a.team)) perTeam.set(a.team, []);
      perTeam.get(a.team)!.push(b.turnovers - a.turnovers);
    }
    if (fbsTeamNames.has(b.team)) {
      if (!perTeam.has(b.team)) perTeam.set(b.team, []);
      perTeam.get(b.team)!.push(a.turnovers - b.turnovers);
    }
  }

  const result = new Map<string, number>();
  for (const [team, margins] of perTeam) result.set(team, mean(margins));
  return result;
}

/**
 * Average (actual margin - consensus closing spread) per game that had a
 * posted line, from the home team's perspective then flipped for the away
 * team. Spread convention: negative favors the home team.
 */
export function computeAtsMargin(
  lines: CfbdBettingLine[],
  fbsTeamNames: Set<string>
): Map<string, number> {
  const perTeam = new Map<string, number[]>();

  for (const game of lines) {
    if (game.homeScore === null || game.awayScore === null) continue;

    const spreads = game.lines
      .map((l) => l.spread)
      .filter((s): s is number => s !== null && Number.isFinite(s));
    if (spreads.length === 0) continue;

    const consensusSpread = mean(spreads);
    const actualHomeMargin = game.homeScore - game.awayScore;
    const impliedHomeMargin = -consensusSpread;
    const atsHome = actualHomeMargin - impliedHomeMargin;

    if (fbsTeamNames.has(game.homeTeam)) {
      if (!perTeam.has(game.homeTeam)) perTeam.set(game.homeTeam, []);
      perTeam.get(game.homeTeam)!.push(atsHome);
    }
    if (fbsTeamNames.has(game.awayTeam)) {
      if (!perTeam.has(game.awayTeam)) perTeam.set(game.awayTeam, []);
      perTeam.get(game.awayTeam)!.push(-atsHome);
    }
  }

  const result = new Map<string, number>();
  for (const [team, margins] of perTeam) result.set(team, mean(margins));
  return result;
}

interface GameForQualityWins {
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  week: number;
  seasonType: string;
}

/**
 * Count of wins over a team that was ranked in the AP Top 25 at the time of
 * the game - the regular-season poll for that exact week, or the final
 * regular-season poll for postseason (bowl/playoff) games.
 */
export function computeQualityWins(
  games: GameForQualityWins[],
  fbsTeamNames: Set<string>,
  pollWeeks: CfbdPollWeek[]
): Map<string, number> {
  const rankedByWeek = new Map<number, Set<string>>();
  let finalRanked = new Set<string>();
  let finalWeek = -1;

  for (const pw of pollWeeks) {
    if (pw.seasonType !== "regular") continue;
    const apPoll = pw.polls.find((p) => /^ap\b/i.test(p.poll.trim()));
    if (!apPoll) continue;

    const ranked = new Set(
      apPoll.ranks.filter((r) => r.rank !== null && r.rank <= 25).map((r) => r.school)
    );
    rankedByWeek.set(pw.week, ranked);
    if (pw.week > finalWeek) {
      finalWeek = pw.week;
      finalRanked = ranked;
    }
  }

  const qualityWins = new Map<string, number>();
  for (const name of fbsTeamNames) qualityWins.set(name, 0);

  for (const g of games) {
    if (!g.completed || g.homePoints === null || g.awayPoints === null) continue;
    if (g.homePoints === g.awayPoints) continue;

    const winner = g.homePoints > g.awayPoints ? g.homeTeam : g.awayTeam;
    const loser = winner === g.homeTeam ? g.awayTeam : g.homeTeam;
    if (!qualityWins.has(winner)) continue;

    const rankedSet = g.seasonType === "postseason" ? finalRanked : rankedByWeek.get(g.week) ?? new Set<string>();
    if (rankedSet.has(loser)) {
      qualityWins.set(winner, (qualityWins.get(winner) ?? 0) + 1);
    }
  }

  return qualityWins;
}
