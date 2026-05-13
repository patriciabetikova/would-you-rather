import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import type { Room } from "@wyr/shared";
import { SocketContext, type Socket } from "./context";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3001";

// Module-level singleton. socket.io-client handles connection lifecycle,
// automatic reconnection, and event ordering for us.
let socketInstance: Socket | null = null;

function getSocketInstance(): Socket {
  if (socketInstance === null) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: true,
    });
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
