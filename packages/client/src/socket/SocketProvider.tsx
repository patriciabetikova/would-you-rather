import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Room } from "@wyr/shared";
import { createFakeSocket } from "../fake-socket";
import { SocketContext, type Socket } from "./context";

// Module-level singleton, created on first access.
// Persists for the page lifetime — same lifecycle a real socket.io
// connection would have. Created lazily so module load is cheap.
let socketInstance: Socket | null = null;

function getSocketInstance(): Socket {
  if (socketInstance === null) {
    socketInstance = createFakeSocket();
  }
  return socketInstance;
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socket = getSocketInstance();
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    // setState happens inside the room:state callback — exactly the
    // "subscribe and update state from the subscription" pattern
    // React 19's lint rules want.
    const handleRoomState = (r: Room) => setRoom(r);
    socket.on("room:state", handleRoomState);
    return () => {
      socket.off("room:state", handleRoomState);
    };
  }, [socket]);

  const value = useMemo(
    () => ({ socket, room, playerId, setPlayerId }),
    [socket, room, playerId],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
