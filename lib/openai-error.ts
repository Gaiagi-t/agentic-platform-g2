import OpenAI from "openai";

export function openaiErrorResponse(e: unknown): Response {
  if (e instanceof OpenAI.RateLimitError) {
    return Response.json(
      { error: "AI momentaneamente occupata — troppe richieste simultanee. Riprova tra qualche secondo." },
      { status: 429 }
    );
  }
  if (e instanceof OpenAI.APIConnectionError || e instanceof OpenAI.APIConnectionTimeoutError) {
    return Response.json(
      { error: "Impossibile raggiungere l'AI. Controlla la connessione e riprova." },
      { status: 503 }
    );
  }
  if (e instanceof OpenAI.InternalServerError) {
    return Response.json(
      { error: "Errore temporaneo del servizio AI. Riprova tra qualche secondo." },
      { status: 503 }
    );
  }
  const msg = e instanceof Error ? e.message : "Errore sconosciuto";
  return Response.json({ error: msg }, { status: 500 });
}

export function openaiStreamError(e: unknown): string {
  if (e instanceof OpenAI.RateLimitError) {
    return "\n\n⚠️ AI momentaneamente occupata — troppi utenti simultanei. Riprova tra qualche secondo.";
  }
  if (e instanceof OpenAI.APIConnectionError || e instanceof OpenAI.APIConnectionTimeoutError) {
    return "\n\n⚠️ Connessione all'AI interrotta. Controlla la connessione e riprova.";
  }
  return "\n\n⚠️ Errore durante la risposta AI. Riprova.";
}
