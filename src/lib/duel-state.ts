// In-memory state for local dev (single Node.js process)
// This won't persist across restarts or work on serverless

export interface Player {
  id: string;
  nickname: string;
  roomId: string | null;
  controller: ReadableStreamDefaultController | null;
}

export interface Room {
  id: string;
  players: string[]; // playerIds
  state: "waiting" | "countdown" | "draw" | "finished";
  triggerType: string;
  drawTime: number | null;
  shots: Map<string, number>; // playerId -> timestamp
  tooEarly: Set<string>; // playerIds who shot too early
  winner: string | null;
}

export interface RankEntry {
  nickname: string;
  wins: number;
  losses: number;
  bestTime: number | null;
}

interface DuelState {
  players: Map<string, Player>;
  rooms: Map<string, Room>;
  rankings: Map<string, RankEntry>;
  waitingQueue: string[]; // playerIds waiting for match
}

const globalKey = "__duel_state__";

function getState(): DuelState {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = {
      players: new Map(),
      rooms: new Map(),
      rankings: new Map(),
      waitingQueue: [],
    };
  }
  return (globalThis as Record<string, unknown>)[globalKey] as DuelState;
}

export const state = {
  get players() { return getState().players; },
  get rooms() { return getState().rooms; },
  get rankings() { return getState().rankings; },
  get waitingQueue() { return getState().waitingQueue; },
  set waitingQueue(v: string[]) { getState().waitingQueue = v; },
};

const TRIGGERS = [
  { type: "horse", message: "A horse neighs...", icon: "🐴" },
  { type: "bell", message: "The church bell rings...", icon: "🔔" },
  { type: "cough", message: "Someone coughs...", icon: "💨" },
  { type: "crow", message: "A crow screeches...", icon: "🦅" },
  { type: "thunder", message: "Lightning strikes...", icon: "⚡" },
];

export function getRandomTrigger() {
  return TRIGGERS[Math.floor(Math.random() * TRIGGERS.length)];
}

export function sendSSE(player: Player, event: string, data: unknown) {
  if (!player.controller) return;
  try {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    player.controller.enqueue(new TextEncoder().encode(msg));
  } catch {
    // connection closed
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
