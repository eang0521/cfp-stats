ALTER TABLE "ratings" ADD COLUMN "sov_rating" real;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "losses" integer DEFAULT 0 NOT NULL;