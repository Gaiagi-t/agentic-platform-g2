"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { Process } from "@/lib/types";

const QUADRANTS = [
  { key: "quickwins" as const, label: "Quick Wins", action: "INIZIA DA QUI", impatto: "alto" as const, facilita: "facile" as const, border: "border-green-400", bg: "bg-green-50", badge: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-500" },
  { key: "investimenti" as const, label: "Investimenti Strategici", action: "PIANIFICA", impatto: "alto" as const, facilita: "difficile" as const, border: "border-primary", bg: "bg-iceblue", badge: "bg-blue-100 text-blue-800 border-blue-300", dot: "bg-primary" },
  { key: "bassovalore" as const, label: "Basso Valore", action: "EVITA", impatto: "basso" as const, facilita: "facile" as const, border: "border-slate-300", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
  { key: "trappole" as const, label: "Trappole", action: "MAI FARE", impatto: "basso" as const, facilita: "difficile" as const, border: "border-red-300", bg: "bg-red-50", badge: "bg-red-100 text-red-700 border-red-300", dot: "bg-red-400" },
];

const DEMO_PROCESSES: Process[] = [
  { id: "d1", name: "Qualifica Lead", description: "Analisi manuale dei prospect in entrata per valutare fit e priorità commerciale", impatto: "alto", facilita: "facile" },
  { id: "d2", name: "Report Mensile Vendite", description: "Raccolta dati da CRM, Excel e email per produrre il report mensile del team", impatto: "alto", facilita: "difficile" },
  { id: "d3", name: "Onboarding Cliente", description: "Sequenza di email, documenti e task manuali per attivare un nuovo cliente", impatto: "basso", facilita: "facile" },
];

const newProcess = (id: string): Process => ({ id, name: "", description: "", impatto: "alto", facilita: "facile" });

export default function PortfolioPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 1)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    setProcesses(s.processes.length > 0 ? s.processes : [newProcess("p1"), newProcess("p2"), newProcess("p3")]);
    setSelected(s.selectedProcessId);
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  const update = (id: string, field: keyof Process, value: string) =>
    setProcesses((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const loadDemo = () => {
    setProcesses(DEMO_PROCESSES);
    setSelected("d1");
  };

  const save = () => {
    setState({ processes, selectedProcessId: selected });
    router.push("/mapping");
  };

  const filledProcesses = processes.filter((p) => p.name.trim());

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
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      {/* Step header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-teal text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">1</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Process Portfolio</h1>
            <p className="text-sm text-slate">Descrivi 3 processi e posizionali sulla matrice</p>
          </div>
        </div>
        <button
          onClick={loadDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors"
        >
          ⚡ Demo rapida
        </button>
      </div>

      {/* Process forms */}
      <div className="flex flex-col gap-4 mb-8">
        {processes.map((p, i) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-navy text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
              <span className="font-semibold text-navy text-sm">Processo {i + 1}</span>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nome del processo (es. Qualifica lead, Review contratti...)"
                value={p.name}
                onChange={(e) => update(p.id, "name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Descrizione breve: cosa fa, chi lo esegue, quanto spesso..."
                value={p.description}
                onChange={(e) => update(p.id, "description", e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
              />
              <div className="flex gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-slate mb-1 font-medium">Impatto potenziale</p>
                  <div className="flex gap-2">
                    {(["alto", "basso"] as const).map((v) => (
                      <button key={v} onClick={() => update(p.id, "impatto", v)} className={`px-3 py-1 text-xs rounded-full font-semibold border transition-colors ${p.impatto === v ? "bg-navy text-white border-navy" : "bg-white text-slate border-slate-200 hover:border-navy"}`}>
                        {v === "alto" ? "Alto" : "Basso"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate mb-1 font-medium">Difficoltà implementazione</p>
                  <div className="flex gap-2">
                    {(["facile", "difficile"] as const).map((v) => (
                      <button key={v} onClick={() => update(p.id, "facilita", v)} className={`px-3 py-1 text-xs rounded-full font-semibold border transition-colors ${p.facilita === v ? "bg-navy text-white border-navy" : "bg-white text-slate border-slate-200 hover:border-navy"}`}>
                        {v === "facile" ? "Facile" : "Difficile"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2x2 Matrix */}
      {filledProcesses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-3">Dove l&apos;AI può generare impatto nel tuo lavoro?</h2>
          <div className="relative">
            <div className="flex justify-center mb-1">
              <span className="text-xs text-slate/70 font-medium">← Facile · · · Difficoltà implementazione · · · Difficile →</span>
            </div>
            <div className="flex gap-0">
              <div className="flex items-center justify-center w-6 shrink-0">
                <span className="text-xs text-slate/70 font-medium" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Impatto</span>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                {QUADRANTS.map((q) => {
                  const inQ = filledProcesses.filter((p) => p.impatto === q.impatto && p.facilita === q.facilita);
                  return (
                    <div key={q.key} className={`${q.bg} ${q.border} border-2 rounded-xl p-4 min-h-[140px] flex flex-col`}>
                      <div className="mb-2">
                        <p className="font-bold text-sm text-navy">{q.label}</p>
                        <p className="text-xs text-slate">Impatto: {q.impatto === "alto" ? "Alto" : "Basso"} · Facilità: {q.facilita === "facile" ? "Facile" : "Difficile"}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-white/70 rounded border border-slate-200 text-slate-600">{q.action}</span>
                      </div>
                      <div className="flex flex-col gap-1 mt-auto">
                        {inQ.map((p) => (
                          <button key={p.id} onClick={() => setSelected(p.id)} className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${selected === p.id ? "bg-navy text-white border-navy" : `${q.badge} border hover:opacity-80`}`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${selected === p.id ? "bg-teal" : q.dot}`} />
                            {p.name}
                            {selected === p.id && <span className="ml-auto">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {filledProcesses.length > 0 && !selected && (
              <p className="text-xs text-primary mt-2 text-center">Clicca su un processo nella matrice per selezionarlo</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <a href="/" className="text-sm text-slate hover:text-navy">← Home</a>
        <button onClick={save} disabled={!selected} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${selected ? "bg-navy text-white hover:bg-deepblue" : "bg-slate-200 text-slate cursor-not-allowed"}`}>
          Procedi con &ldquo;{processes.find((p) => p.id === selected)?.name || "..."}&rdquo; →
        </button>
      </div>
    </div>
  );
}
