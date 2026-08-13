/**
 * Demo-flow unit tests (no database needed — pure logic only):
 *   1. Maya's need is extracted and stored as a `need` memory.
 *   2. Daniel's offer is extracted as an `offer` memory.
 *   3. Matching links Maya's need to Daniel's offer.
 *   4. Maya's return briefing lists the connection as "new since last spoke".
 *
 * Run: npm test  (node --test with native TypeScript stripping)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { fallbackExtract } from "../lib/memoryExtraction";
import { keywordMatch } from "../lib/connectionMatcher";
import { composeBriefing } from "../lib/briefing";
import { DEMO_TRANSCRIPTS } from "../lib/demoScript";
import type { ConnectionDoc, MemoryDoc, OpenLoopDoc, PersonDoc } from "../lib/types";

const mayaId = new ObjectId();
const danielId = new ObjectId();
const encounterId = new ObjectId();

function mem(personId: ObjectId, type: MemoryDoc["type"], text: string, createdAt: Date): MemoryDoc {
  return {
    _id: new ObjectId(),
    sessionId: "test",
    personId,
    encounterId,
    type,
    text,
    sourceText: text,
    importance: 5,
    createdAt,
  };
}

test("Maya's need and Aditya's promise are extracted", () => {
  const result = fallbackExtract(DEMO_TRANSCRIPTS.maya.transcript, "Maya");
  const types = result.memories.map((m) => m.type);
  assert.ok(types.includes("need"), "expected a `need` memory for Maya");
  assert.ok(
    types.includes("commitment_user_to_person"),
    "expected an open-loop commitment from the user"
  );
  const need = result.memories.find((m) => m.type === "need")!;
  assert.match(need.text.toLowerCase(), /vector search|mongodb/);
});

test("Daniel's offer is extracted", () => {
  const result = fallbackExtract(DEMO_TRANSCRIPTS.daniel.transcript, "Daniel");
  const offer = result.memories.find((m) => m.type === "offer");
  assert.ok(offer, "expected an `offer` memory for Daniel");
  assert.match(offer!.text, /MongoDB Atlas Vector Search/i);
});

test("matching links Maya's need with Daniel's offer", () => {
  const t0 = new Date("2026-08-13T10:00:00Z");
  const mayaNeed = mem(mayaId, "need", "Maya needs vector search / MongoDB expertise.", t0);
  const danielOffer = mem(
    danielId,
    "offer",
    "Daniel has expertise with MongoDB Atlas Vector Search.",
    new Date("2026-08-13T10:10:00Z")
  );
  const matches = keywordMatch(danielOffer, [mayaNeed]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].memory.personId.toHexString(), mayaId.toHexString());
});

test("Maya's return briefing surfaces Daniel as new-since-last-spoke", () => {
  const mayaLastEncounter = new Date("2026-08-13T10:00:00Z");
  const connectionCreated = new Date("2026-08-13T10:15:00Z"); // during Daniel's encounter

  const maya: PersonDoc = {
    _id: mayaId,
    sessionId: "test",
    name: "Maya",
    shortDescription: "Robotics founder",
    interests: [],
    createdAt: mayaLastEncounter,
    updatedAt: mayaLastEncounter,
    firstMetAt: mayaLastEncounter,
    lastEncounterAt: mayaLastEncounter,
  };
  const daniel: PersonDoc = { ...maya, _id: danielId, name: "Daniel", shortDescription: "" };

  const memories = [
    mem(mayaId, "fact", "Maya is building a robotics startup.", mayaLastEncounter),
    mem(mayaId, "need", "Maya needs help with vector search.", mayaLastEncounter),
  ];
  const openLoops: OpenLoopDoc[] = [
    {
      _id: new ObjectId(),
      sessionId: "test",
      personId: mayaId,
      description: "Send Maya the agent-memory paper.",
      owner: "user",
      status: "open",
      createdAt: mayaLastEncounter,
      completedAt: null,
    },
  ];
  const connections: ConnectionDoc[] = [
    {
      _id: new ObjectId(),
      sessionId: "test",
      personAId: mayaId,
      personBId: danielId,
      reason: "Daniel works on exactly the vector-search problem Maya mentioned.",
      score: 0.9,
      engine: "keyword",
      triggerMemoryIds: [],
      createdAt: connectionCreated,
      status: "new",
    },
    // an OLD connection from before Maya's encounter must NOT appear
    {
      _id: new ObjectId(),
      sessionId: "test",
      personAId: mayaId,
      personBId: danielId,
      reason: "Stale pre-existing connection.",
      score: 0.5,
      engine: "keyword",
      triggerMemoryIds: [],
      createdAt: new Date("2026-08-13T09:00:00Z"),
      status: "new",
    },
  ];

  const briefing = composeBriefing({
    person: maya,
    memories,
    openLoops,
    connections,
    peopleById: new Map([[danielId.toHexString(), daniel]]),
  });

  assert.equal(briefing.newSinceLastSpoke.length, 1, "only the post-encounter connection is new");
  assert.equal(briefing.newSinceLastSpoke[0].withPersonName, "Daniel");
  assert.equal(briefing.suggestedAction, "Introduce Maya to Daniel");
  assert.equal(briefing.suggestedOpener, "I actually just met someone you should talk to.");
  assert.ok(briefing.openLoops.some((l) => l.owner === "user"));
  assert.ok(briefing.lastTime.some((t) => /robotics/i.test(t)));
  assert.match(briefing.spokenBriefing, /Daniel/);
});
