"use client";

import { useState, useEffect, useCallback } from "react";

const STEPS = [
  { n: 1, title: "Process Portfolio", sub: "Matrice impatto/difficoltà", time: "60 min" },
  { n: 2, title: "Mappatura AS-IS → TO-BE", sub: "Analisi AI del processo", time: "70 min" },
  { n: 3, title: "System Prompt Lab", sub: "Scrittura e test live", time: "40 min" },
  { n: 4, title: "Roadmap Sprint", sub: "3 fasi + export PDF", time: "45 min" },
];

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const fetchStep = useCallback(async () => {
    const r = await fetch("/api/session");
    const d = await r.json();
    setStep(d.step);
  }, []);

  useEffect(() => {
    fetchStep();
  }, [fetchStep]);

  const send = async (newStep: number) => {
    setLoading(true);
    setFeedback("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: newStep, pin }),
      });
      const d = await r.json();
      if (r.ok) {
        setStep(d.step);
        setFeedback(`Step aggiornato a ${d.step === 0 ? "nessuno" : d.step}`);
      } else {
        setFeedback(d.error || "Errore");
        if (r.status === 401) setAuthed(false);
      }
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(""), 2500);
    }
  };

  const login = async () => {
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: step, pin }),
    });
    if (r.ok) setAuthed(true);
    else setFeedback("PIN non valido");
  };

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="text-2xl mb-2">🔐</div>
          <h1 className="font-bold text-navy text-lg mb-1">Area Supervisore</h1>
          <p className="text-sm text-slate mb-5">Inserisci il PIN per gestire la sessione</p>
          <input
            type="password"
            placeholder="PIN sessione"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-primary text-center tracking-widest"
            autoFocus
          />
          {feedback && <p className="text-red-500 text-xs mb-2">{feedback}</p>}
          <button
            onClick={login}
            className="w-full bg-navy text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-deepblue transition-colors"
          >
            Accedi
          </button>
          <p className="text-xs text-slate/50 mt-4">Default: IFAB2026 · Configurabile via ADMIN_PIN</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy">Pannello Supervisore</h1>
          <p className="text-sm text-slate">Controlla l&apos;avanzamento della sessione</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate">Step corrente</span>
          <div className="text-2xl font-bold text-navy">
            {step === 0 ? "—" : step} <span className="text-sm text-slate font-normal">/ 4</span>
          </div>
        </div>
      </div>

      {/* Step controls */}
      <div className="flex flex-col gap-3 mb-6">
        {STEPS.map((s) => {
          const isOpen = step >= s.n;
          const isCurrent = step === s.n;
          return (
            <div
              key={s.n}
              className={`bg-white rounded-xl border-2 p-4 flex items-center gap-4 transition-all ${
                isCurrent ? "border-teal shadow-md" : isOpen ? "border-primary/40" : "border-slate-200"
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                isOpen ? "bg-primary text-white" : "bg-slate-100 text-slate"
              }`}>
                {s.n}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy text-sm">{s.title}</p>
                  {isCurrent && <span className="text-[10px] bg-teal text-white px-1.5 py-0.5 rounded-full font-bold">IN CORSO</span>}
                  {isOpen && !isCurrent && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">APERTO</span>}
                </div>
                <p className="text-xs text-slate">{s.sub} · {s.time}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {isOpen ? (
                  <button
                    onClick={() => send(s.n - 1)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    Chiudi
                  </button>
                ) : (
                  <button
                    onClick={() => send(s.n)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy text-white hover:bg-deepblue transition-colors"
                  >
                    Apri →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk actions */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => send(4)}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-teal text-white hover:bg-deepblue transition-colors"
        >
          Apri tutti gli step
        </button>
        <button
          onClick={() => send(0)}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate hover:bg-slate-200 transition-colors border border-slate-200"
        >
          Reset sessione
        </button>
      </div>

      {feedback && (
        <div className="bg-teal/10 border border-teal/20 rounded-lg p-3 text-sm text-teal text-center font-medium">
          {feedback}
        </div>
      )}

      <div className="mt-6 bg-navy/5 rounded-xl p-4 text-xs text-slate">
        <p className="font-bold text-navy mb-1">Note operative</p>
        <p>· Lo step aperto sblocca anche tutti quelli precedenti</p>
        <p>· I partecipanti vedono il blocco &quot;In attesa&quot; per gli step non ancora aperti</p>
        <p>· La sessione si aggiorna ogni 10 secondi sui browser dei partecipanti</p>
        <p>· In caso di riavvio server, reimpostare manualmente lo step corrente</p>
      </div>
    </div>
  );
}
