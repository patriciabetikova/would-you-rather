import type { Server, Socket } from "socket.io";
import {
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  QUESTION_OPTION_MAX_LENGTH,
  QUESTION_OPTION_MIN_LENGTH,
} from "@wyr/shared";
import type {
  ClientToServerEvents,
  ErrorCode,
  InterServerEvents,
  Player,
  Question,
  RoundResults,
  ServerToClientEvents,
  SocketData,
  SocketError,
  VoteOption,
} from "@wyr/shared";
import { createRoom, randomId, rooms, snapshotRoom } from "./room-store";
import { prepareGameQuestions } from "./questions";

type WyrServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type WyrSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const ROUND_RESULTS_PAUSE_MS = 5000;

// Per-room game state not serialized over the wire.
const gameQuestions = new Map<string, Question[]>();
const votesInProgress = new Map<string, Map<string, VoteOption>>();
const roundTimers = new Map<string, ReturnType<typeof setTimeout>>();

function err(code: ErrorCode, message: string): SocketError {
  return { code, message };
}

function validateNickname(nickname: string): SocketError | null {
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

function broadcastRoomState(io: WyrServer, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit("room:state", snapshotRoom(room));
}

export function registerSocketHandlers(io: WyrServer, socket: WyrSocket): void {
  socket.on("room:create", (payload, ack) => {
    const nicknameError = validateNickname(payload.nickname);
    if (nicknameError) return ack({ ok: false, error: nicknameError });

    const playerId = randomId("player");
    const host: Player = {
      id: playerId,
      nickname: payload.nickname.trim(),
      isHost: true,
      isConnected: true,
      score: 0,
      hasContributedQuestion: false,
      joinedAt: Date.now(),
    };
    const room = createRoom(host);

    socket.data.playerId = playerId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    ack({ ok: true, data: { code: room.code, playerId } });
    broadcastRoomState(io, room.code);
  });

  socket.on("room:join", (payload, ack) => {
    const code = payload.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return ack({
        ok: false,
        error: err("ROOM_NOT_FOUND", "No room with that code"),
      });
    }
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      return ack({ ok: false, error: err("ROOM_FULL", "This room is full") });
    }
    const nicknameError = validateNickname(payload.nickname);
    if (nicknameError) return ack({ ok: false, error: nicknameError });
    if (
      room.players.some(
        (p) => p.nickname.toLowerCase() === payload.nickname.toLowerCase(),
      )
    ) {
      return ack({
        ok: false,
        error: err(
          "NICKNAME_TAKEN",
          "Someone in this room already uses that name",
        ),
      });
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

    socket.data.playerId = playerId;
    socket.data.roomCode = code;
    socket.join(code);

    ack({ ok: true, data: { playerId } });
    broadcastRoomState(io, code);
  });

  socket.on("room:leave", () => {
    handleLeave(io, socket);
  });

  socket.on("room:updateSettings", (payload, ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return ack({ ok: false, error: err("NOT_IN_ROOM", "Not in a room") });
    }
    const room = rooms.get(roomCode);
    if (!room)
      return ack({ ok: false, error: err("ROOM_NOT_FOUND", "Room gone") });
    if (room.hostId !== playerId) {
      return ack({
        ok: false,
        error: err("NOT_HOST", "Only the host can change settings"),
      });
    }
    if (room.status !== "lobby") {
      return ack({
        ok: false,
        error: err("GAME_ALREADY_STARTED", "Settings locked during game"),
      });
    }

    room.settings = { ...room.settings, ...payload };
    ack({ ok: true });
    broadcastRoomState(io, roomCode);
  });

  socket.on("question:submit", (payload, ack) => {
    const a = payload.optionA.trim();
    const b = payload.optionB.trim();
    if (
      a.length < QUESTION_OPTION_MIN_LENGTH ||
      a.length > QUESTION_OPTION_MAX_LENGTH ||
      b.length < QUESTION_OPTION_MIN_LENGTH ||
      b.length > QUESTION_OPTION_MAX_LENGTH
    ) {
      return ack({
        ok: false,
        error: err(
          "QUESTION_INVALID",
          `Each option must be ${QUESTION_OPTION_MIN_LENGTH}–${QUESTION_OPTION_MAX_LENGTH} characters`,
        ),
      });
    }

    const question: Question = {
      id: randomId("q"),
      optionA: a,
      optionB: b,
      categoryId: payload.categoryId,
      isCustom: payload.scope === "room",
    };

    if (payload.scope === "public") {
      // TODO: persist to Supabase in the next step.
      console.log("[server] public question submitted:", question);
      return ack({ ok: true });
    }

    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return ack({ ok: false, error: err("NOT_IN_ROOM", "Not in a room") });
    }
    const room = rooms.get(roomCode);
    if (!room)
      return ack({ ok: false, error: err("ROOM_NOT_FOUND", "Room gone") });

    room.customQuestions.push(question);
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.hasContributedQuestion = true;

    ack({ ok: true });
    broadcastRoomState(io, roomCode);
  });

  socket.on("game:start", (ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return ack({ ok: false, error: err("NOT_IN_ROOM", "Not in a room") });
    }
    const room = rooms.get(roomCode);
    if (!room)
      return ack({ ok: false, error: err("ROOM_NOT_FOUND", "Room gone") });
    if (room.hostId !== playerId) {
      return ack({
        ok: false,
        error: err("NOT_HOST", "Only the host can start"),
      });
    }
    if (room.status !== "lobby") {
      return ack({
        ok: false,
        error: err("GAME_ALREADY_STARTED", "Game already running"),
      });
    }
    if (room.players.length < MIN_PLAYERS_TO_START) {
      return ack({
        ok: false,
        error: err(
          "NOT_ENOUGH_PLAYERS",
          `Need at least ${MIN_PLAYERS_TO_START} players`,
        ),
      });
    }
    if (room.settings.requireContribution) {
      const missing = room.players.filter((p) => !p.hasContributedQuestion);
      if (missing.length > 0) {
        return ack({
          ok: false,
          error: err(
            "CONTRIBUTION_REQUIRED",
            `Waiting for: ${missing.map((p) => p.nickname).join(", ")}`,
          ),
        });
      }
    }

    ack({ ok: true });

    room.status = "in-progress";
    room.roundNumber = 0;
    for (const p of room.players) p.score = 0;
    gameQuestions.set(roomCode, prepareGameQuestions(room));

    startRound(io, roomCode);
  });

  socket.on("vote:submit", (payload, ack) => {
    const { roomCode, playerId } = socket.data;
    if (!roomCode || !playerId) {
      return ack({ ok: false, error: err("NOT_IN_ROOM", "Not in a room") });
    }
    const room = rooms.get(roomCode);
    if (!room)
      return ack({ ok: false, error: err("ROOM_NOT_FOUND", "Room gone") });
    if (!room.currentRound || room.currentRound.status !== "voting") {
      return ack({ ok: false, error: err("VOTE_TOO_LATE", "Voting closed") });
    }
    if (payload.option !== "A" && payload.option !== "B") {
      return ack({ ok: false, error: err("INVALID_VOTE", "Invalid option") });
    }

    const votes =
      votesInProgress.get(roomCode) ?? new Map<string, VoteOption>();
    votes.set(playerId, payload.option);
    votesInProgress.set(roomCode, votes);

    if (!room.currentRound.votedPlayerIds.includes(playerId)) {
      room.currentRound.votedPlayerIds.push(playerId);
    }

    ack({ ok: true });
    broadcastRoomState(io, roomCode);

    if (room.currentRound.votedPlayerIds.length >= room.players.length) {
      endRound(io, roomCode);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    handleLeave(io, socket);
  });
}

function handleLeave(io: WyrServer, socket: WyrSocket): void {
  const { roomCode, playerId } = socket.data;
  if (!roomCode || !playerId) return;
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.hostId === playerId && room.players.length > 0) {
    const next = room.players[0]!;
    room.hostId = next.id;
    next.isHost = true;
  }

  socket.leave(roomCode);
  socket.data.playerId = undefined;
  socket.data.roomCode = undefined;

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    const timer = roundTimers.get(roomCode);
    if (timer !== undefined) clearTimeout(timer);
    roundTimers.delete(roomCode);
    votesInProgress.delete(roomCode);
    gameQuestions.delete(roomCode);
  } else {
    broadcastRoomState(io, roomCode);
  }
}

function startRound(io: WyrServer, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  const pool = gameQuestions.get(roomCode);
  const question = pool?.shift();
  if (!question) {
    endGame(io, roomCode);
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
  votesInProgress.set(roomCode, new Map());

  io.to(roomCode).emit("round:started", {
    roundNumber: room.roundNumber,
    totalRounds: room.settings.numberOfRounds,
    round: { ...room.currentRound, question: { ...question } },
  });
  broadcastRoomState(io, roomCode);

  const timerId = setTimeout(
    () => endRound(io, roomCode),
    room.settings.roundLengthSeconds * 1000,
  );
  roundTimers.set(roomCode, timerId);
}

function endRound(io: WyrServer, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room || !room.currentRound) return;
  if (room.currentRound.status !== "voting") return;

  const timer = roundTimers.get(roomCode);
  if (timer !== undefined) clearTimeout(timer);
  roundTimers.delete(roomCode);

  const voteMap =
    votesInProgress.get(roomCode) ?? new Map<string, VoteOption>();
  const votes: Record<string, VoteOption> = {};
  let tallyA = 0;
  let tallyB = 0;
  for (const [pid, option] of voteMap.entries()) {
    votes[pid] = option;
    if (option === "A") tallyA += 1;
    else tallyB += 1;
  }
  const results: RoundResults = { votes, tallyA, tallyB };

  const majority: VoteOption | null =
    tallyA > tallyB ? "A" : tallyB > tallyA ? "B" : null;
  if (majority) {
    for (const player of room.players) {
      if (votes[player.id] === majority) player.score += 1;
    }
  }

  room.currentRound.status = "revealed";
  room.currentRound.results = results;

  io.to(roomCode).emit("round:ended", {
    roundNumber: room.roundNumber,
    question: { ...room.currentRound.question },
    results,
  });
  broadcastRoomState(io, roomCode);

  setTimeout(() => {
    const r = rooms.get(roomCode);
    if (!r) return;
    if (r.roundNumber >= r.settings.numberOfRounds) {
      endGame(io, roomCode);
    } else {
      startRound(io, roomCode);
    }
  }, ROUND_RESULTS_PAUSE_MS);
}

function endGame(io: WyrServer, roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.status = "finished";
  room.currentRound = null;

  const timer = roundTimers.get(roomCode);
  if (timer !== undefined) clearTimeout(timer);
  roundTimers.delete(roomCode);
  votesInProgress.delete(roomCode);
  gameQuestions.delete(roomCode);

  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const finalScores = sorted.map((p, i) => ({
    playerId: p.id,
    nickname: p.nickname,
    score: p.score,
    rank: i + 1,
  }));

  io.to(roomCode).emit("game:ended", { finalScores });
  broadcastRoomState(io, roomCode);
}
