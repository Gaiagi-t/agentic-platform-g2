import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;

  if (!audio) {
    return Response.json({ error: "Nessun file audio" }, { status: 400 });
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "it",
    });
    return Response.json({ text: transcription.text });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
