import OpenAI from "openai";
import { openaiErrorResponse, openaiStreamError } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { systemPrompt, testMessage } = await request.json();

  if (!systemPrompt?.trim() || !testMessage?.trim()) {
    return new Response("Prompt e messaggio di test sono obbligatori", { status: 400 });
  }

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await withRetry(() => client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: testMessage },
      ],
    }));
  } catch (e: unknown) {
    return openaiErrorResponse(e);
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (e: unknown) {
        controller.enqueue(encoder.encode(openaiStreamError(e)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
