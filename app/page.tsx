"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getParticipant, setParticipant, clearParticipant, resetState } from "@/lib/store";

const STEPS = [
  { n: 1, href: "/portfolio", title: "Process Portfolio", sub: "Identifica 3 processi e posizionali sulla matrice impatto/difficoltà", color: "border-teal", badge: "bg-teal" },
  { n: 2, href: "/mapping", title: "Mappatura AS-IS → TO-BE", sub: "Mappa il processo scelto e lascia che l'AI generi l'analisi agentificata", color: "border-primary", badge: "bg-primary" },
  { n: 3, href: "/prompt-lab", title: "Agentic Design Canvas", sub: "Progetta l'agente: system prompt, tools, MCP, memoria, guardrails e HITL", color: "border-gold", badge: "bg-gold" },
  { n: 4, href: "/tool-selection", title: "Scelta del Tool", sub: "Identifica il livello di sviluppo giusto per il tuo agente con la matrice decisionale A–D", color: "border-violet-500", badge: "bg-violet-500" },
  { n: 5, href: "/roadmap", title: "Roadmap Sprint", sub: "Definisci le 3 fasi di adozione e il tuo commit per i prossimi 30 giorni", color: "border-deepblue", badge: "bg-deepblue" },
];

export default function Home() {
  const [sessionStep, setSessionStep] = useState<number>(4);
  const [participant, setParticipantState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showReset, setShowReset] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const poll = useCallback(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => { if (typeof d.step === "number") setSessionStep(d.step); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = getParticipant();
    setParticipantState(saved);
    setReady(true);
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (ready && !participant) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [ready, participant]);

  const handleRegister = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setParticipant(nameInput.trim());
    setParticipantState(nameInput.trim());
    setNameInput("");
  };

  const handleSwitch = () => {
    clearParticipant();
    setParticipantState(null);
    setShowReset(false);
    setNameInput("");
  };

  const handleReset = () => {
    resetState();
    setShowReset(false);
  };

  if (!ready) return null;

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12 relative">

      {/* ── Registration modal ─────────────────────────────────────── */}
      {!participant && (
        <div className="fixed inset-0 bg-navy/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8">
            <div className="text-center mb-7">
              <div className="w-14 h-14 bg-teal/10 border border-teal/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h2 className="text-xl font-bold text-navy mb-2">Benvenuto/a!</h2>
              <p className="text-sm text-slate leading-relaxed">
                Inserisci il tuo nome per iniziare il workshop.<br />
                Se chiudi e riapri il browser, potrai riprendere da qui.
              </p>
            </div>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Il tuo nome (es. Mario Rossi)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className="w-full py-3 rounded-xl bg-navy text-white font-semibold text-sm hover:bg-deepblue transition-colors disabled:bg-slate-100 disabled:text-slate/40 disabled:cursor-not-allowed"
              >
                Inizia il workshop →
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">

        {/* ── Welcome back banner ──────────────────────────────────── */}
        {participant && (
          <div className="flex items-center justify-between bg-teal/10 border border-teal/20 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-teal text-sm font-bold">✓</span>
              <span className="text-sm text-navy">
                Bentornato/a, <strong>{participant}</strong>! I tuoi dati sono stati recuperati.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {showReset ? (
                <>
                  <span className="text-xs text-slate/70">Sicuro?</span>
                  <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 font-semibold">Sì, cancella</button>
                  <button onClick={() => setShowReset(false)} className="text-xs text-slate hover:text-navy">No</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowReset(true)} className="text-xs text-slate/60 hover:text-slate underline-offset-2 hover:underline">
                    Ricomincia
                  </button>
                  <button onClick={handleSwitch} className="text-xs text-slate hover:text-navy underline-offset-2 hover:underline">
                    Non sei {participant.split(" ")[0]}?
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <div className="inline-block bg-navy text-teal text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Giornata 2
          </div>
          <h1 className="text-3xl font-bold text-navy mb-2">From Insight to Action</h1>
          <p className="text-slate text-sm max-w-md mx-auto">
            Cinque blocchi, un artefatto reale: la tua roadmap di adozione agentificata.
            {sessionStep === 0 && " · La sessione non è ancora iniziata."}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((s) => {
            const locked = sessionStep < s.n;
            return locked ? (
              <div key={s.n} className="bg-white/60 rounded-xl border-l-4 border-slate-200 shadow-sm p-5 flex items-start gap-4 opacity-50 cursor-not-allowed">
                <span className="bg-slate-200 text-slate text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  🔒
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate">{s.title}</span>
                  </div>
                  <p className="text-sm text-slate/60 mt-1">In attesa del facilitatore…</p>
                </div>
              </div>
            ) : (
              <Link key={s.n} href={s.href}>
                <div className={`bg-white rounded-xl border-l-4 ${s.color} shadow-sm hover:shadow-md transition-shadow p-5 flex items-start gap-4 cursor-pointer`}>
                  <span className={`${s.badge} text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                    {s.n}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy">{s.title}</span>
                    </div>
                    <p className="text-sm text-slate mt-1 leading-snug">{s.sub}</p>
                  </div>
                  <span className="text-slate/40 text-lg mt-0.5">›</span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate/50 mt-8">
          Dati salvati localmente nel browser · <a href="/admin" className="hover:text-navy underline underline-offset-2">Area supervisore</a>
        </p>
      </div>
    </div>
  );
}
