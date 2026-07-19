"use client";

import type { NormalizedMatchEvent, RelayMessage } from "@sixth-sense/shared";
import { useEffect, useRef, useState } from "react";

export interface RelaySocketState {
  connected: boolean;
  events: NormalizedMatchEvent[];
  replayComplete: boolean;
}

/**
 * Connects to the relay's WebSocket fanout. Same hook works for live or
 * replay mode (CLAUDE.md Section 12: "identical code path otherwise") —
 * the relay decides what to send, this just consumes RelayMessage.
 */
export function useRelaySocket(url: string): RelaySocketState {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<NormalizedMatchEvent[]>([]);
  const [replayComplete, setReplayComplete] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.addEventListener("open", () => setConnected(true));
    socket.addEventListener("close", () => setConnected(false));
    socket.addEventListener("message", (ev) => {
      const message = JSON.parse(ev.data) as RelayMessage;
      if (message.type === "match_event") {
        setEvents((prev) => [...prev, message.payload]);
      } else if (message.type === "replay_complete") {
        setReplayComplete(true);
      }
    });

    return () => socket.close();
  }, [url]);

  return { connected, events, replayComplete };
}
