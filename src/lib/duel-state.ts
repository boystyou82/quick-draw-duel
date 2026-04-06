import { kv } from "@vercel/kv";

export interface Player {
  id: string;
  nickname: string;
  roomId: string | null;
}

export interface Room {
  id: string;
  players: string[]; // playerIds
  state: "waiting" | "countdown" | "draw" | "finished";
  triggerType: string;
  // Timestamps for phase transitions (serverless-friendly)
  countdownAt: number;
  triggerAt: number;
  drawAt: number;
  timeoutAt: number;
  // Results
  shots: Record<string, number>; // playerId -> timestamp
  tooEarly: string[];
  winner: string | null;
}

export interface RankEntry {
  nickname: string;
  wins: number;
  losses: number;
  bestTime: number | null;
}

const TRIGGERS = [
  { type: "horse", message: "A horse neighs..." },
  { type: "bell", message: "The church bell rings..." },
  { type: "cough", message: "Someone coughs..." },
  { type: "crow", message: "A crow screeches..." },
  { type: "thunder", message: "Lightning strikes..." },
];

export function getRandomTrigger() {
  return TRIGGERS[Math.floor(Math.random() * TRIGGERS.length)];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// KV helpers
const KEYS = {
  player: (id: string) => `duel:player:${id}`,
  room: (id: string) => `duel:room:${id}`,
  queue: "duel:queue",
  ranking: (nickname: string) => `duel:rank:${nickname}`,
  rankingIndex: "duel:rankings",
};

const TTL = 300; // 5 min expiry for rooms/players

export async function getPlayer(id: string): Promise<Player | null> {
  return kv.get<Player>(KEYS.player(id));
}

export async function setPlayer(player: Player) {
  await kv.set(KEYS.player(player.id), player, { ex: TTL });
}

export async function getRoom(id: string): Promise<Room | null> {
  return kv.get<Room>(KEYS.room(id));
}

export async function setRoom(room: Room) {
  await kv.set(KEYS.room(room.id), room, { ex: TTL });
}

export async function joinQueue(playerId: string) {
  await kv.rpush(KEYS.queue, playerId);
}

export async function popQueue(): Promise<string | null> {
  return kv.lpop(KEYS.queue);
}

export async function getRanking(nickname: string): Promise<RankEntry | null> {
  return kv.get<RankEntry>(KEYS.ranking(nickname));
}

export async function setRanking(entry: RankEntry) {
  await kv.set(KEYS.ranking(entry.nickname), entry);
  // Store in sorted set for leaderboard
  await kv.zadd(KEYS.rankingIndex, { score: entry.wins, member: entry.nickname });
}

export async function getTopRankings(limit: number = 20): Promise<RankEntry[]> {
  const nicknames = await kv.zrange<string[]>(KEYS.rankingIndex, 0, limit - 1, { rev: true });
  if (!nicknames || nicknames.length === 0) return [];

  const results: RankEntry[] = [];
  for (const nick of nicknames) {
    const entry = await kv.get<RankEntry>(KEYS.ranking(nick));
    if (entry && entry.wins + entry.losses > 0) {
      results.push(entry);
    }
  }
  return results.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

// Compute current phase from room timestamps
export function computePhase(room: Room): string {
  if (room.state === "finished") return "result";
  if (room.state === "waiting") return "waiting";

  const now = Date.now();
  if (now < room.countdownAt) return "matched";
  if (now < room.triggerAt) return "countdown";
  if (now < room.drawAt) return "trigger_hint";
  if (now < room.timeoutAt) return "draw";
  return "timeout";
}
