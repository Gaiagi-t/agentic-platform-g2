import OpenAI from "openai";
import { openaiErrorResponse } from "@/lib/openai-error";
import { withRetry } from "@/lib/openai-retry";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const { name, description } = await request.json();

  const prompt = `Sei un esperto di AI transformation strategica in contesti aziendali B2B. Il tuo obiettivo è aiutare i manager a capire il VERO potenziale agentico dei loro processi — non l'automazione banale, ma la trasformazione intelligente.

Analizza questo processo aziendale e posizionalo nella matrice 2×2:
- Asse Y — Impatto potenziale sull'organizzazione (alto / basso)
- Asse X — Complessità di implementazione agentica (facile / difficile)

CRITERI PER ALTO IMPATTO: processo ad alta frequenza, coinvolge decisioni rilevanti, influenza revenue o costi significativi, tocca la relazione con clienti o partner, errori hanno conseguenze serie.
CRITERI PER BASSO IMPATTO: bassa frequenza, impatto operativo marginale, già ottimizzato, nessuna leva strategica.

CRITERI PER DIFFICILE (la norma per i processi agentici reali): richiede giudizio contestuale, dati da fonti eterogenee, integrazione con sistemi multipli, variabilità nei casi, conoscenza di dominio esperta, compliance o privacy, interfaccia con persone esterne, output non deterministico. La maggior parte dei processi degni di trasformazione agentica ricade qui.
CRITERI PER FACILE (rari): processo puramente rule-based e meccanico, dati al 100% strutturati e uniformi, nessuna variabile contestuale, nessuna integrazione, output sempre deterministico. Casi limite, non la norma.

BIAS CORRETTIVO IMPORTANTE: evita di classificare come "facile" processi che in realtà richiedono intelligenza contestuale. Un agente AI che porta valore reale è quasi sempre su un processo "difficile" — è proprio lì che l'AI fa la differenza rispetto a semplice automazione RPA. Privilegia la lettura "Investimento Strategico" (alto impatto + difficile) per processi che meritano una visione trasformativa a lungo termine.

Processo: "${name}"
Descrizione: "${description}"

Rispondi SOLO con JSON valido (nessun testo fuori dal JSON):
{
  "impatto": "alto" | "basso",
  "facilita": "facile" | "difficile",
  "spiegazione": "1-2 frasi che spiegano il potenziale trasformativo del processo e perché merita un approccio strategico"
}`;

  try {
    const completion = await withRetry(() => client.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 256,
      messages: [
        { role: "system", content: "Rispondi sempre e solo con JSON valido, senza markdown, senza testo aggiuntivo." },
        { role: "user", content: prompt },
      ],
    }));

    const text = completion.choices[0]?.message?.content ?? "";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return Response.json(JSON.parse(clean));
  } catch (e: unknown) {
    return openaiErrorResponse(e);
  }
}
