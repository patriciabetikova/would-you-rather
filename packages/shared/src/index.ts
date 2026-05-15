// @wyr/shared — typed contract between client and server.
// All socket events, game state, and domain types flow through here.
// Both sides import from this single source of truth.

// ============================================================
// VERSION & CONSTANTS
// ============================================================

export const SHARED_VERSION = "0.1.0";

export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS_PER_ROOM = 10;
export const MIN_PLAYERS_TO_START = 2;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 16;
export const QUESTION_OPTION_MIN_LENGTH = 5;
export const QUESTION_OPTION_MAX_LENGTH = 140;

// ============================================================
// DOMAIN TYPES
// ============================================================

export type GameStatus = "lobby" | "in-progress" | "round-results" | "finished";

export type RoundStatus = "voting" | "revealed";

export type VoteOption = "A" | "B";

export type QuestionSource = "public" | "custom" | "both";

export type SelectionMode = "random" | "popular";

export type QuestionRating = "up" | "down";

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isConnected: boolean;
  score: number;
  hasContributedQuestion: boolean;
  joinedAt: number;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  emoji?: string;
}

export interface Question {
  id: string;
  optionA: string;
  optionB: string;
  categoryId: number | null;
  isCustom: boolean; // true for room-scoped, false for public-pool
}

export interface RoundResults {
  votes: Record<string, VoteOption>; // playerId → option voted
  tallyA: number;
  tallyB: number;
}

export interface Round {
  questionId: string;
  question: Question;
  status: RoundStatus;
  startedAt: number; // ms epoch
  endsAt: number; // ms epoch
  votedPlayerIds: string[]; // who has voted (not what, until revealed)
  results: RoundResults | null;
}

export interface GameSettings {
  roundLengthSeconds: 15 | 20 | 30;
  numberOfRounds: 5 | 10 | 15;
  questionSource: QuestionSource;
  requireContribution: boolean;
  selectionMode: SelectionMode;
  categoryIds: number[] | null; // null = all categories
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  roundLengthSeconds: 20,
  numberOfRounds: 10,
  questionSource: "public",
  requireContribution: false,
  selectionMode: "random",
  categoryIds: null,
};

export interface Room {
  code: string;
  hostId: string;
  status: GameStatus;
  players: Player[];
  settings: GameSettings;
  currentRound: Round | null;
  roundNumber: number; // 0 while in lobby
  customQuestions: Question[]; // room-scoped, ephemeral
  createdAt: number;
}

export interface QuestionRatePayload {
  questionId: string;
  rating: QuestionRating;
}

// ============================================================
// ERRORS
// ============================================================

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "NICKNAME_TAKEN"
  | "NICKNAME_INVALID"
  | "NOT_HOST"
  | "NOT_IN_ROOM"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_STARTED"
  | "NOT_ENOUGH_PLAYERS"
  | "CONTRIBUTION_REQUIRED"
  | "INVALID_VOTE"
  | "VOTE_TOO_LATE"
  | "ALREADY_VOTED"
  | "QUESTION_INVALID"
  | "INTERNAL_ERROR";

export interface SocketError {
  code: ErrorCode;
  message: string;
}

// ============================================================
// ACK HELPERS
// ============================================================

export type Ack = { ok: true } | { ok: false; error: SocketError };

export type AckWith<T> =
  | { ok: true; data: T }
  | { ok: false; error: SocketError };

// ============================================================
// EVENT PAYLOADS
// ============================================================

// Client → Server
export interface RoomCreatePayload {
  nickname: string;
}
export interface RoomCreateResponse {
  code: string;
  playerId: string;
}

export interface RoomJoinPayload {
  code: string;
  nickname: string;
}
export interface RoomJoinResponse {
  playerId: string;
}

export interface QuestionSubmitPayload {
  optionA: string;
  optionB: string;
  scope: "public" | "room";
  categoryId: number | null;
}

export interface VoteSubmitPayload {
  option: VoteOption;
}

// Server → Client
export interface RoundStartedPayload {
  roundNumber: number;
  totalRounds: number;
  round: Round;
}

export interface RoundEndedPayload {
  roundNumber: number;
  question: Question;
  results: RoundResults;
}

export interface GameEndedPayload {
  finalScores: Array<{
    playerId: string;
    nickname: string;
    score: number;
    rank: number;
  }>;
}

// ============================================================
// SOCKET.IO EVENT MAPS
// ============================================================

export interface ClientToServerEvents {
  "room:create": (
    payload: RoomCreatePayload,
    ack: (response: AckWith<RoomCreateResponse>) => void,
  ) => void;

  "room:join": (
    payload: RoomJoinPayload,
    ack: (response: AckWith<RoomJoinResponse>) => void,
  ) => void;

  "room:leave": () => void;

  "room:updateSettings": (
    payload: Partial<GameSettings>,
    ack: (response: Ack) => void,
  ) => void;

  "game:start": (ack: (response: Ack) => void) => void;

  "vote:submit": (
    payload: VoteSubmitPayload,
    ack: (response: Ack) => void,
  ) => void;

  "question:submit": (
    payload: QuestionSubmitPayload,
    ack: (response: Ack) => void,
  ) => void;

  "question:rate": (
    payload: QuestionRatePayload,
    ack: (response: Ack) => void,
  ) => void;
}

export interface ServerToClientEvents {
  // Authoritative snapshot — sent after any room state change.
  "room:state": (room: Room) => void;

  // Timed transitions that drive UI animations.
  "round:started": (payload: RoundStartedPayload) => void;
  "round:ended": (payload: RoundEndedPayload) => void;
  "game:ended": (payload: GameEndedPayload) => void;

  // Out-of-band errors not tied to a specific request.
  error: (error: SocketError) => void;
}

export interface InterServerEvents {
  // empty — single server instance for now
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
