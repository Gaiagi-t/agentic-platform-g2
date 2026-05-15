"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { Process } from "@/lib/types";

const QUADRANTS = [
  { key: "quickwins",     label: "Quick Wins",              action: "INIZIA DA QUI", impatto: "alto"  as const, facilita: "facile"    as const, border: "border-green-400",  bg: "bg-green-50",   badge: "bg-green-100 text-green-800 border-green-300",   dot: "bg-green-500"  },
  { key: "investimenti",  label: "Investimenti Strategici", action: "PIANIFICA",     impatto: "alto"  as const, facilita: "difficile" as const, border: "border-primary",    bg: "bg-iceblue",    badge: "bg-blue-100 text-blue-800 border-blue-300",      dot: "bg-primary"    },
  { key: "bassovalore",   label: "Basso Valore",            action: "EVITA",         impatto: "basso" as const, facilita: "facile"    as const, border: "border-slate-300",  bg: "bg-slate-50",   badge: "bg-slate-100 text-slate-600 border-slate-300",   dot: "bg-slate-400"  },
  { key: "trappole",      label: "Trappole",                action: "MAI FARE",      impatto: "basso" as const, facilita: "difficile" as const, border: "border-red-300",    bg: "bg-red-50",     badge: "bg-red-100 text-red-700 border-red-300",         dot: "bg-red-400"    },
];

const DEMO_PROCESSES: Process[] = [
  { id: "d1", name: "Qualifica Lead", description: "Analisi manuale dei prospect in entrata per valutare fit commerciale e priorità di contatto", impatto: "alto", facilita: "facile", analyzed: true, aiExplanation: "Alto impatto perché accelera il ciclo commerciale; implementazione facile grazie al pattern ripetitivo e ai dati già strutturati nel CRM." },
  { id: "d2", name: "Report Mensile Vendite", description: "Raccolta dati da CRM, Excel e email per produrre il report mensile del team commerciale", impatto: "alto", facilita: "difficile", analyzed: true, aiExplanation: "Alto impatto per la direzione; difficile perché richiede integrazione con più sistemi eterogenei e dati non sempre strutturati." },
  { id: "d3", name: "Onboarding Cliente", description: "Sequenza di email, documenti e task manuali per attivare un nuovo cliente post-contratto", impatto: "basso", facilita: "facile", analyzed: true, aiExplanation: "Impatto contenuto perché la frequenza è bassa; implementazione facile per la struttura sequenziale e le regole chiare." },
];

const newProcess = (id: string): Process => ({ id, name: "", description: "", impatto: "alto", facilita: "facile", analyzed: false });

export default function PortfolioPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

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

  const update = (id: string, field: keyof Process, value: string | boolean) =>
    setProcesses((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const analyzeOne = async (p: Process) => {
    if (!p.name.trim() || !p.description.trim()) return;
    setAnalyzing((prev) => ({ ...prev, [p.id]: true }));
    try {
      const res = await fetch("/api/analyze-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, description: p.description }),
      });
      const data = await res.json();
      if (data.impatto && data.facilita) {
        setProcesses((prev) =>
          prev.map((proc) =>
            proc.id === p.id
              ? { ...proc, impatto: data.impatto, facilita: data.facilita, aiExplanation: data.spiegazione, analyzed: true, manuallyMoved: false }
              : proc
          )
        );
      }
    } finally {
      setAnalyzing((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const analyzeAll = async () => {
    const toAnalyze = processes.filter((p) => p.name.trim() && p.description.trim() && !p.analyzed);
    await Promise.all(toAnalyze.map(analyzeOne));
  };

  const handleDrop = (quadrantKey: string) => {
    if (!dragId) return;
    const q = QUADRANTS.find((q) => q.key === quadrantKey);
    if (!q) return;
    setProcesses((prev) =>
      prev.map((p) =>
        p.id === dragId ? { ...p, impatto: q.impatto, facilita: q.facilita, manuallyMoved: true } : p
      )
    );
    setDragId(null);
    setDragOver(null);
  };

  const loadDemo = () => {
    setProcesses(DEMO_PROCESSES);
    setSelected("d1");
  };

  const save = () => {
    setState({ processes, selectedProcessId: selected });
    router.push("/mapping");
  };

  const analyzedProcesses = processes.filter((p) => p.analyzed && p.name.trim());
  const allCanAnalyze = processes.every((p) => p.name.trim() && p.description.trim());
  const anyUnanalyzed = processes.some((p) => p.name.trim() && p.description.trim() && !p.analyzed);

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-navy mb-2">Step non ancora aperto</h2>
        <p className="text-slate text-sm">Il facilitatore aprirà questo step a breve.</p>
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
            <p className="text-sm text-slate">Descrivi i tuoi processi — l&apos;AI li posizionerà nella matrice</p>
          </div>
        </div>
        <button onClick={loadDemo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors">
          ⚡ Demo rapida
        </button>
      </div>

      {/* ── STEP 1: Descrivi i processi ─────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6">
        {processes.map((p, i) => (
          <div key={p.id} className={`bg-white rounded-xl shadow-sm border p-5 transition-colors ${p.analyzed ? "border-primary/30" : "border-slate-200"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-navy text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
                <span className="font-semibold text-navy text-sm">Processo {i + 1}</span>
              </div>
              {p.analyzed && (
                <div className="flex items-center gap-1.5">
                  {p.manuallyMoved && <span className="text-[10px] text-slate/60 italic">spostato manualmente</span>}
                  {(() => {
                    const q = QUADRANTS.find((q) => q.impatto === p.impatto && q.facilita === p.facilita)!;
                    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${q.badge}`}>{q.label}</span>;
                  })()}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Nome del processo (es. Qualifica lead, Review contratti…)"
                value={p.name}
                onChange={(e) => update(p.id, "name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Descrizione: cosa fa, chi lo esegue, con quale frequenza, quali strumenti usa oggi…"
                value={p.description}
                onChange={(e) => { update(p.id, "description", e.target.value); if (p.analyzed) update(p.id, "analyzed", false); }}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
              />

              {/* AI suggestion block */}
              {p.analyzed && p.aiExplanation && (
                <div className="flex gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                  <span className="text-primary text-sm shrink-0 mt-0.5">✦</span>
                  <p className="text-xs text-slate leading-relaxed">{p.aiExplanation}</p>
                </div>
              )}

              {/* Analyze button */}
              {p.name.trim() && p.description.trim() && (
                <button
                  onClick={() => analyzeOne(p)}
                  disabled={!!analyzing[p.id]}
                  className={`self-start flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    analyzing[p.id]
                      ? "bg-slate-100 text-slate cursor-not-allowed"
                      : p.analyzed
                      ? "bg-slate-100 text-slate border border-slate-200 hover:bg-slate-200"
                      : "bg-teal text-white hover:bg-deepblue"
                  }`}
                >
                  {analyzing[p.id] ? (
                    <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analisi in corso…</>
                  ) : p.analyzed ? (
                    "↺ Ri-analizza"
                  ) : (
                    "✦ Analizza con AI"
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Analyze all button */}
        {allCanAnalyze && anyUnanalyzed && (
          <button
            onClick={analyzeAll}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-teal/40 text-sm font-semibold text-teal hover:bg-teal/5 transition-colors"
          >
            ✦ Analizza tutti e tre con AI
          </button>
        )}
      </div>

      {/* ── STEP 2: Matrice con drag-and-drop ───────────────────────── */}
      {analyzedProcesses.length > 0 && (
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Dove l&apos;AI può generare impatto nel tuo lavoro?</h2>
              <p className="text-xs text-slate mt-0.5">Trascina un processo in un altro quadrante per cambiare il posizionamento</p>
            </div>
          </div>

          <div className="flex gap-0">
            <div className="flex items-center justify-center w-6 shrink-0">
              <span className="text-xs text-slate/70 font-medium" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>Impatto ↑</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-center mb-1">
                <span className="text-xs text-slate/70 font-medium">← Facile · · · Difficoltà implementazione · · · Difficile →</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUADRANTS.map((q) => {
                  const inQ = analyzedProcesses.filter((p) => p.impatto === q.impatto && p.facilita === q.facilita);
                  const isOver = dragOver === q.key;
                  return (
                    <div
                      key={q.key}
                      className={`${q.bg} ${q.border} border-2 rounded-xl p-4 min-h-[130px] flex flex-col transition-all ${isOver ? "scale-[1.02] shadow-lg ring-2 ring-navy/30" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(q.key); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => handleDrop(q.key)}
                    >
                      <div className="mb-2">
                        <p className="font-bold text-sm text-navy">{q.label}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-white/70 rounded border border-slate-200 text-slate-600">{q.action}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 mt-auto">
                        {inQ.map((p) => (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDragId(p.id)}
                            onDragEnd={() => { setDragId(null); setDragOver(null); }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold cursor-grab active:cursor-grabbing select-none transition-opacity ${q.badge} border ${dragId === p.id ? "opacity-40" : "opacity-100"}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${q.dot}`} />
                            {p.name}
                            {p.manuallyMoved && <span className="ml-auto text-[9px] opacity-60">✎</span>}
                          </div>
                        ))}
                        {isOver && dragId && (
                          <div className="border-2 border-dashed border-navy/30 rounded-lg h-8 flex items-center justify-center">
                            <span className="text-[10px] text-navy/50">Rilascia qui</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Selezione processo ───────────────────────────────── */}
      {analyzedProcesses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-1">Quale processo vuoi agentificare oggi?</h2>
          <p className="text-xs text-slate mb-4">Scegli liberamente — il Consigliato è il Quick Win, ma puoi lavorare su qualsiasi processo.</p>
          <div className="flex flex-col gap-3">
            {analyzedProcesses.map((p) => {
              const q = QUADRANTS.find((q) => q.impatto === p.impatto && q.facilita === p.facilita)!;
              const isQuickWin = p.impatto === "alto" && p.facilita === "facile";
              const isSelected = selected === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected ? "border-navy bg-navy/5 shadow-md" : "border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-navy bg-navy" : "border-slate-300"}`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-teal" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-semibold text-sm ${isSelected ? "text-navy" : "text-slate-800"}`}>{p.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${q.badge}`}>{q.label}</span>
                        {isQuickWin && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white">✦ Consigliato</span>}
                      </div>
                      {p.aiExplanation && (
                        <p className="text-xs text-slate leading-snug">{p.aiExplanation}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-between">
        <a href="/" className="text-sm text-slate hover:text-navy">← Home</a>
        <button
          onClick={save}
          disabled={!selected}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${selected ? "bg-navy text-white hover:bg-deepblue" : "bg-slate-200 text-slate cursor-not-allowed"}`}
        >
          Procedi con &ldquo;{processes.find((p) => p.id === selected)?.name || "…"}&rdquo; →
        </button>
      </div>
    </div>
  );
}
