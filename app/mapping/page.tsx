"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { ASISStep, AIAnalysis, Mapping } from "@/lib/types";

const PATTERNS = ["Single Agent", "Routing", "Parallelizzazione", "Orchestrazione", "HITL by Design"];

const emptyStep = (): ASISStep => ({ nome: "", chi: "", strumenti: "", tempo: "" });

export default function MappingPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [steps, setSteps] = useState<ASISStep[]>([emptyStep()]);
  const [painPoints, setPainPoints] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    if (s.mapping?.processId === s.selectedProcessId) {
      setSteps(s.mapping.asis.steps.length ? s.mapping.asis.steps : [emptyStep()]);
      setPainPoints(s.mapping.asis.painPoints || "");
      setAnalysis(s.mapping.tobe || null);
    }
  }, []);

  const updateStep = (i: number, field: keyof ASISStep, val: string) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  };

  const addStep = () => setSteps((prev) => [...prev, emptyStep()]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const analyse = async () => {
    setLoading(true);
    setError("");
    try {
      const s = getState();
      const proc = s.processes.find((p) => p.id === s.selectedProcessId);
      const res = await fetch("/api/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processName,
          processDescription: proc?.description || "",
          steps,
          painPoints,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: AIAnalysis = await res.json();
      setAnalysis(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    const s = getState();
    const mapping: Mapping = {
      processId: s.selectedProcessId || "",
      asis: { steps, painPoints },
      tobe: analysis,
    };
    setState({ mapping });
    router.push("/prompt-lab");
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      {/* Step header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-primary text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">2</span>
        <div>
          <h1 className="text-xl font-bold text-navy">Mappatura AS-IS → TO-BE</h1>
          <p className="text-sm text-slate">
            Processo selezionato: <span className="font-semibold text-navy">{processName || "—"}</span>
          </p>
        </div>
      </div>

      {/* AS-IS */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <h2 className="font-bold text-navy mb-1">AS-IS — Come funziona oggi</h2>
        <p className="text-xs text-slate mb-4">Aggiungi i passaggi principali del processo attuale</p>

        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate uppercase">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-xs text-red-400 hover:text-red-600">
                    Rimuovi
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Nome del passaggio"
                  value={step.nome}
                  onChange={(e) => updateStep(i, "nome", e.target.value)}
                  className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
                <input
                  placeholder="Chi esegue"
                  value={step.chi}
                  onChange={(e) => updateStep(i, "chi", e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
                <input
                  placeholder="Strumenti usati"
                  value={step.strumenti}
                  onChange={(e) => updateStep(i, "strumenti", e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
                <input
                  placeholder="Tempo stimato"
                  value={step.tempo}
                  onChange={(e) => updateStep(i, "tempo", e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          ))}
          <button onClick={addStep} className="text-sm text-primary hover:text-deepblue font-medium self-start">
            + Aggiungi step
          </button>
        </div>

        <div className="mt-4">
          <label className="text-xs font-bold text-slate uppercase block mb-1">Pain points principali</label>
          <textarea
            placeholder="Cosa non funziona? Dove si perde tempo? Quali errori si ripetono?"
            value={painPoints}
            onChange={(e) => setPainPoints(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
          />
        </div>

        <button
          onClick={analyse}
          disabled={loading || steps.every((s) => !s.nome.trim())}
          className={`mt-4 w-full py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
            loading || steps.every((s) => !s.nome.trim())
              ? "bg-slate-200 text-slate cursor-not-allowed"
              : "bg-teal text-white hover:bg-deepblue"
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analisi in corso...
            </>
          ) : (
            "Analizza con AI →"
          )}
        </button>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </section>

      {/* TO-BE */}
      {analysis && (
        <section className="bg-white rounded-xl shadow-sm border border-primary/30 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-teal/10 text-teal text-xs font-bold px-2 py-0.5 rounded">TO-BE — Visione agentificata</span>
            <span className={`ml-auto text-sm font-bold px-2 py-0.5 rounded-full ${
              analysis.score >= 7 ? "bg-green-100 text-green-700" :
              analysis.score >= 5 ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-600"
            }`}>
              Score: {analysis.score}/10
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Pattern agentico</p>
              <select
                value={analysis.pattern}
                onChange={(e) => setAnalysis({ ...analysis, pattern: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              >
                {PATTERNS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Livello autonomia</p>
              <input
                value={analysis.autonomia}
                onChange={(e) => setAnalysis({ ...analysis, autonomia: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Visione TO-BE</p>
            <textarea
              value={analysis.vision}
              onChange={(e) => setAnalysis({ ...analysis, vision: e.target.value })}
              rows={2}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Input agente</p>
              <input
                value={analysis.input}
                onChange={(e) => setAnalysis({ ...analysis, input: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Output agente</p>
              <input
                value={analysis.output}
                onChange={(e) => setAnalysis({ ...analysis, output: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Fattibilità</p>
            <textarea
              value={analysis.fattibilita}
              onChange={(e) => setAnalysis({ ...analysis, fattibilita: e.target.value })}
              rows={2}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </div>

          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Rischi principali</p>
            <div className="flex flex-col gap-1">
              {analysis.rischi.map((r, i) => (
                <input
                  key={i}
                  value={r}
                  onChange={(e) => {
                    const updated = [...analysis.rischi];
                    updated[i] = e.target.value;
                    setAnalysis({ ...analysis, rischi: updated });
                  }}
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Timeline stimata</p>
              <input
                value={analysis.timeline}
                onChange={(e) => setAnalysis({ ...analysis, timeline: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Quick Win suggerito</p>
              <input
                value={analysis.quick_win}
                onChange={(e) => setAnalysis({ ...analysis, quick_win: e.target.value })}
                className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <a href="/portfolio" className="text-sm text-slate hover:text-navy">← Portfolio</a>
        <button
          onClick={save}
          disabled={!analysis}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            analysis ? "bg-navy text-white hover:bg-deepblue" : "bg-slate-200 text-slate cursor-not-allowed"
          }`}
        >
          Salva e vai al Prompt Lab →
        </button>
      </div>
    </div>
  );
}
