/**
 * Pre-filled demo conversations — a reliability fallback for noisy venues.
 * These go through the exact same extraction → memory → matching pipeline as
 * live transcription; nothing about the Maya ↔ Daniel connection is hardcoded.
 */

export const DEMO_TRANSCRIPTS: Record<string, { name: string; transcript: string }> = {
  maya: {
    name: "Maya",
    transcript: `Aditya: Hey, I'm Aditya. What's your name?
Maya: I'm Maya. I'm building a robotics startup. We're having trouble with vector search right now, and I'd really like to meet someone who knows MongoDB well.
Aditya: That's really interesting. I have an agent-memory paper that might be useful too. I'll send it to you later.`,
  },
  daniel: {
    name: "Daniel",
    transcript: `Daniel: Hey, I'm Daniel. I work a lot with MongoDB Atlas Vector Search. I'm here because I'd love to meet more people who are building robotics products.
Aditya: Nice to meet you, Daniel. I'll keep that in mind.`,
  },
};
