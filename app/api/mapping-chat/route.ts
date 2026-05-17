import OpenAI from "openai";
import type { ASISStep, AIAnalysis } from "@/lib/types";
import { openaiErrorResponse, openaiStreamError } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { messages, analysis, processName, steps, painPoints } = await request.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    analysis: AIAnalysis | null;
    processName: string;
    steps: ASISStep[];
    painPoints: string;
  };

  const stepsText = steps
    .filter((s) => s.nome)
    .map((s, i) => `${i + 1}. ${s.nome} — Chi: ${s.chi || "N/D"} | Strumenti: ${s.strumenti || "N/D"} | Tempo: ${s.tempo || "N/D"}`)
    .join("\n");

  const tobeContext = analysis
    ? `
Pattern agentico: ${analysis.pattern}
Livello autonomia: ${analysis.autonomia}
Score fattibilità: ${analysis.score}/10
Visione TO-BE: ${analysis.vision}
Input agente: ${analysis.input}
Output agente: ${analysis.output}
Rischi: ${analysis.rischi.join("; ")}
Fattibilità: ${analysis.fattibilita}
Timeline: ${analysis.timeline}
Quick Win: ${analysis.quick_win}`
    : "(non ancora generata)";

  const systemPrompt = `Sei un consulente esperto di agentic AI e process automation che aiuta a raffinare la visione TO-BE di un processo aziendale.

=== CONTESTO PROCESSO ===
Processo: ${processName}
Pain Points: ${painPoints || "N/D"}

Passaggi AS-IS:
${stepsText || "N/D"}

=== VISIONE TO-BE ATTUALE ===
${tobeContext}

=== IL TUO RUOLO ===
- Aiuta l'utente ad approfondire, rafforzare o modificare la visione TO-BE
- Rispondi a domande su pattern agentici, rischi, implementazione, timeline
- Proponi alternative concrete quando chiesto
- Sii diretto, pratico, orientato all'azione — niente generalità
- Risposte concise (3-6 frasi), in italiano

Quando suggerisci una modifica specifica a un campo, segnalala con:
✏️ [nome campo]: testo suggerito

Campi modificabili: pattern, vision, input, output, autonomia, rischi, fattibilita, timeline, quick_win`;

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await withRetry(() => client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
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
