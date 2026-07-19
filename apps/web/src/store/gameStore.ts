"use client";

import {
  computeAwardedPoints,
  initMatchState,
  nextStreak,
  reduceMatchState,
  streakMultiplier,
  type CardChoice,
  type CardOutcome,
  type MatchState,
  type PredictionCard,
  type RelayMessage,
} from "@sixth-sense/shared";
import { create } from "zustand";

export interface ResolvedCardResult {
  card: PredictionCard;
  choice: CardChoice | null;
  /** From the player's own perspective. "void" if they never picked. */
  personalOutcome: CardOutcome | "void";
  awardedPoints: number;
  multiplier: number;
  resolvedSeq: number;
}

interface GameState {
  connected: boolean;
  matchState: MatchState | null;
  /** True once "replay_complete" arrives, until the next "replay_starting" resets it. */
  matchComplete: boolean;
  activeCard: PredictionCard | null;
  cardChoice: CardChoice | null;
  lastResult: ResolvedCardResult | null;
  streak: number;
  bestStreak: number;
  points: number;
  /** This session's win count — folded into User.lifetimeWins at session end. */
  sessionWins: number;
  /**
   * Every resolved card this session, in order — submitted to
   * POST /api/sessions/complete when the match ends so real
   * MatchSession/Prediction rows persist (Phase 6) instead of session
   * points only ever living in this in-memory store.
   */
  sessionPredictions: ResolvedCardResult[];
  /** Section 11.4: a milestone streak (5, 10, ...) worth a bigger celebration than the normal win pop. */
  milestoneStreak: number | null;
  /** A picked live match hasn't kicked off yet — set from "live_pending", cleared by the first real "match_event". */
  livePending: { fixtureId: string; startTime: string } | null;
  /** The live channel the user picked failed to start (bad fixtureId, TxLINE error) — set from "live_error". */
  liveError: string | null;
  socket: WebSocket | null;
  /**
   * Anchors for estimating "current match time" between discrete event
   * arrivals, so the countdown ring can tick smoothly instead of jumping
   * only when a new event lands. estimatedMatchTs(now) = lastEventMatchTs +
   * (now - lastEventWallClockMs) * accelerationFactor. accelerationFactor
   * is 1 for live mode.
   */
  lastEventMatchTs: number;
  lastEventWallClockMs: number;
  accelerationFactor: number;
  /**
   * CLAUDE.md Section 15: "simulate drops... assert the app re-hydrates
   * and never loses streak or points." Reconnect state — `wsUrl` is kept
   * so a dropped connection can be re-opened with the same target;
   * `intentionalDisconnect` stops a scheduled reconnect from firing after
   * the component actually wanted to disconnect (e.g. unmounting), not
   * just after a real network drop.
   */
  wsUrl: string | null;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  intentionalDisconnect: boolean;

  connect: (url: string, accelerationFactor?: number) => void;
  disconnect: () => void;
  chooseCard: (choice: CardChoice) => void;
  estimateCurrentMatchTs: () => number;
  dismissMilestone: () => void;
}

const MAX_RECONNECT_DELAY_MS = 10_000;

/** Section 11.4: streak 5, 10, 15... — every multiple of 5, not just the first two. */
function milestoneFor(streak: number): number | null {
  return streak > 0 && streak % 5 === 0 ? streak : null;
}

/**
 * Flips the relay's objective (yes-caller's-perspective) outcome to the
 * user's personal outcome based on what they actually picked. See
 * resolveCard's docstring in packages/shared for the objective semantics.
 */
function personalizeOutcome(choice: CardChoice | null, outcome: CardOutcome): CardOutcome | "void" {
  if (choice === null) return "void";
  if (outcome === "void") return "void";
  if (choice === "yes") return outcome;
  return outcome === "win" ? "loss" : "win";
}

export const useGameStore = create<GameState>((set, get) => ({
  connected: false,
  matchState: null,
  matchComplete: false,
  activeCard: null,
  cardChoice: null,
  lastResult: null,
  streak: 0,
  bestStreak: 0,
  points: 0,
  sessionWins: 0,
  sessionPredictions: [],
  milestoneStreak: null,
  livePending: null,
  liveError: null,
  socket: null,
  lastEventMatchTs: 0,
  lastEventWallClockMs: 0,
  accelerationFactor: 1,
  wsUrl: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  intentionalDisconnect: false,

  connect: (url: string, accelerationFactor = 1) => {
    if (get().socket) return;
    set({ wsUrl: url, accelerationFactor, intentionalDisconnect: false });

    const openSocket = () => {
      const socket = new WebSocket(url);
      // Set immediately (synchronously, before any listener can possibly
      // fire) so the identity guards below always compare against the
      // right "current" socket — otherwise a stale/superseded socket's
      // delayed close event can stomp state a newer, already-open socket
      // already set correctly (a real race, caught by actually killing
      // and restarting the relay mid-session: the UI got stuck showing
      // "reconnecting" forever even after new events were flowing again).
      set({ socket });

      socket.addEventListener("open", () => {
        if (get().socket !== socket) return; // superseded — ignore
        set({ connected: true, reconnectAttempts: 0 });
      });

      socket.addEventListener("close", () => {
        if (get().socket !== socket) return; // superseded — ignore, don't reconnect twice
        set({ connected: false, socket: null });
        const state = get();
        if (state.intentionalDisconnect) return;
        // CLAUDE.md Section 15: reconnect-with-backoff rather than giving
        // up after one dropped connection — capped so a long outage still
        // retries every 10s instead of less and less often forever.
        const attempt = state.reconnectAttempts + 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
        const timer = setTimeout(() => {
          if (get().intentionalDisconnect) return;
          openSocket();
        }, delay);
        set({ reconnectAttempts: attempt, reconnectTimer: timer });
      });

      socket.addEventListener("message", (ev) => {
        const message = JSON.parse(ev.data) as RelayMessage;

        if (message.type === "replay_starting") {
          set({
            matchState: null,
            matchComplete: false,
            activeCard: null,
            cardChoice: null,
            lastResult: null,
            streak: 0,
            points: 0,
            sessionWins: 0,
            sessionPredictions: [],
            milestoneStreak: null,
            livePending: null,
            liveError: null,
          });
          return;
        }

        if (message.type === "replay_complete") {
          set({ matchComplete: true });
          return;
        }

        if (message.type === "live_pending") {
          set({ livePending: { fixtureId: message.fixtureId, startTime: message.startTime } });
          return;
        }

        if (message.type === "live_error") {
          set({ liveError: message.message });
          return;
        }

        if (message.type === "match_event") {
          set((state) => {
            // Safety net for a reconnect that landed mid-NEW-match: a late
            // joiner never gets replayed the "replay_starting" reset (same
            // as any other late joiner — see ws-server.ts), so a fixtureId
            // change on the wire is treated as an implicit reset instead
            // of folding new events into stale state from a match that's
            // already over (CLAUDE.md Section 15's reconnect/gap handling).
            const isNewFixture =
              state.matchState !== null &&
              state.matchState.fixtureInfo.fixtureId !== message.payload.fixtureInfo.fixtureId;
            const baseState =
              !state.matchState || isNewFixture ? initMatchState(message.payload.fixtureInfo) : state.matchState;

            return {
              matchState: reduceMatchState(baseState, message.payload),
              lastEventMatchTs: message.payload.update.ts,
              lastEventWallClockMs: Date.now(),
              livePending: null,
              ...(isNewFixture
                ? {
                    matchComplete: false,
                    activeCard: null,
                    cardChoice: null,
                    lastResult: null,
                    streak: 0,
                    points: 0,
                    sessionWins: 0,
                    sessionPredictions: [] as ResolvedCardResult[],
                    milestoneStreak: null,
                  }
                : {}),
            };
          });
          return;
        }

        if (message.type === "card_issued") {
          set({ activeCard: message.payload, cardChoice: null });
          return;
        }

        if (message.type === "card_resolved") {
          const state = get();
          if (!state.activeCard || state.activeCard.id !== message.payload.cardId) return;

          const personalOutcome = personalizeOutcome(state.cardChoice, message.payload.outcome);
          const mult = streakMultiplier(state.streak);
          const awardedPoints =
            personalOutcome === "win" ? computeAwardedPoints(state.activeCard.basePoints, mult) : 0;
          const newStreak =
            personalOutcome === "void" ? state.streak : nextStreak(state.streak, personalOutcome);

          const resolvedResult: ResolvedCardResult = {
            card: state.activeCard,
            choice: state.cardChoice,
            personalOutcome,
            awardedPoints,
            multiplier: mult,
            resolvedSeq: message.payload.resolvedSeq,
          };

          set({
            activeCard: null,
            cardChoice: null,
            lastResult: resolvedResult,
            streak: newStreak,
            bestStreak: Math.max(state.bestStreak, newStreak),
            points: state.points + awardedPoints,
            sessionWins: state.sessionWins + (personalOutcome === "win" ? 1 : 0),
            sessionPredictions: [...state.sessionPredictions, resolvedResult],
            milestoneStreak: milestoneFor(newStreak),
          });
        }
      });
    };

    openSocket();
  },

  disconnect: () => {
    const state = get();
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    state.socket?.close();
    set({ socket: null, connected: false, intentionalDisconnect: true, reconnectTimer: null });
  },

  chooseCard: (choice: CardChoice) => {
    if (!get().activeCard || get().cardChoice) return;
    set({ cardChoice: choice });
  },

  estimateCurrentMatchTs: () => {
    const state = get();
    if (state.lastEventWallClockMs === 0) return state.lastEventMatchTs;
    const elapsedWallMs = Date.now() - state.lastEventWallClockMs;
    return state.lastEventMatchTs + elapsedWallMs * state.accelerationFactor;
  },

  dismissMilestone: () => set({ milestoneStreak: null }),
}));
