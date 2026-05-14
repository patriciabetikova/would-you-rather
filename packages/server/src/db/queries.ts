import { eq, sql } from "drizzle-orm";
import type { Question, Room } from "@wyr/shared";
import { db } from "./client";
import { questions } from "./schema";

/**
 * Builds the per-game question pool, drawing from Postgres for public-pool
 * questions and from the room's in-memory customQuestions for room-scoped.
 */
export async function prepareGameQuestions(room: Room): Promise<Question[]> {
  const pool: Question[] = [];

  if (
    room.settings.questionSource === "public" ||
    room.settings.questionSource === "both"
  ) {
    const limit = room.settings.numberOfRounds * 2; // headroom

    const rows =
      room.settings.selectionMode === "popular"
        ? await db
            .select()
            .from(questions)
            .where(eq(questions.approved, true))
            .orderBy(
              sql`(${questions.ratingUp} - ${questions.ratingDown}) DESC`,
              sql`${questions.ratingUp} DESC`,
            )
            .limit(limit)
        : await db
            .select()
            .from(questions)
            .where(eq(questions.approved, true))
            .orderBy(sql`RANDOM()`)
            .limit(limit);

    for (const r of rows) {
      pool.push({
        id: r.id,
        optionA: r.optionA,
        optionB: r.optionB,
        categoryId: r.categoryId,
        isCustom: false,
      });
    }
  }

  if (
    room.settings.questionSource === "custom" ||
    room.settings.questionSource === "both"
  ) {
    pool.push(...room.customQuestions.map((q) => ({ ...q })));
  }

  // Fisher-Yates shuffle (esp. important when mode is 'both' so customs aren't grouped)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool;
}

/**
 * Persists a user-submitted public question.
 */
export async function insertPublicQuestion(input: {
  optionA: string;
  optionB: string;
  categoryId: number | null;
  submitterNickname?: string | null;
}): Promise<void> {
  await db.insert(questions).values({
    optionA: input.optionA,
    optionB: input.optionB,
    categoryId: input.categoryId,
    submitterNickname: input.submitterNickname ?? null,
  });
}
