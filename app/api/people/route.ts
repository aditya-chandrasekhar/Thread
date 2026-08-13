import { getDb, SESSION_ID } from "@/lib/mongodb";
import { createPerson, listPeople } from "@/lib/people";

export async function GET() {
  try {
    const db = await getDb();
    const people = await listPeople(db, SESSION_ID);
    return Response.json({ people });
  } catch (err) {
    return Response.json({ error: message(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
    const db = await getDb();
    const person = await createPerson(db, SESSION_ID, name);
    return Response.json({ person }, { status: 201 });
  } catch (err) {
    return Response.json({ error: message(err) }, { status: 500 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error";
}
