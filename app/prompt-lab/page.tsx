"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";

const DEMO_PROMPT = `Sei un agente AI specializzato nella qualifica di lead B2B.

## Ruolo
Analizzi le informazioni su un'azienda prospect e produci una scheda di qualificazione strutturata con score e raccomandazione.

## Obiettivo
Dato il nome dell'azienda e la richiesta iniziale, valuta il fit con il nostro ICP e suggerisci l'azione commerciale ottimale.

## ICP target
- Aziende B2B, 50–500 dipendenti
- Settori: manifatturiero, consulenza, financial services
- Budget stimato: >50k€/anno
- Decisore: CEO, COO o Head of Sales

## Output atteso
Produci sempre:
1. Score di qualificazione (1–10)
2. Executive summary (3 righe max)
3. Punti di forza del prospect
4. Red flags o rischi
5. Azione consigliata: Chiama subito / Nurturing / Disqualifica

## Regole
- Non inventare dati — segnala se un'informazione non è disponibile
- Sii conciso e orientato all'azione
- Non usare gergo tecnico nel report finale`;

const TEMPLATE = (processName: string, pattern: string) =>
  `Sei un agente AI specializzato nel processo: ${processName}.
Pattern operativo: ${pattern}.

## Ruolo
[Descrivi cosa fa l'agente]

## Obiettivo
[Cosa deve produrre come output]

## Regole
- [Regola 1]
- [Cosa NON fare]

## Formato output
[Come strutturare la risposta]`;

export default function PromptLabPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [pattern, setPattern] = useState("");
  const [prompt, setPrompt] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [response, setResponse] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 3)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    const pat = s.mapping?.tobe?.pattern || "Single Agent";
    setPattern(pat);
    setPrompt(s.systemPrompt || TEMPLATE(proc?.name || "il processo", pat));
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight;
  }, [response]);

  const loadDemo = () => {
    setPrompt(DEMO_PROMPT);
    setTestMsg("Analizza questa azienda prospect: Brembo SpA, settore automotive, ~15.000 dipendenti, hanno contattato per un progetto di automazione del processo commerciale.");
  };

  const test = async () => {
    if (!testMsg.trim() || !prompt.trim()) return;
    setStreaming(true);
    setResponse("");
    setError("");
    try {
      const res = await fetch("/api/prompt-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: prompt, testMessage: testMsg }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResponse((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setStreaming(false);
    }
  };

  const save = () => {
    setState({ systemPrompt: prompt });
    router.push("/roadmap");
  };

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-navy mb-2">Step non ancora aperto</h2>
        <p className="text-slate text-sm">Il facilitatore aprirà questo step a breve. La pagina si aggiorna automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-gold text-navy text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">3</span>
          <div>
            <h1 className="text-xl font-bold text-navy">System Prompt Lab</h1>
            <p className="text-sm text-slate">Agente per: <span className="font-semibold text-navy">{processName || "il processo selezionato"}</span></p>
          </div>
        </div>
        <button onClick={loadDemo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors">
          ⚡ Demo rapida
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-navy text-sm">System Prompt</h2>
            <button onClick={() => setPrompt(TEMPLATE(processName, pattern))} className="text-xs text-primary hover:text-deepblue">Usa template</button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Scrivi il system prompt del tuo agente..."
            className="flex-1 min-h-[300px] lg:min-h-[400px] w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono resize-none focus:outline-none focus:border-primary"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate">{prompt.length} caratteri</span>
            <button onClick={save} className="px-4 py-2 bg-navy text-white text-sm rounded-lg font-semibold hover:bg-deepblue transition-colors">Salva →</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col">
          <h2 className="font-bold text-navy text-sm mb-3">Test live</h2>
          <div ref={responseRef} className="flex-1 min-h-[200px] max-h-[300px] overflow-y-auto bg-slate-50 rounded-lg p-3 text-sm text-slate-700 mb-3 whitespace-pre-wrap font-mono border border-slate-100">
            {response || <span className="text-slate/40 italic">La risposta dell&apos;agente apparirà qui...</span>}
            {streaming && <span className="inline-block w-1.5 h-4 bg-teal animate-pulse ml-0.5 align-text-bottom" />}
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-3">{error}</div>}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Scrivi un messaggio di test..."
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !streaming && test()}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
            />
            <button onClick={test} disabled={streaming || !testMsg.trim() || !prompt.trim()} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors shrink-0 ${streaming || !testMsg.trim() || !prompt.trim() ? "bg-slate-200 text-slate cursor-not-allowed" : "bg-teal text-white hover:bg-deepblue"}`}>
              {streaming ? "..." : "Testa"}
            </button>
          </div>
          <p className="text-xs text-slate/60 mt-2">Premi Invio o clicca Testa</p>
        </div>
      </div>

      <div className="mt-5 bg-navy/5 border border-navy/10 rounded-xl p-4">
        <p className="text-xs font-bold text-navy uppercase mb-2">Elementi chiave di un buon system prompt</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {["Ruolo specifico dell'agente", "Obiettivo chiaro e misurabile", "Formato output atteso", "Vincoli espliciti (cosa NON fare)", "Contesto di dominio rilevante", "Gestione dei casi edge"].map((tip) => (
            <p key={tip} className="text-xs text-slate flex gap-1.5"><span className="text-teal shrink-0">·</span> {tip}</p>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <a href="/mapping" className="text-sm text-slate hover:text-navy">← Mappatura</a>
        <button onClick={save} className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-navy text-white hover:bg-deepblue transition-colors">
          Salva e vai alla Roadmap →
        </button>
      </div>
    </div>
  );
}
