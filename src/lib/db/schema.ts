import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  jsonb,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: integer("id").primaryKey(), // CFBD team id
  school: text("school").notNull(),
  mascot: text("mascot"),
  abbreviation: text("abbreviation"),
  conference: text("conference"),
  division: text("division"), // FBS division (e.g. SEC East) if applicable
  classification: text("classification"), // fbs
  color: text("color"),
  altColor: text("alt_color"),
  logo: text("logo"),
});

export const games = pgTable("games", {
  id: bigint("id", { mode: "number" }).primaryKey(), // CFBD game id
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  seasonType: text("season_type").notNull(), // regular | postseason
  startDate: timestamp("start_date", { withTimezone: true }),
  completed: boolean("completed").notNull().default(false),
  neutralSite: boolean("neutral_site").notNull().default(false),
  conferenceGame: boolean("conference_game").notNull().default(false),
  notes: text("notes"), // e.g. "SEC Championship" - used to detect title games
  venue: text("venue"),
  homeTeamId: integer("home_team_id"),
  homeTeam: text("home_team").notNull(),
  homeConference: text("home_conference"),
  homePoints: integer("home_points"),
  awayTeamId: integer("away_team_id"),
  awayTeam: text("away_team").notNull(),
  awayConference: text("away_conference"),
  awayPoints: integer("away_points"),
});

// Per-game advanced/efficiency stats for one team (one row per team per game)
export const teamGameStats = pgTable(
  "team_game_stats",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    gameId: bigint("game_id", { mode: "number" }).notNull(),
    team: text("team").notNull(),
    opponent: text("opponent").notNull(),
    offensePpa: real("offense_ppa"),
    offenseSuccessRate: real("offense_success_rate"),
    offenseExplosiveness: real("offense_explosiveness"),
    offensePlays: integer("offense_plays"),
    defensePpa: real("defense_ppa"),
    defenseSuccessRate: real("defense_success_rate"),
    defenseExplosiveness: real("defense_explosiveness"),
    defensePlays: integer("defense_plays"),
    raw: jsonb("raw"),
  },
  (t) => ({
    gameTeamUnique: uniqueIndex("team_game_stats_game_team_unique").on(
      t.gameId,
      t.team
    ),
  })
);

// Season win/loss + conference win/loss records, used for standings & CFP champ detection
export const teamRecords = pgTable(
  "team_records",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    teamId: integer("team_id").notNull(),
    team: text("team").notNull(),
    conference: text("conference"),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    ties: integer("ties").notNull().default(0),
    conferenceWins: integer("conference_wins").notNull().default(0),
    conferenceLosses: integer("conference_losses").notNull().default(0),
    conferenceTies: integer("conference_ties").notNull().default(0),
  },
  (t) => ({
    seasonTeamUnique: uniqueIndex("team_records_season_team_unique").on(
      t.season,
      t.teamId
    ),
  })
);

// Computed ratings snapshot, refreshed on every ingest run
export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    asOfWeek: integer("as_of_week").notNull(),
    teamId: integer("team_id").notNull(),
    team: text("team").notNull(),
    conference: text("conference"),
    offenseRating: real("offense_rating").notNull(), // adjusted PPA/play, higher = better
    defenseRating: real("defense_rating").notNull(), // adjusted PPA/play allowed, lower = better
    overallRating: real("overall_rating").notNull(), // offenseRating - defenseRating, scaled
    srsRating: real("srs_rating"), // margin-based SRS blend component
    sosRating: real("sos_rating"), // avg opponent overall rating (strength of schedule)
    rank: integer("rank"),
    gamesPlayed: integer("games_played").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    seasonTeamUnique: uniqueIndex("ratings_season_team_unique").on(
      t.season,
      t.teamId
    ),
  })
);

export const refreshLog = pgTable("refresh_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  season: integer("season"),
  status: text("status").notNull().default("running"), // running | success | error
  detail: text("detail"),
});
