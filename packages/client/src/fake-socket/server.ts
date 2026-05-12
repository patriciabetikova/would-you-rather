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
} from "@wyr/shared";

const SIMULATED_LATENCY_MS = 80;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit lookalikes

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

    // TODO: Wire up actual round progression in the next step.
    room.status = "in-progress";

    delay(() => {
      ack({ ok: true });
      this.broadcastRoomState(conn.roomCode!);
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
}

export const fakeServer = new FakeServerImpl();
