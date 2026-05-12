import {
  DEFAULT_GAME_SETTINGS,
  ROOM_CODE_LENGTH,
  type Player,
  type Room,
} from "@wyr/shared";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit lookalikes

export const rooms = new Map<string, Room>();

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

export function generateUniqueRoomCode(): string {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  return code;
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRoom(host: Player): Room {
  const code = generateUniqueRoomCode();
  const room: Room = {
    code,
    hostId: host.id,
    status: "lobby",
    players: [host],
    settings: { ...DEFAULT_GAME_SETTINGS },
    currentRound: null,
    roundNumber: 0,
    customQuestions: [],
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

// Immutable snapshot for emitting to clients —
// same pattern as the fake server, ensures React re-renders.
export function snapshotRoom(room: Room): Room {
  return {
    ...room,
    players: room.players.map((p) => ({ ...p })),
    customQuestions: room.customQuestions.map((q) => ({ ...q })),
    settings: { ...room.settings },
    currentRound: room.currentRound ? { ...room.currentRound } : null,
  };
}
