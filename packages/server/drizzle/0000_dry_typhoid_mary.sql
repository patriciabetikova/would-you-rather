CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"category_id" integer,
	"submitter_nickname" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"approved" boolean DEFAULT true NOT NULL,
	"times_shown" integer DEFAULT 0 NOT NULL,
	"rating_up" integer DEFAULT 0 NOT NULL,
	"rating_down" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;