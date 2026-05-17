import OpenAI from "openai";
import type { AIAnalysis, AgenticDesign, ToolChoice, RoadmapPhase } from "@/lib/types";
import { openaiErrorResponse, openaiStreamError } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { messages, processName, process, analysis, agenticDesign, toolChoice, roadmap, commit } =
    await request.json() as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      processName: string;
      process: { description?: string; impatto?: string; facilita?: string } | null;
      analysis: AIAnalysis | null;
      agenticDesign: AgenticDesign;
      toolChoice: ToolChoice;
      roadmap: { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase };
      commit: string;
    };

  const levelNames: Record<string, string> = {
    A: "Piattaforme Hosted Enterprise (Copilot Studio, Vertex AI, Bedrock, Agentforce)",
    B: "Automation Platforms (n8n, Make.com, Dify, Zapier)",
    C: "Framework Open-Source (LangGraph, CrewAI, AutoGen, PydanticAI)",
    D: "SDK Vendor (Anthropic SDK, OpenAI Agents SDK, Google ADK)",
  };

  const toolContext = toolChoice.primaryLevel
    ? `Livello primario: ${toolChoice.primaryLevel} — ${levelNames[toolChoice.primaryLevel] ?? ""}${
        toolChoice.secondaryLevel
          ? `\nLivello secondario: ${toolChoice.secondaryLevel} — ${levelNames[toolChoice.secondaryLevel] ?? ""}`
          : ""
      }${toolChoice.notes ? `\nNote: ${toolChoice.notes}` : ""}`
    : "(non ancora compilato)";

  const designContext = agenticDesign.systemPrompt
    ? `System Prompt (estratto): ${agenticDesign.systemPrompt.slice(0, 200)}...
Tools selezionati: ${agenticDesign.tools.join(", ") || "nessuno"}
Tools aggiuntivi: ${agenticDesign.toolsCustom || "nessuno"}
MCP: ${agenticDesign.mcpServers || "non specificato"}
Memoria STM: ${agenticDesign.memorySTM || "non specificata"}
Memoria LTM: ${agenticDesign.memoryLTM || "non specificata"}
Guardrails: ${agenticDesign.guardrails.join(", ") || "nessuno"}
HITL: ${agenticDesign.hitlPoints || "non specificati"}
Flussi automatizzabili: ${agenticDesign.flussiAuto || "non specificati"}`
    : "(canvas non ancora compilato)";

  const roadmapContext = `Quick Win (0–3 mesi):
  Chi: ${roadmap.quickWin.chi || "(vuoto)"}
  Cosa: ${roadmap.quickWin.cosa || "(vuoto)"}
  Strumento: ${roadmap.quickWin.strumento || "(vuoto)"}
  KPI: ${roadmap.quickWin.kpi || "(vuoto)"}

Scale (3–12 mesi):
  Chi: ${roadmap.scale.chi || "(vuoto)"}
  Cosa: ${roadmap.scale.cosa || "(vuoto)"}
  Strumento: ${roadmap.scale.strumento || "(vuoto)"}
  KPI: ${roadmap.scale.kpi || "(vuoto)"}

Transform (12–24 mesi):
  Chi: ${roadmap.transform.chi || "(vuoto)"}
  Cosa: ${roadmap.transform.cosa || "(vuoto)"}
  Strumento: ${roadmap.transform.strumento || "(vuoto)"}
  KPI: ${roadmap.transform.kpi || "(vuoto)"}

Commit 30 giorni: ${commit || "(vuoto)"}`;

  const systemPrompt = `Sei un advisor esperto di agentic AI transformation che aiuta un manager a costruire la roadmap concreta di adozione del suo agente AI.

=== CONTESTO COMPLETO DEL PARTECIPANTE ===

PROCESSO:
Nome: ${processName || "N/D"}
Descrizione: ${process?.description || "N/D"}
Impatto: ${process?.impatto === "alto" ? "Alto" : process?.impatto ? "Basso" : "N/D"} | Difficoltà: ${process?.facilita === "facile" ? "Facile" : process?.facilita ? "Difficile" : "N/D"}

ANALISI TO-BE:
Pattern agentico: ${analysis?.pattern || "N/D"}
Visione: ${analysis?.vision || "N/D"}
Input agente: ${analysis?.input || "N/D"}
Output agente: ${analysis?.output || "N/D"}
Autonomia: ${analysis?.autonomia || "N/D"}
Score fattibilità: ${analysis?.score ? `${analysis.score}/10` : "N/D"}
Quick Win suggerito dall'AI: ${analysis?.quick_win || "N/D"}
Timeline stimata: ${analysis?.timeline || "N/D"}
Rischi: ${analysis?.rischi?.join("; ") || "N/D"}

AGENTIC DESIGN CANVAS:
${designContext}

SCELTA DEL TOOL:
${toolContext}

ROADMAP ATTUALE:
${roadmapContext}

=== IL TUO RUOLO ===
- Aiuta il partecipante a completare le 3 fasi della roadmap partendo da tutto il contesto sopra
- Per il Quick Win, parti sempre dal "Quick Win suggerito dall'AI" e adattalo agli strumenti scelti
- Per ogni fase suggerisci concretamente: chi coinvolgere (ruoli specifici), cosa automatizzare per primo, quale strumento usare (nomi reali coerenti con il livello scelto), come misurare il successo (KPI specifici e numerici)
- Per il commit 30 giorni: deve essere un'azione singola, concreta, misurabile — non "esplorare" né "valutare"
- Tieni conto del livello tool scelto: se B, suggerisci Make/n8n; se D, suggerisci SDK diretti; se A, suggerisci le piattaforme enterprise; se C, framework OSS
- Sii concreto e diretto — max 5 frasi per risposta
- Rispondi sempre in italiano

Quando suggerisci un valore specifico per un campo della roadmap, segnalalo con:
✏️ [fase — campo]: testo suggerito`;

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await withRetry(() => client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 900,
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
