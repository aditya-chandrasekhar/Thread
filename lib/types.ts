import { ObjectId } from "mongodb";

export const MEMORY_TYPES = [
  "fact",
  "interest",
  "need",
  "offer",
  "commitment_user_to_person",
  "commitment_person_to_user",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface PersonDoc {
  _id?: ObjectId;
  sessionId: string;
  name: string;
  shortDescription: string;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
  firstMetAt: Date;
  lastEncounterAt: Date | null;
}

export interface EncounterDoc {
  _id?: ObjectId;
  sessionId: string;
  personId: ObjectId;
  startedAt: Date;
  endedAt: Date;
  transcript: string;
  summary: string;
  createdAt: Date;
}

export interface MemoryDoc {
  _id?: ObjectId;
  sessionId: string;
  personId: ObjectId;
  encounterId: ObjectId;
  type: MemoryType;
  text: string;
  sourceText: string;
  importance: number; // 1–5
  createdAt: Date;
  embedding?: number[]; // for Atlas Vector Search
}

export interface OpenLoopDoc {
  _id?: ObjectId;
  sessionId: string;
  personId: ObjectId;
  description: string;
  owner: "user" | "person";
  status: "open" | "completed";
  createdAt: Date;
  completedAt: Date | null;
}

export interface ConnectionDoc {
  _id?: ObjectId;
  sessionId: string;
  personAId: ObjectId; // the person with the NEED
  personBId: ObjectId; // the person with the OFFER
  reason: string;
  score: number;
  engine: "vector" | "llm" | "keyword";
  triggerMemoryIds: ObjectId[];
  createdAt: Date;
  status: "new" | "acknowledged";
}

// ---- API-facing (serialized) shapes ----

export interface PersonLite {
  id: string;
  name: string;
  shortDescription: string;
  lastEncounterAt: string | null;
  encounterCount?: number;
}

export interface ExtractedMemory {
  type: MemoryType;
  text: string;
  sourceText: string;
  importance: number;
}

export interface ExtractionResult {
  summary: string;
  memories: ExtractedMemory[];
  shortDescription?: string;
}

export interface NewConnectionInfo {
  id: string;
  personAName: string; // needs
  personBName: string; // offers
  reason: string;
  score: number;
  engine: string;
}

export interface ProcessResult {
  personId: string;
  personName: string;
  memoriesSaved: number;
  openLoopsCreated: number;
  summary: string;
  memories: { type: MemoryType; text: string }[];
  newConnections: NewConnectionInfo[];
  extractionEngine: "llm" | "fallback";
}

export interface BriefingConnection {
  withPersonName: string;
  reason: string;
  createdAt: string;
}

export interface ReturnBriefing {
  person: PersonLite;
  lastTime: string[]; // key memories from before
  openLoops: { description: string; owner: "user" | "person" }[];
  newSinceLastSpoke: BriefingConnection[];
  suggestedAction: string | null;
  suggestedOpener: string | null;
  spokenBriefing: string;
  lastEncounterAt: string | null;
}
