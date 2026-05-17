import OpenAI from "openai";
import type { AIAnalysis, AgenticDesign, ToolChoice, RoadmapPhase } from "@/lib/types";
import { openaiErrorResponse } from "@/lib/openai-error";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { processName, process, analysis, agenticDesign, toolChoice, roadmap, commit } =
    await request.json() as {
      processName: string;
      process: { description?: string; impatto?: string; facilita?: string } | null;
      analysis: AIAnalysis | null;
      agenticDesign: AgenticDesign;
      toolChoice: ToolChoice;
      roadmap: { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase };
      commit: string;
    };

  const levelNames: Record<string, string> = {
    A: "Piattaforme Hosted Enterprise (Copilot Studio, Vertex AI, Bedrock)",
    B: "Automation Platforms (n8n, Make.com, Dify, Zapier)",
    C: "Framework Open-Source (LangGraph, CrewAI, AutoGen)",
    D: "SDK Vendor (Anthropic SDK, OpenAI Agents SDK, Google ADK)",
  };

  const userPrompt = `Valuta questo progetto agentico sviluppato durante un masterclass iFAB:

PROCESSO: ${processName || "N/D"}
Descrizione: ${process?.description || "N/D"}
Impatto: ${process?.impatto === "alto" ? "Alto" : "Basso"} | Difficoltà: ${process?.facilita === "facile" ? "Facile" : "Difficile"}

ANALISI TO-BE:
Pattern: ${analysis?.pattern || "N/D"} | Score fattibilità: ${analysis?.score ? `${analysis.score}/10` : "N/D"}
Visione: ${analysis?.vision || "N/D"}
Autonomia: ${analysis?.autonomia || "N/D"}
Timeline: ${analysis?.timeline || "N/D"}
Rischi: ${analysis?.rischi?.join("; ") || "N/D"}

AGENTIC DESIGN CANVAS:
System Prompt: ${agenticDesign.systemPrompt ? "compilato (" + agenticDesign.systemPrompt.slice(0, 100) + "...)" : "vuoto"}
Tools: ${agenticDesign.tools.join(", ") || "nessuno"}
MCP: ${agenticDesign.mcpServers || "non specificato"}
Memoria STM: ${agenticDesign.memorySTM || "non specificata"}
Memoria LTM: ${agenticDesign.memoryLTM || "non specificata"}
Guardrails: ${agenticDesign.guardrails.join(", ") || "nessuno"}
HITL: ${agenticDesign.hitlPoints || "non specificati"}

SCELTA DEL TOOL: ${toolChoice.primaryLevel ? levelNames[toolChoice.primaryLevel] : "non scelto"}${toolChoice.secondaryLevel ? ` + ${levelNames[toolChoice.secondaryLevel]}` : ""}
${toolChoice.notes ? `Note: ${toolChoice.notes}` : ""}

ROADMAP:
Quick Win (0-3 mesi): ${roadmap.quickWin.cosa || "vuoto"} | KPI: ${roadmap.quickWin.kpi || "vuoto"}
Scale (3-12 mesi): ${roadmap.scale.cosa || "vuoto"} | KPI: ${roadmap.scale.kpi || "vuoto"}
Transform (12-24 mesi): ${roadmap.transform.cosa || "vuoto"} | KPI: ${roadmap.transform.kpi || "vuoto"}
Commit 30 giorni: ${commit || "vuoto"}

Rispondi SOLO con un oggetto JSON valido, senza markdown né testo aggiuntivo:
{
  "valutazione": "paragrafo di 3-4 frasi che valuta complessivamente la solidità e il realismo del progetto",
  "punti_di_forza": ["punto 1 specifico al progetto", "punto 2", "punto 3"],
  "rischi": ["rischio 1 specifico", "rischio 2"],
  "raccomandazione": "1-2 frasi con la singola raccomandazione più importante per il successo del progetto nei prossimi 90 giorni"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sei un esperto di AI transformation. Valuta in modo critico e costruttivo progetti agentici aziendali. Rispondi sempre e solo con JSON valido, senza testo esterno al JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    });
    const json = JSON.parse(completion.choices[0].message.content || "{}");
    return Response.json(json);
  } catch (e: unknown) {
    return openaiErrorResponse(e);
  }
}
