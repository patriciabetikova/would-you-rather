// FakeServer — in-memory implementation of server-side game logic.
// Lives entirely in the browser. Replaced by the real server in Phase 4.

import {
  DEFAULT_GAME_SETTINGS,
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  QUESTION_OPTION_MAX_LENGTH,
  QUESTION_OPTION_MIN_LENGTH,
  ROOM_CODE_LENGTH,
} from "@wyr/shared";
import type {
  Ack,
  AckWith,
  ErrorCode,
  GameSettings,
  Player,
  Question,
  QuestionSubmitPayload,
  Room,
  RoomCreatePayload,
  RoomCreateResponse,
  RoomJoinPayload,
  RoomJoinResponse,
  SocketError,
  RoundResults,
  VoteOption,
  VoteSubmitPayload,
} from "@wyr/shared";

const SIMULATED_LATENCY_MS = 80;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit lookalikes
const ROUND_RESULTS_PAUSE_MS = 5000;

// Seed pool of public-pool questions. In production these come from Postgres.
const SEED_QUESTIONS: { optionA: string; optionB: string }[] = [
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

function delay(fn: () => void) {
  setTimeout(fn, SIMULATED_LATENCY_MS);
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code +=
      ROOM_CODE_ALPHABET[
        Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      ]!;
  }
  return code;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function err(code: ErrorCode, message: string): SocketError {
  return { code, message };
}

interface Connection {
  id: string;
  emit: (event: string, ...args: unknown[]) => void;
  playerId?: string;
  roomCode?: string;
}

class FakeServerImpl {
  private rooms = new Map<string, Room>();
  private connections = new Map<string, Connection>();
  private connByPlayer = new Map<string, string>();
  private gameQuestions = new Map<string, Question[]>();
  private votesInProgress = new Map<string, Map<string, VoteOption>>();
  private roundTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private handleUpdateSettings(
    conn: Connection,
    payload: Partial<GameSettings>,
    ack: (r: Ack) => void,
  ): void {
    if (!conn.roomCode) {
      delay(() =>
        ack({ ok: false, error: err("NOT_IN_ROOM", "You are not in a room") }),
      );
      return;
    }
    const room = this.rooms.get(conn.roomCode);
    if (!room) {
      delay(() =>
        ack({
          ok: false,
          error: err("ROOM_NOT_FOUND", "Room no longer exists"),
        }),
      );
      return;
    }
    if (room.hostId !== conn.playerId) {
      delay(() =>
        ack({
          ok: false,
          error: err("NOT_HOST", "Only the host can change settings"),
        }),
      );
      return;
    }
    if (room.status !== "lobby") {
      delay(() =>
        ack({
          ok: false,
          error: err(
            "GAME_ALREADY_STARTED",
            "Settings are locked during the game",
          ),
        }),
      );
      return;
    }

    room.settings = { ...room.settings, ...payload };

    delay(() => {
      ack({ ok: true });
      this.broadcastRoomState(conn.roomCode!);
    });
  }

  private handleQuestionSubmit(
    conn: Connection,
    payload: QuestionSubmitPayload,
    ack: (r: Ack) => void,
  ): void {
    const a = payload.optionA.trim();
    const b = payload.optionB.trim();
    if (
      a.length < QUESTION_OPTION_MIN_LENGTH ||
      a.length > QUESTION_OPTION_MAX_LENGTH ||
      b.length < QUESTION_OPTION_MIN_LENGTH ||
      b.length > QUESTION_OPTION_MAX_LENGTH
    ) {
      delay(() =>
        ack({
          ok: false,
          error: err(
            "QUESTION_INVALID",
            `Each option must be ${QUESTION_OPTION_MIN_LENGTH}–${QUESTION_OPTION_MAX_LENGTH} characters`,
          ),
        }),
      );
      return;
    }

    const question: Question = {
      id: randomId("q"),
      optionA: a,
      optionB: b,
      categoryId: payload.categoryId,
      isCustom: payload.scope === "room",
    };

    if (payload.scope === "public") {
      // Real backend persists to Postgres. Fake server just logs.
      console.log("[FakeServer] Public question submitted:", question);
      delay(() => ack({ ok: true }));
      return;
    }

    // Room-scoped
    if (!conn.roomCode || !conn.playerId) {
      delay(() =>
        ack({ ok: false, error: err("NOT_IN_ROOM", "You are not in a room") }),
      );
      return;
    }
    const room = this.rooms.get(conn.roomCode);
    if (!room) {
      delay(() =>
        ack({
          ok: false,
          error: err("ROOM_NOT_FOUND", "Room no longer exists"),
        }),
      );
      return;
    }

    room.customQuestions.push(question);
    const player = room.players.find((p) => p.id === conn.playerId);
    if (player) player.hasContributedQuestion = true;

    delay(() => {
      ack({ ok: true });
      this.broadcastRoomState(conn.roomCode!);
    });
  }

  private handleGameStart(conn: Connection, ack: (r: Ack) => void): void {
    if (!conn.roomCode) {
      delay(() =>
        ack({ ok: false, error: err("NOT_IN_ROOM", "You are not in a room") }),
      );
      return;
    }
    const room = this.rooms.get(conn.roomCode);
    if (!room) {
      delay(() =>
        ack({
          ok: false,
          error: err("ROOM_NOT_FOUND", "Room no longer exists"),
        }),
      );
      return;
    }
    if (room.hostId !== conn.playerId) {
      delay(() =>
        ack({ ok: false, error: err("NOT_HOST", "Only the host can start") }),
      );
      return;
    }
    if (room.status !== "lobby") {
      delay(() =>
        ack({
          ok: false,
          error: err("GAME_ALREADY_STARTED", "Game already in progress"),
        }),
      );
      return;
    }
    if (room.players.length < MIN_PLAYERS_TO_START) {
      delay(() =>
        ack({
          ok: false,
          error: err(
            "NOT_ENOUGH_PLAYERS",
            `Need at least ${MIN_PLAYERS_TO_START} players`,
          ),
        }),
      );
      return;
    }
    if (room.settings.requireContribution) {
      const missing = room.players.filter((p) => !p.hasContributedQuestion);
      if (missing.length > 0) {
        delay(() =>
          ack({
            ok: false,
            error: err(
              "CONTRIBUTION_REQUIRED",
              `Waiting for: ${missing.map((p) => p.nickname).join(", ")}`,
            ),
          }),
        );
        return;
      }
    }

    delay(() => {
      ack({ ok: true });

      room.status = "in-progress";
      room.roundNumber = 0;
      for (const p of room.players) p.score = 0;

      this.prepareQuestions(room);
      this.startRound(conn.roomCode!);
    });
  }

  register(conn: Connection): void {
    this.connections.set(conn.id, conn);
  }

  unregister(connId: string): void {
    const conn = this.connections.get(connId);
    if (conn?.playerId) this.connByPlayer.delete(conn.playerId);
    this.connections.delete(connId);
  }

  handleEvent(connId: string, event: string, args: unknown[]): void {
    const conn = this.connections.get(connId);
    if (!conn) return;

    switch (event) {
      case "room:create":
        return this.handleRoomCreate(
          conn,
          args[0] as RoomCreatePayload,
          args[1] as (r: AckWith<RoomCreateResponse>) => void,
        );
      case "room:join":
        return this.handleRoomJoin(
          conn,
          args[0] as RoomJoinPayload,
          args[1] as (r: AckWith<RoomJoinResponse>) => void,
        );
      case "room:leave":
        return this.handleRoomLeave(conn);
      case "room:updateSettings":
        return this.handleUpdateSettings(
          conn,
          args[0] as Partial<GameSettings>,
          args[1] as (r: Ack) => void,
        );
      case "question:submit":
        return this.handleQuestionSubmit(
          conn,
          args[0] as QuestionSubmitPayload,
          args[1] as (r: Ack) => void,
        );
      case "game:start":
        return this.handleGameStart(conn, args[0] as (r: Ack) => void);
      case "vote:submit":
        return this.handleVoteSubmit(
          conn,
          args[0] as VoteSubmitPayload,
          args[1] as (r: Ack) => void,
        );
      default:
        console.warn(`[FakeServer] Unhandled event: ${event}`);
    }
  }

  private handleRoomCreate(
    conn: Connection,
    payload: RoomCreatePayload,
    ack: (r: AckWith<RoomCreateResponse>) => void,
  ): void {
    const nicknameError = this.validateNickname(payload.nickname);
    if (nicknameError) {
      delay(() => ack({ ok: false, error: nicknameError }));
      return;
    }

    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();

    const playerId = randomId("player");
    const now = Date.now();

    const host: Player = {
      id: playerId,
      nickname: payload.nickname.trim(),
      isHost: true,
      isConnected: true,
      score: 0,
      hasContributedQuestion: false,
      joinedAt: now,
    };

    const room: Room = {
      code,
      hostId: playerId,
      status: "lobby",
      players: [host],
      settings: { ...DEFAULT_GAME_SETTINGS },
      currentRound: null,
      roundNumber: 0,
      customQuestions: [],
      createdAt: now,
    };

    this.rooms.set(code, room);
    conn.playerId = playerId;
    conn.roomCode = code;
    this.connByPlayer.set(playerId, conn.id);

    delay(() => {
      ack({ ok: true, data: { code, playerId } });
      this.broadcastRoomState(code);
    });
  }

  private handleRoomJoin(
    conn: Connection,
    payload: RoomJoinPayload,
    ack: (r: AckWith<RoomJoinResponse>) => void,
  ): void {
    const code = payload.code.toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      delay(() =>
        ack({
          ok: false,
          error: err("ROOM_NOT_FOUND", "No room with that code"),
        }),
      );
      return;
    }

    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      delay(() =>
        ack({ ok: false, error: err("ROOM_FULL", "This room is full") }),
      );
      return;
    }

    const nicknameError = this.validateNickname(payload.nickname);
    if (nicknameError) {
      delay(() => ack({ ok: false, error: nicknameError }));
      return;
    }

    if (
      room.players.some(
        (p) => p.nickname.toLowerCase() === payload.nickname.toLowerCase(),
      )
    ) {
      delay(() =>
        ack({
          ok: false,
          error: err(
            "NICKNAME_TAKEN",
            "Someone in this room already uses that name",
          ),
        }),
      );
      return;
    }

    const playerId = randomId("player");
    const player: Player = {
      id: playerId,
      nickname: payload.nickname.trim(),
      isHost: false,
      isConnected: true,
      score: 0,
      hasContributedQuestion: false,
      joinedAt: Date.now(),
    };

    room.players.push(player);
    conn.playerId = playerId;
    conn.roomCode = code;
    this.connByPlayer.set(playerId, conn.id);

    delay(() => {
      ack({ ok: true, data: { playerId } });
      this.broadcastRoomState(code);
    });
  }

  private handleRoomLeave(conn: Connection): void {
    if (!conn.roomCode || !conn.playerId) return;
    const room = this.rooms.get(conn.roomCode);
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== conn.playerId);

    if (room.hostId === conn.playerId && room.players.length > 0) {
      const next = room.players[0]!;
      room.hostId = next.id;
      next.isHost = true;
    }

    if (room.players.length === 0) {
      this.rooms.delete(conn.roomCode);
    } else {
      this.broadcastRoomState(conn.roomCode);
    }

    this.connByPlayer.delete(conn.playerId);
    conn.playerId = undefined;
    conn.roomCode = undefined;
  }

  private validateNickname(nickname: string): SocketError | null {
    const trimmed = nickname.trim();
    if (
      trimmed.length < NICKNAME_MIN_LENGTH ||
      trimmed.length > NICKNAME_MAX_LENGTH
    ) {
      return err(
        "NICKNAME_INVALID",
        `Nickname must be ${NICKNAME_MIN_LENGTH}–${NICKNAME_MAX_LENGTH} characters`,
      );
    }
    return null;
  }

  private broadcastRoomState(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Emit a fresh shallow snapshot so React sees a new reference and
    // re-renders. A real server does this implicitly by serializing
    // state through JSON.
    const snapshot: Room = {
      ...room,
      players: room.players.map((p) => ({ ...p })),
      customQuestions: room.customQuestions.map((q) => ({ ...q })),
      settings: { ...room.settings },
      currentRound: room.currentRound ? { ...room.currentRound } : null,
    };

    for (const player of room.players) {
      const connId = this.connByPlayer.get(player.id);
      if (connId) {
        const conn = this.connections.get(connId);
        conn?.emit("room:state", snapshot);
      }
    }
  }

  // Debug helpers — exposed on window in dev for console inspection
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getAllRooms(): Room[] {
    return [...this.rooms.values()];
  }

  private handleVoteSubmit(
    conn: Connection,
    payload: VoteSubmitPayload,
    ack: (r: Ack) => void,
  ): void {
    if (!conn.roomCode || !conn.playerId) {
      delay(() =>
        ack({ ok: false, error: err("NOT_IN_ROOM", "You are not in a room") }),
      );
      return;
    }
    const room = this.rooms.get(conn.roomCode);
    if (!room) {
      delay(() =>
        ack({
          ok: false,
          error: err("ROOM_NOT_FOUND", "Room no longer exists"),
        }),
      );
      return;
    }
    if (!room.currentRound || room.currentRound.status !== "voting") {
      delay(() =>
        ack({
          ok: false,
          error: err("VOTE_TOO_LATE", "Voting has ended for this round"),
        }),
      );
      return;
    }
    if (payload.option !== "A" && payload.option !== "B") {
      delay(() =>
        ack({ ok: false, error: err("INVALID_VOTE", "Invalid option") }),
      );
      return;
    }

    const votes =
      this.votesInProgress.get(conn.roomCode) ?? new Map<string, VoteOption>();
    votes.set(conn.playerId, payload.option);
    this.votesInProgress.set(conn.roomCode, votes);

    if (!room.currentRound.votedPlayerIds.includes(conn.playerId)) {
      room.currentRound.votedPlayerIds.push(conn.playerId);
    }

    delay(() => {
      ack({ ok: true });
      this.broadcastRoomState(conn.roomCode!);

      // End round early if everyone has voted
      if (room.currentRound!.votedPlayerIds.length >= room.players.length) {
        this.endRound(conn.roomCode!);
      }
    });
  }

  private prepareQuestions(room: Room): void {
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

    this.gameQuestions.set(room.code, pool);
  }

  private startRound(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const pool = this.gameQuestions.get(roomCode);
    const question = pool?.shift();
    if (!question) {
      this.endGame(roomCode);
      return;
    }

    const now = Date.now();
    const endsAt = now + room.settings.roundLengthSeconds * 1000;

    room.roundNumber += 1;
    room.currentRound = {
      questionId: question.id,
      question,
      status: "voting",
      startedAt: now,
      endsAt,
      votedPlayerIds: [],
      results: null,
    };

    this.votesInProgress.set(roomCode, new Map());

    this.broadcastToRoom(roomCode, "round:started", {
      roundNumber: room.roundNumber,
      totalRounds: room.settings.numberOfRounds,
      round: {
        ...room.currentRound,
        question: { ...question },
      },
    });
    this.broadcastRoomState(roomCode);

    const timerId = setTimeout(() => {
      this.endRound(roomCode);
    }, room.settings.roundLengthSeconds * 1000);
    this.roundTimers.set(roomCode, timerId);
  }

  private endRound(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room || !room.currentRound) return;
    if (room.currentRound.status !== "voting") return; // already ended

    const timerId = this.roundTimers.get(roomCode);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.roundTimers.delete(roomCode);
    }

    const voteMap =
      this.votesInProgress.get(roomCode) ?? new Map<string, VoteOption>();
    const votes: Record<string, VoteOption> = {};
    let tallyA = 0;
    let tallyB = 0;
    for (const [pid, option] of voteMap.entries()) {
      votes[pid] = option;
      if (option === "A") tallyA += 1;
      else tallyB += 1;
    }
    const results: RoundResults = { votes, tallyA, tallyB };

    // Scoring: +1 if you voted with the majority. Ties: no points.
    const majority: VoteOption | null =
      tallyA > tallyB ? "A" : tallyB > tallyA ? "B" : null;
    if (majority) {
      for (const player of room.players) {
        if (votes[player.id] === majority) {
          player.score += 1;
        }
      }
    }

    room.currentRound.status = "revealed";
    room.currentRound.results = results;

    this.broadcastToRoom(roomCode, "round:ended", {
      roundNumber: room.roundNumber,
      question: { ...room.currentRound.question },
      results,
    });
    this.broadcastRoomState(roomCode);

    setTimeout(() => {
      const r = this.rooms.get(roomCode);
      if (!r) return;
      if (r.roundNumber >= r.settings.numberOfRounds) {
        this.endGame(roomCode);
      } else {
        this.startRound(roomCode);
      }
    }, ROUND_RESULTS_PAUSE_MS);
  }

  private endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.status = "finished";
    room.currentRound = null;

    const timerId = this.roundTimers.get(roomCode);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      this.roundTimers.delete(roomCode);
    }
    this.votesInProgress.delete(roomCode);
    this.gameQuestions.delete(roomCode);

    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const finalScores = sorted.map((p, i) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: i + 1,
    }));

    this.broadcastToRoom(roomCode, "game:ended", { finalScores });
    this.broadcastRoomState(roomCode);
  }

  private broadcastToRoom(
    roomCode: string,
    event: string,
    payload: unknown,
  ): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const player of room.players) {
      const connId = this.connByPlayer.get(player.id);
      if (connId) {
        const conn = this.connections.get(connId);
        conn?.emit(event, payload);
      }
    }
  }
}

export const fakeServer = new FakeServerImpl();
