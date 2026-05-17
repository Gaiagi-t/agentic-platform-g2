import OpenAI from "openai";
import type { AIAnalysis, ToolChoice, RoadmapPhase } from "@/lib/types";
import { openaiErrorResponse, openaiStreamError } from "@/lib/openai-error";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { processName, process, quickWin, toolChoice, analysis } =
    await request.json() as {
      processName: string;
      process: { description?: string; impatto?: string; facilita?: string } | null;
      quickWin: RoadmapPhase;
      toolChoice: ToolChoice;
      analysis: AIAnalysis | null;
    };

  const levelNames: Record<string, string> = {
    A: "Piattaforme Hosted Enterprise (Copilot Studio, Vertex AI, Bedrock, Agentforce)",
    B: "Automation Platforms (Make.com, n8n, Dify, Zapier)",
    C: "Framework Open-Source (LangGraph, CrewAI, AutoGen, PydanticAI)",
    D: "SDK Vendor (Anthropic SDK, OpenAI Agents SDK, Google ADK)",
  };

  const systemPrompt = `Sei un implementation coach specializzato in agentic AI. Genera una guida pratica e dettagliata per implementare il Quick Win descritto.

STRUTTURA OBBLIGATORIA (usa esattamente questi titoli markdown):

## Panoramica
2-3 frasi: cosa costruiremo concretamente e perché il tool scelto è adatto.

## Prerequisiti
Lista di tutto ciò che serve prima di iniziare: account, API key, accessi, permessi, dati di input.

## Passaggi
5-8 passi numerati. Ogni passo deve avere: azione concreta + come farlo nel tool specifico.
- Per **Make.com**: nomina i moduli reali (es. "HTTP > Make a request", "OpenAI > Create a Completion")
- Per **n8n**: nomina i nodi reali (es. "HTTP Request", "OpenAI", "Set", "IF")
- Per **Anthropic/OpenAI SDK**: includi snippet Python o TypeScript brevi
- Per **Copilot Studio / Vertex AI / Agentforce**: guida click-by-click con nomi delle sezioni UI
- Per **LangGraph/CrewAI/AutoGen**: include struttura del codice con classi/funzioni reali

## Validazione
Checklist di 3-4 punti: come testare che l'implementazione funzioni correttamente.

## Stima dei tempi
Tempo totale e breakdown per fase (setup, configurazione, test).

## Prossimi step (fase Scale)
Come evolvere questo Quick Win verso la fase Scale della roadmap.

REGOLE FERREE:
- Usa ESATTAMENTE i tool menzionati nel campo "Strumento" del Quick Win — non inventarne altri
- Nomina moduli, nodi, funzioni, API endpoint REALI e specifici
- Non generalizzare: ogni passo deve essere eseguibile senza ambiguità
- Includi snippet di codice o config JSON/YAML quando il tool lo richiede
- Stima tempi realistici per un team non esperto
- Rispondi in italiano (nomi tecnici e codice in inglese)`;

  const userPrompt = `Genera la guida per questo Quick Win:

PROCESSO: ${processName || "N/D"}
Descrizione: ${process?.description || "N/D"}
Impatto: ${process?.impatto === "alto" ? "Alto" : "Basso"} | Difficoltà: ${process?.facilita === "facile" ? "Facile" : "Difficile"}

QUICK WIN:
Chi: ${quickWin.chi || "N/D"}
Cosa: ${quickWin.cosa || "N/D"}
Strumento: ${quickWin.strumento || "N/D"}
KPI di successo: ${quickWin.kpi || "N/D"}

LIVELLO TOOL SCELTO: ${toolChoice.primaryLevel ? `${toolChoice.primaryLevel} — ${levelNames[toolChoice.primaryLevel]}` : "N/D"}${toolChoice.secondaryLevel ? ` + ${toolChoice.secondaryLevel} — ${levelNames[toolChoice.secondaryLevel]}` : ""}

VISIONE AI DEL QUICK WIN: ${analysis?.quick_win || "N/D"}
PATTERN AGENTICO: ${analysis?.pattern || "N/D"}`;

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    stream = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1800,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
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
