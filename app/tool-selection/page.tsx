"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { ToolLevel } from "@/lib/types";

// ── Decision tree ─────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 1,
    text: "Hai bisogno di scrivere, eseguire o modificare codice sorgente?",
    hint: "L'agente deve generare o far girare script Python, modificare file, o eseguire codice arbitrario.",
  },
  {
    id: 2,
    text: "Vuoi controllare ogni componente del sistema (memoria, orchestrazione, tool)?",
    hint: "Vuoi gestire direttamente l'orchestrazione, la memoria, il routing tra agenti e ogni chiamata API.",
  },
  {
    id: 3,
    text: "Sei già in un ecosistema cloud specifico (Microsoft / Google / AWS)?",
    hint: "La tua azienda ha contratti enterprise attivi con uno di questi provider.",
  },
  {
    id: 4,
    text: "Hai principalmente bisogno di connettere API e automatizzare processi?",
    hint: "Workflow di integrazione tra sistemi, trigger-action, spostare dati tra piattaforme.",
  },
  {
    id: 5,
    text: "Vuoi massimo controllo sul modello specifico e accesso a feature proprietarie?",
    hint: "Usare funzionalità esclusive come tool use nativo di Claude, structured output di OpenAI, ecc.",
  },
];

function getNext(q: number, ans: "si" | "no"): { nextQ: number; result: ToolLevel | null } {
  if (q === 1) return ans === "si" ? { nextQ: 0, result: "E" } : { nextQ: 2, result: null };
  if (q === 2) return ans === "si" ? { nextQ: 5, result: null } : { nextQ: 3, result: null };
  if (q === 3) return ans === "si" ? { nextQ: 0, result: "A" } : { nextQ: 4, result: null };
  if (q === 4) return ans === "si" ? { nextQ: 0, result: "B" } : { nextQ: 5, result: null };
  if (q === 5) return { nextQ: 0, result: ans === "si" ? "D" : "C" };
  return { nextQ: 0, result: null };
}

// ── Level data ────────────────────────────────────────────────────────────

type LevelInfo = {
  name: string;
  tagline: string;
  border: string;
  bg: string;
  badge: string;
  text: string;
  tools: string[];
  pros: string[];
  cons: string[];
  idealFor: string;
  effort: string;
  control: string;
};

const LEVELS: Record<ToolLevel, LevelInfo> = {
  A: {
    name: "Piattaforme Hosted Enterprise",
    tagline: "Velocità di deploy e governance out-of-the-box",
    border: "border-indigo-400",
    bg: "bg-indigo-50",
    badge: "bg-indigo-600 text-white",
    text: "text-indigo-700",
    tools: ["Microsoft Copilot Studio", "Google Vertex AI Agent Builder", "AWS Bedrock Agents", "Salesforce Agentforce", "ServiceNow"],
    pros: ["Governance e compliance enterprise nativi", "Integrazione con ecosistema cloud esistente", "Supporto e SLA vendor garantiti"],
    cons: ["Vendor lock-in forte", "Flessibilità architetturale limitata", "Costo licenze elevato"],
    idealFor: "Aziende già su Azure, Google Cloud o AWS che vogliono velocità di deploy e compliance senza infrastruttura custom.",
    effort: "Basso",
    control: "Basso",
  },
  B: {
    name: "Automation Platforms",
    tagline: "No-code / low-code per workflow e integrazioni",
    border: "border-orange-400",
    bg: "bg-orange-50",
    badge: "bg-orange-500 text-white",
    text: "text-orange-700",
    tools: ["n8n", "Make.com", "Dify", "Zapier", "Power Automate"],
    pros: ["No-code / low-code accessibile", "Centinaia di connettori pronti all'uso", "Prototipazione in ore, non settimane"],
    cons: ["Logiche complesse difficili da esprimere", "Costo cresce con i volumi", "Meno controllo sulla logica AI"],
    idealFor: "Connettere API, automatizzare workflow ripetitivi e processi trigger-action senza scrivere codice.",
    effort: "Basso",
    control: "Medio",
  },
  C: {
    name: "Framework Open-Source",
    tagline: "Massima flessibilità, nessun vendor lock-in",
    border: "border-emerald-400",
    bg: "bg-emerald-50",
    badge: "bg-emerald-600 text-white",
    text: "text-emerald-700",
    tools: ["LangGraph", "LangChain", "CrewAI", "AutoGen (AG2)", "PydanticAI"],
    pros: ["Controllo totale su ogni componente", "Community open-source attiva", "Nessuna dipendenza da vendor"],
    cons: ["Richiede skill Python solide", "Infrastruttura e manutenzione a carico del team"],
    idealFor: "Team con sviluppatori che vogliono architettura custom senza dipendenza da singolo vendor.",
    effort: "Alto",
    control: "Alto",
  },
  D: {
    name: "SDK Vendor",
    tagline: "Feature proprietarie esclusive del modello",
    border: "border-violet-400",
    bg: "bg-violet-50",
    badge: "bg-violet-600 text-white",
    text: "text-violet-700",
    tools: ["Anthropic SDK (Claude)", "OpenAI Agents SDK", "Google ADK (Gemini)", "Mistral API"],
    pros: ["Accesso a feature proprietarie esclusive", "Ottimizzato per le capacità del modello", "Documentazione e supporto dedicati"],
    cons: ["Parziale vendor lock-in sul modello AI", "Skill specifiche richieste per ogni SDK"],
    idealFor: "Sfruttare al massimo le capacità di un modello specifico: tool use nativo, structured output, streaming avanzato.",
    effort: "Medio",
    control: "Alto",
  },
  E: {
    name: "Agentic Coding Tools",
    tagline: "AI pair programming per sviluppo custom",
    border: "border-rose-400",
    bg: "bg-rose-50",
    badge: "bg-rose-600 text-white",
    text: "text-rose-700",
    tools: ["Cursor", "GitHub Copilot", "Devin", "Claude Code", "Windsurf"],
    pros: ["Accelera drasticamente la scrittura di codice", "Pair programming AI-powered", "Ideale per build e debug agenti custom"],
    cons: ["Richiede competenze di sviluppo software", "Non sostituisce decisioni architetturali"],
    idealFor: "Sviluppatori che costruiscono agenti custom e vogliono velocizzare scrittura, refactoring e debug del codice.",
    effort: "Medio",
    control: "Massimo",
  },
};

const COMBOS: Record<string, string> = {
  "A+D": "Enterprise conversazionale — piattaforma hosted per governance + SDK per feature AI avanzate",
  "B+C": "Pipeline dati agentica — automazione no-code per integrazioni + framework OSS per logica complessa",
  "C+D": "Full control — framework open-source + SDK vendor per massimizzare le capacità del modello",
  "D+C": "Full control — SDK vendor + framework open-source per massimizzare le capacità del modello",
  "A+B": "Enterprise rapida — piattaforma hosted + connettori no-code per integrazioni veloci",
};

// ── Sub-components ────────────────────────────────────────────────────────

function EffortTag({ label, value }: { label: string; value: string }) {
  const color =
    value === "Basso" ? "bg-green-100 text-green-700" :
    value === "Medio" ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}: {value}
    </span>
  );
}

function LevelCard({ level, compact = false, selected = false, onClick }: {
  level: ToolLevel; compact?: boolean; selected?: boolean; onClick?: () => void;
}) {
  const info = LEVELS[level];
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-xl border-2 w-full text-left transition-all ${
          selected
            ? `${info.border} ${info.bg} shadow-sm`
            : "border-slate-200 hover:border-slate-300 bg-white"
        }`}
      >
        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${info.badge}`}>{level}</span>
        <div className="min-w-0">
          <p className={`text-xs font-bold truncate ${selected ? info.text : "text-navy"}`}>{info.name}</p>
          <p className="text-xs text-slate/60 truncate">{info.tagline}</p>
        </div>
        {selected && <span className={`ml-auto text-xs font-bold ${info.text}`}>✓</span>}
      </button>
    );
  }

  return (
    <div className={`rounded-2xl border-2 ${info.border} ${info.bg} p-5`}>
      <div className="flex items-start gap-3 mb-4">
        <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${info.badge}`}>{level}</span>
        <div>
          <h3 className={`font-bold text-base ${info.text}`}>{info.name}</h3>
          <p className="text-sm text-slate/70">{info.tagline}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <EffortTag label="Effort" value={info.effort} />
        <EffortTag label="Controllo" value={info.control} />
      </div>

      <p className="text-sm text-slate-700 mb-4">{info.idealFor}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs font-bold text-green-700 mb-1">Pro</p>
          {info.pros.map((p) => (
            <p key={p} className="text-xs text-slate flex gap-1.5"><span className="text-green-500 shrink-0">+</span>{p}</p>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-red-600 mb-1">Contro</p>
          {info.cons.map((c) => (
            <p key={c} className="text-xs text-slate flex gap-1.5"><span className="text-red-400 shrink-0">−</span>{c}</p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {info.tools.map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/80 border border-current/20 font-medium text-slate-700">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ToolSelectionPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [locked, setLocked] = useState(false);

  const [answers, setAnswers] = useState<Record<number, "si" | "no">>({});
  const [activeQ, setActiveQ] = useState(1);
  const [result, setResult] = useState<ToolLevel | null>(null);

  const [primaryLevel, setPrimaryLevel] = useState<ToolLevel | null>(null);
  const [secondaryLevel, setSecondaryLevel] = useState<ToolLevel | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 4)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    const tc = s.toolChoice;
    if (tc.primaryLevel) {
      setPrimaryLevel(tc.primaryLevel);
      setSecondaryLevel(tc.secondaryLevel);
      setNotes(tc.notes);
      setResult(tc.primaryLevel);
      setActiveQ(0);
    }
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  const answer = (q: number, ans: "si" | "no") => {
    const { nextQ, result: newResult } = getNext(q, ans);
    setAnswers((prev) => ({ ...prev, [q]: ans }));
    if (newResult) {
      setResult(newResult);
      setPrimaryLevel(newResult);
      setActiveQ(0);
    } else {
      setActiveQ(nextQ);
    }
  };

  const reset = () => {
    setAnswers({});
    setActiveQ(1);
    setResult(null);
    setPrimaryLevel(null);
    setSecondaryLevel(null);
  };

  const save = () => {
    setState({ toolChoice: { primaryLevel, secondaryLevel, notes } });
    setSaved(true);
    setTimeout(() => router.push("/roadmap"), 400);
  };

  const comboKey = primaryLevel && secondaryLevel ? `${primaryLevel}+${secondaryLevel}` : null;
  const comboDesc = comboKey ? COMBOS[comboKey] : null;
  const otherLevels = (["A", "B", "C", "D", "E"] as ToolLevel[]).filter((l) => l !== primaryLevel);

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
    <div className="max-w-3xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-gold text-navy text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">4</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Scelta del Tool di Sviluppo</h1>
            <p className="text-sm text-slate">
              Matrice decisionale A–E
              {processName && <> · <strong className="text-navy">{processName}</strong></>}
            </p>
          </div>
        </div>
        {result && (
          <button onClick={reset} className="text-xs text-slate hover:text-navy border border-slate-200 rounded-lg px-3 py-1.5 hover:border-navy transition-colors">
            ↺ Ricomincia
          </button>
        )}
      </div>

      {/* Decision tree */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-navy/5 border-b border-slate-100">
          <span className="text-xs font-bold text-navy uppercase">Matrice Decisionale</span>
          <span className="ml-auto text-xs text-slate/50">Rispondi nell&apos;ordine indicato</span>
        </div>
        <div className="divide-y divide-slate-100">
          {QUESTIONS.map((q) => {
            const ans = answers[q.id];
            const isActive = activeQ === q.id;
            const isDone = ans !== undefined;
            const isSkipped = !isDone && !isActive && result !== null;

            if (isSkipped) return null;

            return (
              <div
                key={q.id}
                className={`px-4 py-3 transition-colors ${isActive ? "bg-primary/5" : isDone ? "" : "opacity-40"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isDone ? "bg-green-500 text-white" : isActive ? "bg-primary text-white" : "bg-slate-200 text-slate"
                  }`}>
                    {isDone ? "✓" : q.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isActive ? "text-navy" : isDone ? "text-slate-600" : "text-slate"}`}>
                      {q.text}
                    </p>
                    {isActive && <p className="text-xs text-slate/60 mt-0.5">{q.hint}</p>}
                    {isDone && (
                      <p className="text-xs mt-0.5">
                        <span className={ans === "si" ? "text-green-600 font-semibold" : "text-slate font-semibold"}>
                          {ans === "si" ? "Sì" : "No"}
                        </span>
                      </p>
                    )}
                  </div>
                  {isActive && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => answer(q.id, "si")}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-deepblue transition-colors"
                      >
                        Sì
                      </button>
                      <button
                        onClick={() => answer(q.id, "no")}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate hover:bg-slate-200 transition-colors border border-slate-200"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result */}
      {result && primaryLevel && (
        <>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold text-navy uppercase">Livello raccomandato</span>
          </div>
          <LevelCard level={primaryLevel} />

          {/* Secondary level */}
          <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm font-bold text-navy mb-1">Aggiungi un secondo livello?</p>
            <p className="text-xs text-slate mb-3">
              Nella maggior parte dei progetti enterprise si combinano due livelli
              {comboDesc && <> — <span className="font-semibold text-navy">{comboDesc}</span></>}.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
              {otherLevels.map((l) => (
                <LevelCard
                  key={l}
                  level={l}
                  compact
                  selected={secondaryLevel === l}
                  onClick={() => setSecondaryLevel(secondaryLevel === l ? null : l)}
                />
              ))}
            </div>
            {comboDesc && (
              <div className="flex items-start gap-2 p-2.5 bg-gold/10 border border-gold/30 rounded-lg">
                <span className="text-gold shrink-0 text-sm">★</span>
                <p className="text-xs text-navy font-medium">{comboDesc}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm font-bold text-navy mb-2">Note e motivazioni</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Perché hai scelto questo livello? Quali vincoli aziendali influenzano la scelta? Budget, skill, timeline..."
              className="w-full min-h-[80px] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-5">
            <a href="/prompt-lab" className="text-sm text-slate hover:text-navy">← Agentic Design Canvas</a>
            <button
              onClick={save}
              className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-navy text-white hover:bg-deepblue transition-colors"
            >
              {saved ? "✓ Salvato!" : "Salva e vai alla Roadmap →"}
            </button>
          </div>
        </>
      )}

      {/* All levels reference — shown before quiz is complete */}
      {!result && (
        <div className="mt-4 p-4 bg-navy/5 border border-navy/10 rounded-xl">
          <p className="text-xs font-bold text-navy uppercase mb-2">I 5 livelli della matrice</p>
          <div className="grid grid-cols-5 gap-2">
            {(["A", "B", "C", "D", "E"] as ToolLevel[]).map((l) => {
              const info = LEVELS[l];
              return (
                <div key={l} className={`rounded-lg border ${info.border} ${info.bg} p-2 text-center`}>
                  <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${info.badge} mb-1`}>{l}</span>
                  <p className={`text-xs font-semibold ${info.text} leading-tight`}>{info.name.split(" ")[0]}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate/50 mt-2">
            Pratica: nella maggior parte dei progetti enterprise si combinano due livelli (es. A+D per enterprise conversazionale, B+C per pipeline dati agentica).
          </p>
        </div>
      )}
    </div>
  );
}
