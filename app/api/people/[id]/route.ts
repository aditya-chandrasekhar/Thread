import { getDb, SESSION_ID } from "@/lib/mongodb";
import { forgetPerson } from "@/lib/people";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/people/[id]">) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const ok = await forgetPerson(db, SESSION_ID, id);
    if (!ok) return Response.json({ error: "Person not found" }, { status: 404 });
    return Response.json({ forgotten: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
