import OpenAI from "openai";
import type { AgenticDesign, AIAnalysis } from "@/lib/types";
import { openaiErrorResponse, openaiStreamError } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { messages, design, processName, analysis } = await request.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    design: AgenticDesign;
    processName: string;
    analysis: AIAnalysis | null;
  };

  const designSummary = `
System Prompt: ${design.systemPrompt ? `${design.systemPrompt.slice(0, 300)}${design.systemPrompt.length > 300 ? "..." : ""}` : "(non compilato)"}
Tools selezionati: ${design.tools.join(", ") || "(nessuno)"}
Tools aggiuntivi: ${design.toolsCustom || "(nessuno)"}
MCP Servers: ${design.mcpServers || "(non specificati)"}
Memoria STM: ${design.memorySTM || "(non specificata)"}
Memoria LTM: ${design.memoryLTM || "(non specificata)"}
Guardrails attivi: ${design.guardrails.join(", ") || "(nessuno)"}
HITL Points: ${design.hitlPoints || "(non specificati)"}
Flussi automatizzabili: ${design.flussiAuto || "(non specificati)"}`.trim();

  const systemPrompt = `Sei un esperto di architettura agentica AI che guida i partecipanti di un workshop nella progettazione del loro agente.

=== CONTESTO PROCESSO ===
Processo: ${processName || "N/D"}
Pattern agentico: ${analysis?.pattern || "N/D"}
Visione TO-BE: ${analysis?.vision || "N/D"}
Input agente: ${analysis?.input || "N/D"}
Output agente: ${analysis?.output || "N/D"}
Autonomia: ${analysis?.autonomia || "N/D"}

=== DESIGN CANVAS ATTUALE ===
${designSummary}

=== BASE DI CONOSCENZA AGENTICA ===

**1. SYSTEM PROMPT**
Definisce ruolo, obiettivo, tono, vincoli e formato output. Struttura consigliata: Ruolo → Obiettivo → Contesto di dominio → Regole operative → Formato output → Gestione casi edge.

**2. PLANNER / REASONING**
- ReAct (Reasoning+Acting): ciclo pensa→agisci→osserva. Adatto per task esplorativi con feedback intermedio.
- ReWOO: pianifica tutto in anticipo senza osservare risultati intermedi. Più efficiente, meno flessibile.

**3. TOOLS & CONNETTORI**
- Retrieval/Web Search: ricerca web in tempo reale, RAG su documenti
- Code Execution: Python sandbox, calcoli, analisi dati
- Process Automation: Make.com, Zapier, n8n per workflow
- CRM/Database: Salesforce, HubSpot, SQL, Airtable
- Email/Calendar: Gmail, Outlook, Google Calendar
- IoT/Sensori: sistemi fisici connessi
- Custom API: qualsiasi REST/GraphQL endpoint

**4. MCP (Model Context Protocol)**
Il protocollo "USB-C delle AI" — standardizza la connessione tra modelli e sorgenti dati esterne. Esempi: MCP Salesforce, MCP Google Drive, MCP Notion, MCP GitHub, MCP Slack. Si aggiunge come layer architetturale, non è obbligatorio da subito.

**5. MEMORIA**
- STM (Short-Term Memory): context window attiva — conversazione corrente, output tool recenti, stato sessione. Limitata dal context window del modello.
- LTM (Long-Term Memory): persistente tra sessioni — vector DB (Pinecone, Weaviate), SQL, file system. Abilitata da RAG o query esplicite al DB.

**6. GUARDRAILS & SICUREZZA**
- Classificatore rilevanza: filtra input fuori perimetro
- Classificatore sicurezza: intercetta contenuti pericolosi o policy violations
- Filtro PII: rileva e maschera dati personali (GDPR)
- Moderazione contenuti: usa API di moderazione (es. OpenAI Moderation)
- Tool safeguards: sandbox per code execution, rate limiting, autorizzazioni granulari
- Validazione output: schema check, hallucination detection, consistency check
Superficie d'attacco da presidiare: Prompt Injection, Abuso Strumenti, Escalation Privilegi, Esfiltrazione Dati, Approval Fatigue.

**7. HITL (Human In The Loop)**
Punti dove il controllo umano è necessario:
- Pre-action approval: l'agente chiede conferma prima di agire su sistemi esterni
- Output review: umano valida output critico prima della consegna
- Escalation su incertezza: l'agente si ferma se confidence < soglia
- Approvazione finanziaria: per azioni con impatto economico
- Exception handling: casi fuori dal perimetro normale

**8. FLUSSI AUTOMATIZZABILI**
Task che possono girare in autonomia senza supervisione: ricerche, aggregazioni dati, notifiche interne, report standard, compilazione form, log strutturati.

**9. PATTERN MULTI-AGENT**
- Single Agent: un solo agente, task sequenziali
- Routing: agente smista a specialisti in base al tipo di richiesta
- Parallelizzazione: più agenti lavorano in simultanea su sotto-task
- Orchestrazione: agente orchestratore coordina agenti worker (gerarchico)
- HITL by Design: human in the loop strutturato nel flusso

=== IL TUO RUOLO ===
- Rispondi a domande specifiche su qualsiasi building block
- Quando ti chiede di generare il system prompt, produci SOLO il testo del system prompt (senza spiegazioni, senza intestazioni come "Ecco il system prompt:")
- Suggerisci scelte concrete in base al processo e al pattern scelto
- Identifica gap o incoerenze nel design canvas
- Sii diretto, pratico — max 4-6 frasi per risposta normale
- Rispondi sempre in italiano

Quando suggerisci un valore specifico per un campo del canvas, segnalalo con:
✏️ [nome campo]: contenuto suggerito`;

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await withRetry(() => client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
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
