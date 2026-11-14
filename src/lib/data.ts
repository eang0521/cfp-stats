import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { games, ratings, teamRecords, teams } from "./db/schema";
import { currentSeasonYear } from "./ingest";
import {
  buildCfpField,
  determineConferenceChampions,
  type CfpTeam,
  type ConferenceChampion,
} from "./ratings/cfp";
import type { RatingRow } from "./ratings/engine";

export async function getLatestSeason(): Promise<number> {
  const [row] = await db
    .select({ season: ratings.season })
    .from(ratings)
    .orderBy(desc(ratings.season))
    .limit(1);
  return row?.season ?? currentSeasonYear();
}

export async function getRankings(season?: number) {
  const year = season ?? (await getLatestSeason());
  const rows = await db
    .select()
    .from(ratings)
    .where(eq(ratings.season, year))
    .orderBy(ratings.rank);
  return { season: year, rows };
}

export async function getTeamDetail(teamId: number, season?: number) {
  const year = season ?? (await getLatestSeason());

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  const [rating] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.season, year), eq(ratings.teamId, teamId)));

  const teamGames = team
    ? await db
        .select()
        .from(games)
        .where(
          and(
            eq(games.season, year),
            or(eq(games.homeTeam, team.school), eq(games.awayTeam, team.school))
          )
        )
        .orderBy(games.week)
    : [];

  return { team, rating, games: teamGames, season: year };
}

export async function getWeekSchedule(season?: number, week?: number) {
  const year = season ?? (await getLatestSeason());

  let targetWeek = week;
  if (targetWeek === undefined) {
    const [next] = await db
      .select({ week: games.week })
      .from(games)
      .where(and(eq(games.season, year), eq(games.completed, false)))
      .orderBy(games.week)
      .limit(1);
    targetWeek = next?.week;
  }

  if (targetWeek === undefined) {
    return { season: year, week: null, games: [] };
  }

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.season, year), eq(games.week, targetWeek)))
    .orderBy(games.startDate);

  return { season: year, week: targetWeek, games: rows };
}

export async function getCfpProjection(season?: number): Promise<{
  season: number;
  asOfWeek: number;
  field: CfpTeam[];
  champions: ConferenceChampion[];
}> {
  const year = season ?? (await getLatestSeason());

  const ratingRows = await db
    .select()
    .from(ratings)
    .where(eq(ratings.season, year))
    .orderBy(ratings.rank);

  const asOfWeek = ratingRows[0]?.asOfWeek ?? 0;

  const recordRows = await db
    .select()
    .from(teamRecords)
    .where(eq(teamRecords.season, year));

  const gameRows = await db
    .select()
    .from(games)
    .where(eq(games.season, year));

  const ratingByTeam = new Map<string, RatingRow>(
    ratingRows.map((r) => [
      r.team,
      {
        teamId: r.teamId,
        team: r.team,
        conference: r.conference,
        offenseRating: r.offenseRating,
        defenseRating: r.defenseRating,
        overallRating: r.overallRating,
        srsRating: r.srsRating ?? 0,
        sosRating: r.sosRating ?? 0,
        sovRating: r.sovRating ?? 0,
        sososRating: r.sososRating ?? 0,
        wins: r.wins,
        losses: r.losses,
        gamesPlayed: r.gamesPlayed,
        rank: r.rank ?? 0,
      },
    ])
  );

  const champions = determineConferenceChampions(
    gameRows.map((g) => ({
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homePoints: g.homePoints,
      awayPoints: g.awayPoints,
      completed: g.completed,
      notes: g.notes,
      seasonType: g.seasonType,
    })),
    recordRows.map((r) => ({
      team: r.team,
      conference: r.conference,
      conferenceWins: r.conferenceWins,
      conferenceLosses: r.conferenceLosses,
      conferenceTies: r.conferenceTies,
    })),
    ratingByTeam
  );

  const field = buildCfpField(Array.from(ratingByTeam.values()), champions);

  return { season: year, asOfWeek, field, champions };
}

export async function getRefreshStatus() {
  const rows = await db.execute(
    sql`select * from refresh_log order by started_at desc limit 1`
  );
  return rows.rows[0] as
    | { started_at: string; finished_at: string | null; status: string; detail: string | null }
    | undefined;
}
