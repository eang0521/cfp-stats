import { eq, sql } from "drizzle-orm";
import { db } from "./db/client";
import { games, ratings, refreshLog, teamGameStats, teamRecords, teams } from "./db/schema";
import { cfbd } from "./cfbd/client";
import { computeRatings, type EfficiencyRow, type GameInput, type TeamInput } from "./ratings/engine";

export function currentSeasonYear(): number {
  const now = new Date();
  // CFB seasons run Aug (regular season start) through mid-Jan (CFP final).
  // Treat Feb-Jun as off-season, still pointing at the season that just ended.
  const month = now.getMonth(); // 0-indexed
  return month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertTeams(season: number) {
  const cfbdTeams = await cfbd.teams({ year: season });
  for (const batch of chunk(cfbdTeams, 200)) {
    await db
      .insert(teams)
      .values(
        batch.map((t) => ({
          id: t.id,
          school: t.school,
          mascot: t.mascot,
          abbreviation: t.abbreviation,
          conference: t.conference,
          division: t.division,
          classification: t.classification,
          color: t.color,
          altColor: t.altColor,
          logo: t.logos?.[0] ?? null,
        }))
      )
      .onConflictDoUpdate({
        target: teams.id,
        set: {
          school: sql`excluded.school`,
          mascot: sql`excluded.mascot`,
          abbreviation: sql`excluded.abbreviation`,
          conference: sql`excluded.conference`,
          division: sql`excluded.division`,
          classification: sql`excluded.classification`,
          color: sql`excluded.color`,
          altColor: sql`excluded.alt_color`,
          logo: sql`excluded.logo`,
        },
      });
  }
  return cfbdTeams;
}

async function upsertGames(season: number, fbsTeamNames: Set<string>) {
  const regular = await cfbd.games({ year: season, seasonType: "regular" });
  const postseason = await cfbd.games({ year: season, seasonType: "postseason" });
  // CFBD's /games returns every classification (FBS, FCS, D2, D3...) for the
  // year with no server-side filter for it. Keep only games with at least one
  // FBS side - this is what "every FBS game" means, and it also drops the
  // small-college games whose `completed` flag CFBD rarely bothers to set,
  // which would otherwise make "find the next incomplete week" logic stick
  // on a long-finished week.
  const allGames = [...regular, ...postseason].filter(
    (g) => fbsTeamNames.has(g.homeTeam) || fbsTeamNames.has(g.awayTeam)
  );

  // Full replace rather than upsert-only, so a game that no longer qualifies
  // (or stale rows from before this filter existed) don't linger forever.
  await db.delete(games).where(eq(games.season, season));

  for (const batch of chunk(allGames, 200)) {
    await db
      .insert(games)
      .values(
        batch.map((g) => ({
          id: g.id,
          season: g.season,
          week: g.week,
          seasonType: g.seasonType,
          startDate: g.startDate ? new Date(g.startDate) : null,
          completed: g.completed,
          neutralSite: g.neutralSite,
          conferenceGame: g.conferenceGame,
          notes: g.notes,
          venue: g.venue,
          homeTeamId: g.homeTeamId,
          homeTeam: g.homeTeam,
          homeConference: g.homeConference,
          homePoints: g.homePoints,
          awayTeamId: g.awayTeamId,
          awayTeam: g.awayTeam,
          awayConference: g.awayConference,
          awayPoints: g.awayPoints,
        }))
      )
      .onConflictDoUpdate({
        target: games.id,
        set: {
          completed: sql`excluded.completed`,
          homePoints: sql`excluded.home_points`,
          awayPoints: sql`excluded.away_points`,
          notes: sql`excluded.notes`,
          startDate: sql`excluded.start_date`,
        },
      });
  }

  return allGames;
}

async function upsertAdvancedStats(season: number, fbsTeamNames: Set<string>) {
  const allRows = await cfbd.advancedGameStats({ year: season });
  const rows = allRows.filter((r) => fbsTeamNames.has(r.team));

  await db.delete(teamGameStats).where(eq(teamGameStats.season, season));

  for (const batch of chunk(rows, 200)) {
    await db
      .insert(teamGameStats)
      .values(
        batch.map((r) => ({
          season: r.season,
          week: r.week,
          gameId: r.gameId,
          team: r.team,
          opponent: r.opponent,
          offensePpa: r.offense?.ppa ?? null,
          offenseSuccessRate: r.offense?.successRate ?? null,
          offenseExplosiveness: r.offense?.explosiveness ?? null,
          offensePlays: r.offense?.plays ?? null,
          defensePpa: r.defense?.ppa ?? null,
          defenseSuccessRate: r.defense?.successRate ?? null,
          defenseExplosiveness: r.defense?.explosiveness ?? null,
          defensePlays: r.defense?.plays ?? null,
          raw: r,
        }))
      )
      .onConflictDoUpdate({
        target: [teamGameStats.gameId, teamGameStats.team],
        set: {
          offensePpa: sql`excluded.offense_ppa`,
          offenseSuccessRate: sql`excluded.offense_success_rate`,
          offenseExplosiveness: sql`excluded.offense_explosiveness`,
          offensePlays: sql`excluded.offense_plays`,
          defensePpa: sql`excluded.defense_ppa`,
          defenseSuccessRate: sql`excluded.defense_success_rate`,
          defenseExplosiveness: sql`excluded.defense_explosiveness`,
          defensePlays: sql`excluded.defense_plays`,
          raw: sql`excluded.raw`,
        },
      });
  }

  return rows;
}

async function upsertRecords(season: number, fbsTeamNames: Set<string>) {
  const allRows = await cfbd.records({ year: season });
  const rows = allRows.filter((r) => fbsTeamNames.has(r.team));

  await db.delete(teamRecords).where(eq(teamRecords.season, season));

  for (const batch of chunk(rows, 200)) {
    await db
      .insert(teamRecords)
      .values(
        batch.map((r) => ({
          season: r.year,
          teamId: r.teamId,
          team: r.team,
          conference: r.conference,
          wins: r.total?.wins ?? 0,
          losses: r.total?.losses ?? 0,
          ties: r.total?.ties ?? 0,
          conferenceWins: r.conferenceGames?.wins ?? 0,
          conferenceLosses: r.conferenceGames?.losses ?? 0,
          conferenceTies: r.conferenceGames?.ties ?? 0,
        }))
      )
      .onConflictDoUpdate({
        target: [teamRecords.season, teamRecords.teamId],
        set: {
          wins: sql`excluded.wins`,
          losses: sql`excluded.losses`,
          ties: sql`excluded.ties`,
          conferenceWins: sql`excluded.conference_wins`,
          conferenceLosses: sql`excluded.conference_losses`,
          conferenceTies: sql`excluded.conference_ties`,
        },
      });
  }

  return rows;
}

export async function runIngest(season: number = currentSeasonYear()) {
  const [log] = await db
    .insert(refreshLog)
    .values({ season, status: "running" })
    .returning();

  try {
    const cfbdTeams = await upsertTeams(season);
    const fbsTeamNames = new Set(cfbdTeams.map((t) => t.school));
    const allGames = await upsertGames(season, fbsTeamNames);
    const advancedStats = await upsertAdvancedStats(season, fbsTeamNames);
    await upsertRecords(season, fbsTeamNames);

    const teamInputs: TeamInput[] = cfbdTeams.map((t) => ({
      id: t.id,
      school: t.school,
      conference: t.conference,
    }));

    const gameInputs: GameInput[] = allGames.map((g) => ({
      gameId: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homePoints: g.homePoints,
      awayPoints: g.awayPoints,
      completed: g.completed,
    }));

    const efficiencyRows: EfficiencyRow[] = advancedStats.map((r) => ({
      gameId: r.gameId,
      team: r.team,
      opponent: r.opponent,
      offensePpa: r.offense?.ppa ?? null,
      defensePpa: r.defense?.ppa ?? null,
    }));

    const computed = computeRatings(teamInputs, gameInputs, efficiencyRows);

    const completedWeeks = allGames.filter((g) => g.completed).map((g) => g.week);
    const asOfWeek = completedWeeks.length ? Math.max(...completedWeeks) : 0;

    for (const batch of chunk(computed, 200)) {
      await db
        .insert(ratings)
        .values(
          batch.map((r) => ({
            season,
            asOfWeek,
            teamId: r.teamId,
            team: r.team,
            conference: r.conference,
            offenseRating: r.offenseRating,
            defenseRating: r.defenseRating,
            overallRating: r.overallRating,
            srsRating: r.srsRating,
            sosRating: r.sosRating,
            sovRating: r.sovRating,
            wins: r.wins,
            losses: r.losses,
            rank: r.rank,
            gamesPlayed: r.gamesPlayed,
            computedAt: new Date(),
          }))
        )
        .onConflictDoUpdate({
          target: [ratings.season, ratings.teamId],
          set: {
            asOfWeek: sql`excluded.as_of_week`,
            conference: sql`excluded.conference`,
            offenseRating: sql`excluded.offense_rating`,
            defenseRating: sql`excluded.defense_rating`,
            overallRating: sql`excluded.overall_rating`,
            srsRating: sql`excluded.srs_rating`,
            sosRating: sql`excluded.sos_rating`,
            sovRating: sql`excluded.sov_rating`,
            wins: sql`excluded.wins`,
            losses: sql`excluded.losses`,
            rank: sql`excluded.rank`,
            gamesPlayed: sql`excluded.games_played`,
            computedAt: sql`excluded.computed_at`,
          },
        });
    }

    await db
      .update(refreshLog)
      .set({
        status: "success",
        finishedAt: new Date(),
        detail: `teams=${cfbdTeams.length} games=${allGames.length} statRows=${advancedStats.length} ratings=${computed.length} asOfWeek=${asOfWeek}`,
      })
      .where(sql`${refreshLog.id} = ${log.id}`);

    return { season, asOfWeek, teams: cfbdTeams.length, games: allGames.length, ratings: computed.length };
  } catch (err) {
    await db
      .update(refreshLog)
      .set({
        status: "error",
        finishedAt: new Date(),
        detail: err instanceof Error ? err.message : String(err),
      })
      .where(sql`${refreshLog.id} = ${log.id}`);
    throw err;
  }
}
