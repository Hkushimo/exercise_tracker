import { env } from "cloudflare:workers";

export type ExerciseSet = {
  id: string;
  exercise: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  unit: string | null;
  distance: number | null;
  distanceUnit: string | null;
  durationMinutes: number | null;
  notes: string;
};

export type Workout = {
  id: string;
  date: string;
  rawText: string;
  summary: string;
  exercises: ExerciseSet[];
  createdAt: string;
};

export type MemberFile = {
  version: 1;
  pinHash: string;
  memberName: string;
  createdAt: string;
  updatedAt: string;
  workouts: Workout[];
};

const encoder = new TextEncoder();

function getBucket() {
  const runtimeEnv = env as unknown as { FILES?: R2Bucket };
  if (!runtimeEnv.FILES) {
    throw new Error("Storage is not configured. Set the R2 binding to FILES.");
  }
  return runtimeEnv.FILES;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(pin));
  return toHex(digest);
}

export function memberKey(pinHash: string) {
  return `members/${pinHash}.json`;
}

export async function loadMember(pinHash: string) {
  const object = await getBucket().get(memberKey(pinHash));
  if (!object) return null;
  return (await object.json()) as MemberFile;
}

export async function saveMember(member: MemberFile) {
  member.updatedAt = new Date().toISOString();
  await getBucket().put(memberKey(member.pinHash), JSON.stringify(member, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export function publicMember(member: MemberFile) {
  return {
    memberName: member.memberName,
    workouts: member.workouts,
  };
}

export function createMember(pinHash: string, memberName: string): MemberFile {
  const now = new Date().toISOString();
  return {
    version: 1,
    pinHash,
    memberName: memberName || "Member",
    createdAt: now,
    updatedAt: now,
    workouts: [],
  };
}
