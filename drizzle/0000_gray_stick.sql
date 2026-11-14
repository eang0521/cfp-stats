CREATE TABLE "games" (
	"id" bigint PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"season_type" text NOT NULL,
	"start_date" timestamp with time zone,
	"completed" boolean DEFAULT false NOT NULL,
	"neutral_site" boolean DEFAULT false NOT NULL,
	"conference_game" boolean DEFAULT false NOT NULL,
	"notes" text,
	"venue" text,
	"home_team_id" integer,
	"home_team" text NOT NULL,
	"home_conference" text,
	"home_points" integer,
	"away_team_id" integer,
	"away_team" text NOT NULL,
	"away_conference" text,
	"away_points" integer
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"as_of_week" integer NOT NULL,
	"team_id" integer NOT NULL,
	"team" text NOT NULL,
	"conference" text,
	"offense_rating" real NOT NULL,
	"defense_rating" real NOT NULL,
	"overall_rating" real NOT NULL,
	"srs_rating" real,
	"sos_rating" real,
	"rank" integer,
	"games_played" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"season" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "team_game_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"game_id" bigint NOT NULL,
	"team" text NOT NULL,
	"opponent" text NOT NULL,
	"offense_ppa" real,
	"offense_success_rate" real,
	"offense_explosiveness" real,
	"offense_plays" integer,
	"defense_ppa" real,
	"defense_success_rate" real,
	"defense_explosiveness" real,
	"defense_plays" integer,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "team_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"team_id" integer NOT NULL,
	"team" text NOT NULL,
	"conference" text,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"ties" integer DEFAULT 0 NOT NULL,
	"conference_wins" integer DEFAULT 0 NOT NULL,
	"conference_losses" integer DEFAULT 0 NOT NULL,
	"conference_ties" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY NOT NULL,
	"school" text NOT NULL,
	"mascot" text,
	"abbreviation" text,
	"conference" text,
	"division" text,
	"classification" text,
	"color" text,
	"alt_color" text,
	"logo" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_season_team_unique" ON "ratings" USING btree ("season","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_game_stats_game_team_unique" ON "team_game_stats" USING btree ("game_id","team");--> statement-breakpoint
CREATE UNIQUE INDEX "team_records_season_team_unique" ON "team_records" USING btree ("season","team_id");