import OpenAI from "openai";
import { openaiErrorResponse } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { processName, processDescription, steps, painPoints } = await request.json();

  const stepsText = steps
    .filter((s: { nome: string }) => s.nome)
    .map((s: { nome: string; chi: string; strumenti: string; tempo: string }, i: number) =>
      `${i + 1}. ${s.nome} — Chi: ${s.chi || "N/D"} | Strumenti: ${s.strumenti || "N/D"} | Tempo: ${s.tempo || "N/D"}`
    )
    .join("\n");

  const userPrompt = `Analizza questo processo aziendale e genera una visione agentificata completa.

PROCESSO: ${processName}
DESCRIZIONE: ${processDescription}

PASSAGGI AS-IS:
${stepsText}

PAIN POINTS: ${painPoints}

Rispondi SOLO con un oggetto JSON valido con questa struttura:
{
  "pattern": "uno tra: Single Agent | Routing | Parallelizzazione | Orchestrazione | HITL by Design",
  "vision": "descrizione in 2-3 frasi della versione agentificata del processo",
  "input": "cosa riceve l'agente come input",
  "output": "cosa produce l'agente come output",
  "autonomia": "Fully Automated | Supervised | HITL",
  "approccio": "Sostituzione | Augmentation (scegli in base al processo: preferisci Augmentation per task complessi o ad alto impatto umano)",
  "score": 7,
  "rischi": ["rischio 1", "rischio 2", "rischio 3"],
  "fattibilita": "spiegazione breve di fattibilità tecnica e organizzativa",
  "timeline": "es. 2-3 mesi",
  "quick_win": "il primo esperimento minimo fattibile in 2-4 settimane",
  "confronto": [
    { "dimensione": "Ruolo / Responsabilità", "asis": "chi fa cosa oggi in 10-15 parole", "tobe": "come cambia il ruolo con AI in 10-15 parole" },
    { "dimensione": "Strumenti", "asis": "strumenti usati oggi", "tobe": "strumenti AI nel TO-BE" },
    { "dimensione": "Velocità / Efficienza", "asis": "tempo attuale (es. 2 giorni)", "tobe": "tempo stimato TO-BE (es. 10 minuti)" },
    { "dimensione": "Qualità / Precisione", "asis": "qualità attuale in 10-15 parole", "tobe": "qualità attesa TO-BE in 10-15 parole" },
    { "dimensione": "Carico di lavoro", "asis": "carico attuale su persone in 10-15 parole", "tobe": "carico residuo sull'umano in 10-15 parole" }
  ]
}`;

  try {
    const completion = await withRetry(() => client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "Sei un esperto di agentic AI e process automation. Analizzi processi aziendali e suggerisci come agentificarli. " +
            "Rispondi sempre e solo con JSON valido, senza markdown, senza spiegazioni fuori dal JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    }));

    const text = completion.choices[0]?.message?.content ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return Response.json(JSON.parse(clean));
  } catch (e: unknown) {
    return openaiErrorResponse(e);
  }
}
