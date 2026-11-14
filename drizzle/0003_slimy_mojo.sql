ALTER TABLE "ratings" ADD COLUMN "success_rate_net" real;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "explosiveness_net" real;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "turnover_margin" real;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "ats_margin" real;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "quality_wins" integer DEFAULT 0 NOT NULL;