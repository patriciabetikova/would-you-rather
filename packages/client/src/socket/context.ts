import { createContext, useContext } from "react";
import type { Socket as IOSocket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Room,
  ServerToClientEvents,
} from "@wyr/shared";

// Note the parameter order: ServerToClientEvents first, ClientToServerEvents
// second. Socket.IO inverts it on the client side because the client *receives*
// server-to-client events and *emits* client-to-server events.
export type Socket = IOSocket<ServerToClientEvents, ClientToServerEvents>;

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
