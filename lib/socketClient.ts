"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, RoomStateMessage, ServerToClientEvents } from "@/types/room";

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useRoomSocket(code: string) {
  const socketRef = useRef<RoomSocket | null>(null);
  const clockOffsetRef = useRef(0);
  const [state, setState] = useState<RoomStateMessage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: RoomSocket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", code);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room:state", (message) => {
      clockOffsetRef.current = message.now - Date.now();
      setState(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  return { state, connected, socket: socketRef, clockOffsetRef };
}
