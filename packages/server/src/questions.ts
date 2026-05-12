import type { Question, Room } from "@wyr/shared";
import { randomId } from "./room-store";

export const SEED_QUESTIONS: { optionA: string; optionB: string }[] = [
  { optionA: "have super speed", optionB: "be able to fly" },
  { optionA: "be invisible at will", optionB: "be able to read minds" },
  { optionA: "live without music", optionB: "live without movies" },
  { optionA: "have unlimited pizza", optionB: "have unlimited tacos" },
  { optionA: "never feel cold again", optionB: "never feel hot again" },
  { optionA: "be famous but poor", optionB: "be rich but unknown" },
  {
    optionA: "always know when someone is lying",
    optionB: "always get away with lying",
  },
  {
    optionA: "have a rewind button for your life",
    optionB: "have a pause button for your life",
  },
  {
    optionA: "be able to talk to animals",
    optionB: "be able to speak every human language",
  },
  { optionA: "live in a treehouse", optionB: "live on a houseboat" },
  { optionA: "never need sleep", optionB: "never need to eat" },
  { optionA: "visit the past", optionB: "visit the future" },
  {
    optionA: "be the smartest person alive",
    optionB: "be the strongest person alive",
  },
  { optionA: "have free Wi-Fi anywhere", optionB: "have free coffee anywhere" },
  {
    optionA: "always be 10 minutes early",
    optionB: "always be 10 minutes late",
  },
  { optionA: "work from a beach", optionB: "work from a mountain cabin" },
  { optionA: "have a great memory", optionB: "have great instincts" },
  { optionA: "be a famous athlete", optionB: "be a famous musician" },
  { optionA: "lose all your photos", optionB: "lose all your messages" },
  { optionA: "control fire", optionB: "control water" },
  { optionA: "have a pet dragon", optionB: "have a pet unicorn" },
  {
    optionA: "spend a week in space",
    optionB: "spend a week in the deep ocean",
  },
  {
    optionA: "meet your favorite musician",
    optionB: "meet your favorite author",
  },
  {
    optionA: "live without a phone for a year",
    optionB: "live without TV for a year",
  },
  { optionA: "be excellent at one thing", optionB: "be good at many things" },
  { optionA: "be the best villain", optionB: "be the second-best hero" },
  {
    optionA: "live where it always snows",
    optionB: "live where it never rains",
  },
  { optionA: "have endless free time", optionB: "have endless money" },
  { optionA: "always tell the truth", optionB: "never have to apologize" },
  {
    optionA: "never use the internet again",
    optionB: "never travel further than 100 km",
  },
];

export function prepareGameQuestions(room: Room): Question[] {
  const pool: Question[] = [];

  if (
    room.settings.questionSource === "public" ||
    room.settings.questionSource === "both"
  ) {
    for (const seed of SEED_QUESTIONS) {
      pool.push({
        id: randomId("q"),
        optionA: seed.optionA,
        optionB: seed.optionB,
        categoryId: null,
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

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool;
}
