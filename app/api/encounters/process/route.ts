import { getDb } from "@/lib/mongodb";
import { processEncounter } from "@/lib/processEncounter";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      personId?: string;
      transcript?: string;
      startedAt?: string;
    };
    if (!body.personId || !body.transcript?.trim()) {
      return Response.json({ error: "personId and transcript are required" }, { status: 400 });
    }
    const db = await getDb();
    const result = await processEncounter(db, {
      personId: body.personId,
      transcript: body.transcript.trim(),
      startedAt: body.startedAt,
    });
    return Response.json({ result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
