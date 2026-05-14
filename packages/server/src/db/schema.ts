import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  emoji: text("emoji"),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  submitterNickname: text("submitter_nickname"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  approved: boolean("approved").default(true).notNull(),
  timesShown: integer("times_shown").default(0).notNull(),
  ratingUp: integer("rating_up").default(0).notNull(),
  ratingDown: integer("rating_down").default(0).notNull(),
});

export type DbQuestion = typeof questions.$inferSelect;
export type NewDbQuestion = typeof questions.$inferInsert;
