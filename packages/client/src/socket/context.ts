import { createContext, useContext } from "react";
import type { Room } from "@wyr/shared";
import type { FakeSocket } from "../fake-socket";

// When we swap in the real socket in Phase 4, this is the only line that changes.
export type Socket = FakeSocket;

export interface SocketContextValue {
  socket: Socket;
  room: Room | null;
  playerId: string | null;
  setPlayerId: (id: string | null) => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("Must be used inside <SocketProvider>");
  }
  return ctx;
}

export function useSocket(): Socket {
  return useSocketContext().socket;
}

export function useRoom(): Room | null {
  return useSocketContext().room;
}

export function usePlayerId(): readonly [
  string | null,
  (id: string | null) => void,
] {
  const { playerId, setPlayerId } = useSocketContext();
  return [playerId, setPlayerId] as const;
}
