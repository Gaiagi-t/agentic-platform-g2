import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { processName, processDescription, steps, painPoints } = await request.json();

  const stepsText = steps
    .filter((s: { nome: string }) => s.nome)
    .map((s: { nome: string; chi: string; strumenti: string; tempo: string }, i: number) =>
      `${i + 1}. ${s.nome} — Chi: ${s.chi || "N/D"} | Strumenti: ${s.strumenti || "N/D"} | Tempo: ${s.tempo || "N/D"}`
    )
    .join("\n");

  const userPrompt = `Analizza questo processo aziendale e genera una visione agentificata.

PROCESSO: ${processName}
DESCRIZIONE: ${processDescription}

PASSAGGI AS-IS:
${stepsText}

PAIN POINTS: ${painPoints}

Rispondi SOLO con un oggetto JSON valido (nessun testo fuori dal JSON) con questa struttura:
{
  "pattern": "uno tra: Single Agent | Routing | Parallelizzazione | Orchestrazione | HITL by Design",
  "vision": "descrizione in 2-3 frasi della versione agentificata del processo",
  "input": "cosa riceve l'agente come input",
  "output": "cosa produce l'agente come output",
  "autonomia": "Fully Automated | Supervised | HITL",
  "score": 7,
  "rischi": ["rischio 1", "rischio 2", "rischio 3"],
  "fattibilita": "spiegazione breve di fattibilità tecnica e organizzativa",
  "timeline": "es. 2-3 mesi",
  "quick_win": "il primo esperimento minimo fattibile in 2-4 settimane"
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        "Sei un esperto di agentic AI e process automation. Analizzi processi aziendali e suggerisci come agentificarli. " +
        "Rispondi sempre e solo con JSON valido, senza markdown, senza spiegazioni fuori dal JSON.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return Response.json(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return Response.json({ error: msg }, { status: 500 });
  }
}
