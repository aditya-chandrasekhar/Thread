import { getDb } from "@/lib/mongodb";
import { getReturnBriefing } from "@/lib/briefing";

export async function GET(_req: Request, ctx: RouteContext<"/api/people/[id]/briefing">) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const briefing = await getReturnBriefing(db, id);
    if (!briefing) return Response.json({ error: "Person not found" }, { status: 404 });
    return Response.json({ briefing });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
