import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { name, description } = await request.json();

  const prompt = `Sei un esperto di AI adoption e process automation in contesti aziendali B2B.

Analizza questo processo aziendale e suggerisci il posizionamento nella matrice 2×2:
- Asse Y — Impatto potenziale: quanto valore genera automatizzarlo con AI? (alto / basso)
- Asse X — Difficoltà implementazione: quanto è complesso implementare l'AI su questo processo? (facile / difficile)

Criteri per ALTO impatto: alta frequenza, molte persone coinvolte, errori costosi, decisioni strategiche.
Criteri per BASSO impatto: bassa frequenza, impatto limitato, già ottimizzato.
Criteri per FACILE: dati strutturati, pattern ripetitivo, nessuna integrazione complessa, regole chiare.
Criteri per DIFFICILE: dati non strutturati, giudizio esperto richiesto, integrazioni complesse, compliance.

Processo: "${name}"
Descrizione: "${description}"

Rispondi SOLO con JSON valido (nessun testo fuori dal JSON):
{
  "impatto": "alto" | "basso",
  "facilita": "facile" | "difficile",
  "spiegazione": "1-2 frasi che spiegano il posizionamento suggerito"
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: "Rispondi sempre e solo con JSON valido, senza markdown, senza testo aggiuntivo.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return Response.json(JSON.parse(clean));
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
