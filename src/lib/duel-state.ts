import { createClient } from "redis";

// Singleton Redis client
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    redisClient.on("error", (err) => console.error("Redis error:", err));
    await redisClient.connect();
  }
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

export interface Player {
  id: string;
  nickname: string;
  roomId: string | null;
}

export interface Room {
  id: string;
  players: string[];
  state: "waiting" | "countdown" | "draw" | "finished";
  triggerType: string;
  countdownAt: number;
  triggerAt: number;
  drawAt: number;
  timeoutAt: number;
  shots: Record<string, number>;
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

const TTL = 300;

export async function getPlayer(id: string): Promise<Player | null> {
  const redis = await getRedis();
  const data = await redis.get(`duel:player:${id}`);
  return data ? JSON.parse(data) : null;
}

export async function setPlayer(player: Player) {
  const redis = await getRedis();
  await redis.set(`duel:player:${player.id}`, JSON.stringify(player), { EX: TTL });
}

export async function getRoom(id: string): Promise<Room | null> {
  const redis = await getRedis();
  const data = await redis.get(`duel:room:${id}`);
  return data ? JSON.parse(data) : null;
}

export async function setRoom(room: Room) {
  const redis = await getRedis();
  await redis.set(`duel:room:${room.id}`, JSON.stringify(room), { EX: TTL });
}

export async function joinQueue(playerId: string) {
  const redis = await getRedis();
  await redis.rPush("duel:queue", playerId);
  await redis.expire("duel:queue", TTL);
}

export async function popQueue(): Promise<string | null> {
  const redis = await getRedis();
  return redis.lPop("duel:queue");
}

export async function getRanking(nickname: string): Promise<RankEntry | null> {
  const redis = await getRedis();
  const data = await redis.get(`duel:rank:${nickname}`);
  return data ? JSON.parse(data) : null;
}

export async function setRanking(entry: RankEntry) {
  const redis = await getRedis();
  await redis.set(`duel:rank:${entry.nickname}`, JSON.stringify(entry));
  await redis.zAdd("duel:rankings", { score: entry.wins, value: entry.nickname });
}

export async function getTopRankings(limit: number = 20): Promise<RankEntry[]> {
  const redis = await getRedis();
  const nicknames = await redis.zRange("duel:rankings", 0, limit - 1, { REV: true });
  if (!nicknames || nicknames.length === 0) return [];

  const results: RankEntry[] = [];
  for (const nick of nicknames) {
    const data = await redis.get(`duel:rank:${nick}`);
    if (data) {
      const entry: RankEntry = JSON.parse(data);
      if (entry.wins + entry.losses > 0) {
        results.push(entry);
      }
    }
  }
  return results.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

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
