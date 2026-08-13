import { getDb } from "@/lib/mongodb";
import { askThread } from "@/lib/askThread";
import { openRouterAvailable } from "@/lib/openrouter";

export async function POST(request: Request) {
  try {
    if (!openRouterAvailable()) {
      return Response.json(
        { error: "Ask Thread needs OpenRouter configured." },
        { status: 503 }
      );
    }
    const { question } = (await request.json()) as { question?: string };
    if (!question?.trim()) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }
    const db = await getDb();
    const answer = await askThread(db, question.trim().slice(0, 500));
    return Response.json({ answer });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ask failed" },
      { status: 500 }
    );
  }
}
