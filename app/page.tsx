"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const STEPS = [
  { n: 1, href: "/portfolio", title: "Process Portfolio", sub: "Identifica 3 processi e posizionali sulla matrice impatto/difficoltà", time: "60 min", color: "border-teal", badge: "bg-teal" },
  { n: 2, href: "/mapping", title: "Mappatura AS-IS → TO-BE", sub: "Mappa il processo scelto e lascia che l'AI generi l'analisi agentificata", time: "70 min", color: "border-primary", badge: "bg-primary" },
  { n: 3, href: "/prompt-lab", title: "System Prompt Lab", sub: "Scrivi il system prompt del tuo agente e testalo live", time: "40 min", color: "border-gold", badge: "bg-gold" },
  { n: 4, href: "/roadmap", title: "Roadmap Sprint", sub: "Definisci le 3 fasi di adozione e il tuo commit per i prossimi 30 giorni", time: "45 min", color: "border-deepblue", badge: "bg-deepblue" },
];

export default function Home() {
  const [sessionStep, setSessionStep] = useState<number>(4);

  const poll = useCallback(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => { if (typeof d.step === "number") setSessionStep(d.step); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-block bg-navy text-teal text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Giornata 2
          </div>
          <h1 className="text-3xl font-bold text-navy mb-2">From Insight to Action</h1>
          <p className="text-slate text-sm max-w-md mx-auto">
            Quattro blocchi, un artefatto reale: la tua roadmap di adozione agentificata.
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate">{s.title}</span>
                    <span className="text-xs text-slate shrink-0">{s.time}</span>
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-navy">{s.title}</span>
                      <span className="text-xs text-slate shrink-0">{s.time}</span>
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
