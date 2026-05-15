"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { ASISStep, AIAnalysis, Mapping } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────
const PATTERNS = ["Single Agent", "Routing", "Parallelizzazione", "Orchestrazione", "HITL by Design"];
const emptyStep = (): ASISStep => ({ nome: "", chi: "", strumenti: "", tempo: "" });

const DEMO_STEPS: ASISStep[] = [
  { nome: "Ricezione richiesta prospect", chi: "Sales Rep", strumenti: "Email", tempo: "5 min" },
  { nome: "Ricerca azienda su web e LinkedIn", chi: "Sales Rep", strumenti: "Google, LinkedIn", tempo: "45 min" },
  { nome: "Verifica budget e fit con ICP", chi: "Sales Rep", strumenti: "Spreadsheet manuale", tempo: "30 min" },
  { nome: "Compilazione scheda nel CRM", chi: "Sales Manager", strumenti: "Salesforce", tempo: "20 min" },
];
const DEMO_PAIN = "Troppo tempo su ricerche manuali ripetitive. Qualità dell'analisi variabile tra rep diversi. Dati dispersi tra email, fogli Excel e CRM. Tasso di aggiornamento CRM basso.";
const DEMO_ANALYSIS: AIAnalysis = {
  pattern: "Parallelizzazione",
  vision: "Un agente AI riceve il nome dell'azienda prospect, esegue in parallelo ricerca web, analisi LinkedIn e check CRM, e produce in 60 secondi una scheda strutturata con score di qualificazione e azione consigliata.",
  input: "Nome azienda, email/richiesta iniziale del prospect",
  output: "Scheda qualifica con score 1-10, executive summary, punti di forza, red flags e next action",
  autonomia: "Supervised",
  approccio: "Augmentation",
  score: 8,
  rischi: ["Qualità dati web variabile per aziende piccole", "GDPR sulla raccolta automatica dati prospect", "Resistenza adoption dai sales rep senior"],
  fattibilita: "Alta fattibilità tecnica: dati accessibili via web, pattern chiaro e ripetibile. Media complessità organizzativa per change management.",
  timeline: "2–3 mesi",
  quick_win: "Agente che ricerca automaticamente l'azienda su web e produce un 1-pager in 60 secondi tramite GPT-4o + Make.com",
  confronto: [
    { dimensione: "Ruolo / Responsabilità", asis: "Sales rep ricerca e compila manualmente ogni lead", tobe: "Agente esegue la ricerca, rep valida e approva il risultato" },
    { dimensione: "Strumenti", asis: "Google, LinkedIn, Salesforce, fogli Excel", tobe: "AI agent + Make.com + Salesforce auto-popolato" },
    { dimensione: "Velocità / Efficienza", asis: "90 minuti per lead", tobe: "60 secondi per lead" },
    { dimensione: "Qualità / Precisione", asis: "Variabile, dipende dall'esperienza del singolo rep", tobe: "Consistente, basata su dati strutturati e aggiornati" },
    { dimensione: "Carico di lavoro", asis: "Alto, ripetitivo, low-value per i rep", tobe: "Ridotto: il rep si concentra su relazione e chiusura" },
  ],
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function welcomeMessage(processName: string, analysis: AIAnalysis): ChatMsg {
  return {
    role: "assistant",
    content: `Ho generato la visione TO-BE per "${processName}": pattern ${analysis.pattern}, autonomia ${analysis.autonomia}, score ${analysis.score}/10.\n\nPuoi chiedermi di approfondire un aspetto, esplorare rischi, confrontare pattern alternativi o raffinare il quick win. Come vuoi procedere?`,
  };
}

// ── Chat bubble renderer ───────────────────────────────────────────────
function ChatBubble({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const parts = content.split(/(\*\*[^*]+\*\*|✏️[^\n]+)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("✏️"))
          return <span key={i} className="block mt-1 text-primary font-medium">{part}</span>;
        return part.split("\n").map((line, j) => (
          <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
        ));
      })}
      {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-slate-400 ml-0.5 align-middle animate-pulse" />}
    </span>
  );
}

// ── Mic button ─────────────────────────────────────────────────────────
function MicBtn({
  active, loading, onClick, size = "sm",
}: {
  active: boolean; loading: boolean; onClick: () => void; size?: "sm" | "md";
}) {
  const sz = size === "md" ? "w-9 h-9" : "w-7 h-7";
  const ico = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <button
      type="button"
      onClick={onClick}
      title={loading ? "Trascrizione in corso…" : active ? "Clicca per fermare e trascrivere" : "Clicca per registrare"}
      className={`shrink-0 ${sz} rounded-full flex items-center justify-center transition-all ${
        loading
          ? "bg-primary/20 text-primary cursor-wait"
          : active
          ? "bg-red-500 text-white shadow-sm animate-pulse"
          : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
      }`}
    >
      {loading ? (
        <svg className={`${ico} animate-spin`} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className={ico}>
          <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm-1 1.93V18H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A5.002 5.002 0 0017 11a1 1 0 00-2 0 3 3 0 01-6 0 1 1 0 00-2 0 5.002 5.002 0 004 4.93z" />
        </svg>
      )}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function MappingPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [steps, setSteps] = useState<ASISStep[]>([emptyStep()]);
  const [painPoints, setPainPoints] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Voice — MediaRecorder + Whisper
  const [recordingField, setRecordingField] = useState<string | null>(null);
  const [transcribingField, setTranscribingField] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const setValueRef      = useRef<((v: string) => void) | null>(null);
  const initialValueRef  = useRef(""); // field value at recording start

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 2)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    if (s.mapping?.processId === s.selectedProcessId) {
      setSteps(s.mapping.asis.steps.length ? s.mapping.asis.steps : [emptyStep()]);
      setPainPoints(s.mapping.asis.painPoints || "");
      if (s.mapping.tobe) {
        setAnalysis(s.mapping.tobe);
        setChatMessages([welcomeMessage(proc?.name || "", s.mapping.tobe)]);
      }
    }
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Mic: MediaRecorder + Whisper ────────────────────────────────────
  const stopAndTranscribe = (fieldId: string) => {
    mediaRecorderRef.current?.stop(); // triggers onstop → sends to Whisper
    setRecordingField(null);
    setTranscribingField(fieldId);
  };

  const toggleMic = async (fieldId: string, currentValue: string, setValue: (v: string) => void) => {
    // Stop active recording (same or different field)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopAndTranscribe(recordingField ?? fieldId);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported format — Whisper accepts webm, ogg, mp4
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      setValueRef.current = setValue;
      initialValueRef.current = currentValue;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        const actualMime = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        const formData = new FormData();
        formData.append("audio", blob, `recording.${ext}`);

        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) {
            const base = initialValueRef.current?.trim();
            const full = base ? base + " " + data.text : data.text;
            setValueRef.current?.(full.trim());
          }
        } catch {
          // transcription failed silently — field unchanged
        } finally {
          setTranscribingField(null);
          mediaRecorderRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setRecordingField(fieldId);
      mediaRecorder.start();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("denied") || msg.includes("NotAllowed")) {
        alert("Permesso microfono negato.\nVai nelle impostazioni del browser e consenti l'accesso al microfono per questo sito.");
      } else if (msg.includes("NotFound") || msg.includes("Requested device not found")) {
        alert("Nessun microfono trovato.\nCollega un microfono e riprova.");
      } else {
        alert("Non riesco ad accedere al microfono.\nAssicurati di usare HTTPS e di aver consentito l'accesso al microfono.");
      }
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────
  const updateStep = (i: number, field: keyof ASISStep, val: string) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));

  const loadDemo = () => {
    setSteps(DEMO_STEPS);
    setPainPoints(DEMO_PAIN);
    setAnalysis(DEMO_ANALYSIS);
    setChatMessages([welcomeMessage(processName || "Qualifica Lead", DEMO_ANALYSIS)]);
    setChatOpen(true);
  };

  const analyse = async () => {
    setLoading(true);
    setError("");
    try {
      const s = getState();
      const proc = s.processes.find((p) => p.id === s.selectedProcessId);
      const res = await fetch("/api/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName, processDescription: proc?.description || "", steps, painPoints }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result: AIAnalysis = await res.json();
      setAnalysis(result);
      setChatMessages([welcomeMessage(processName, result)]);
      setChatOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatStreaming) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const history = [...chatMessages, userMsg];
    setChatMessages([...history, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatStreaming(true);
    try {
      const res = await fetch("/api/mapping-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, analysis, processName, steps, painPoints }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setChatMessages([...history, { role: "assistant", content: full }]);
      }
    } catch {
      setChatMessages([...history, { role: "assistant", content: "Si è verificato un errore. Riprova." }]);
    } finally {
      setChatStreaming(false);
    }
  };

  const save = () => {
    const s = getState();
    const mapping: Mapping = { processId: s.selectedProcessId || "", asis: { steps, painPoints }, tobe: analysis };
    setState({ mapping });
    router.push("/prompt-lab");
  };

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-navy mb-2">Step non ancora aperto</h2>
        <p className="text-slate text-sm">Il facilitatore aprirà questo step a breve.</p>
      </div>
    );
  }

  const isRec  = (id: string) => recordingField === id;
  const isLoad = (id: string) => transcribingField === id;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">2</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Mappatura AS-IS → TO-BE</h1>
            <p className="text-sm text-slate">Processo: <span className="font-semibold text-navy">{processName || "—"}</span></p>
          </div>
        </div>
        <button onClick={loadDemo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors">
          ⚡ Demo rapida
        </button>
      </div>

      {/* Recording / transcribing status bar */}
      {(recordingField || transcribingField) && (
        <div className={`flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${recordingField ? "bg-red-50 border border-red-200 text-red-700" : "bg-primary/5 border border-primary/20 text-primary"}`}>
          {recordingField ? (
            <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />Registrazione in corso — clicca il microfono rosso per fermare e trascrivere</>
          ) : (
            <><svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Whisper sta trascrivendo…</>
          )}
        </div>
      )}

      {/* ── AS-IS ───────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <h2 className="font-bold text-navy mb-1">AS-IS — Come funziona oggi</h2>
        <p className="text-xs text-slate mb-4">Aggiungi i passaggi principali del processo attuale</p>

        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className={`border rounded-lg p-3 bg-slate-50 transition-colors ${isRec(`step-${i}-nome`) ? "border-red-200 bg-red-50/30" : "border-slate-100"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate uppercase">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-red-400 hover:text-red-600">Rimuovi</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 flex items-center gap-1.5">
                  <input
                    placeholder="Nome del passaggio"
                    value={step.nome}
                    onChange={(e) => updateStep(i, "nome", e.target.value)}
                    className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <MicBtn active={isRec(`step-${i}-nome`)} loading={isLoad(`step-${i}-nome`)} onClick={() => toggleMic(`step-${i}-nome`, step.nome, (v) => updateStep(i, "nome", v))} />
                </div>
                <input placeholder="Chi esegue" value={step.chi} onChange={(e) => updateStep(i, "chi", e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
                <input placeholder="Strumenti usati" value={step.strumenti} onChange={(e) => updateStep(i, "strumenti", e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
                <input placeholder="Tempo stimato" value={step.tempo} onChange={(e) => updateStep(i, "tempo", e.target.value)} className="border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
          ))}
          <button onClick={() => setSteps((prev) => [...prev, emptyStep()])} className="text-sm text-primary hover:text-deepblue font-medium self-start">
            + Aggiungi step
          </button>
        </div>

        {/* Pain points */}
        <div className="mt-4">
          <label className="text-xs font-bold text-slate uppercase block mb-1">Pain points principali</label>
          <div className="flex items-start gap-1.5">
            <textarea
              placeholder="Cosa non funziona? Dove si perde tempo? Quali errori si ripetono?"
              value={painPoints}
              onChange={(e) => setPainPoints(e.target.value)}
              rows={3}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary transition-colors ${isRec("painPoints") ? "border-red-300 bg-red-50/30" : "border-slate-200"}`}
            />
            <MicBtn active={isRec("painPoints")} loading={isLoad("painPoints")} onClick={() => toggleMic("painPoints", painPoints, setPainPoints)} />
          </div>
        </div>

        <button
          onClick={analyse}
          disabled={loading || steps.every((s) => !s.nome.trim())}
          className={`mt-4 w-full py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${loading || steps.every((s) => !s.nome.trim()) ? "bg-slate-200 text-slate cursor-not-allowed" : "bg-teal text-white hover:bg-deepblue"}`}
        >
          {loading ? (<><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analisi in corso...</>) : "Analizza con AI →"}
        </button>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </section>

      {/* ── TO-BE ───────────────────────────────────────────────────── */}
      {analysis && (
        <section className="bg-white rounded-xl shadow-sm border border-primary/30 p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-teal/10 text-teal text-xs font-bold px-2 py-0.5 rounded">TO-BE — Visione agentificata</span>
            <span className={`ml-auto text-sm font-bold px-2 py-0.5 rounded-full ${analysis.score >= 7 ? "bg-green-100 text-green-700" : analysis.score >= 5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>Score: {analysis.score}/10</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Pattern agentico</p>
              <select value={analysis.pattern} onChange={(e) => setAnalysis({ ...analysis, pattern: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary">
                {PATTERNS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Livello autonomia</p>
              <input value={analysis.autonomia} onChange={(e) => setAnalysis({ ...analysis, autonomia: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* Approccio toggle */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate uppercase mb-2">Approccio</p>
            <div className="flex gap-2">
              {(["Sostituzione", "Augmentation"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnalysis({ ...analysis, approccio: opt })}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    analysis.approccio === opt
                      ? opt === "Sostituzione"
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-teal border-teal text-white"
                      : "bg-white border-slate-200 text-slate hover:border-primary"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {analysis.approccio === "Sostituzione" && (
              <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-800">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>Per un primo pilota considera <strong>Augmentation</strong>: l&apos;AI affianca il team senza sostituirlo, riducendo i rischi di adoption e permettendo correzioni in corsa.</span>
              </div>
            )}
          </div>

          {/* Vision — mic */}
          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Visione TO-BE</p>
            <div className="flex items-start gap-1.5">
              <textarea value={analysis.vision} onChange={(e) => setAnalysis({ ...analysis, vision: e.target.value })} rows={2}
                className={`flex-1 border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:border-primary transition-colors ${isRec("tobe-vision") ? "border-red-300 bg-red-50/30" : "border-slate-200"}`} />
              <MicBtn active={isRec("tobe-vision")} loading={isLoad("tobe-vision")} onClick={() => toggleMic("tobe-vision", analysis.vision, (v) => setAnalysis((a) => a ? { ...a, vision: v } : a))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Input agente</p>
              <input value={analysis.input} onChange={(e) => setAnalysis({ ...analysis, input: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Output agente</p>
              <input value={analysis.output} onChange={(e) => setAnalysis({ ...analysis, output: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* Fattibilità — mic */}
          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Fattibilità</p>
            <div className="flex items-start gap-1.5">
              <textarea value={analysis.fattibilita} onChange={(e) => setAnalysis({ ...analysis, fattibilita: e.target.value })} rows={2}
                className={`flex-1 border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:border-primary transition-colors ${isRec("tobe-fatt") ? "border-red-300 bg-red-50/30" : "border-slate-200"}`} />
              <MicBtn active={isRec("tobe-fatt")} loading={isLoad("tobe-fatt")} onClick={() => toggleMic("tobe-fatt", analysis.fattibilita, (v) => setAnalysis((a) => a ? { ...a, fattibilita: v } : a))} />
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs font-bold text-slate uppercase mb-1">Rischi principali</p>
            <div className="flex flex-col gap-1">
              {analysis.rischi.map((r, i) => (
                <input key={i} value={r} onChange={(e) => { const u = [...analysis.rischi]; u[i] = e.target.value; setAnalysis({ ...analysis, rischi: u }); }} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Timeline stimata</p>
              <input value={analysis.timeline} onChange={(e) => setAnalysis({ ...analysis, timeline: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate uppercase mb-1">Quick Win suggerito</p>
              <input value={analysis.quick_win} onChange={(e) => setAnalysis({ ...analysis, quick_win: e.target.value })} className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
        </section>
      )}

      {/* ── Confronto AS-IS → TO-BE ─────────────────────────────────── */}
      {analysis && analysis.confronto && analysis.confronto.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
          <h2 className="font-bold text-navy mb-1">Confronto AS-IS → TO-BE</h2>
          <p className="text-xs text-slate mb-4">Come cambia il processo con l&apos;AI — le celle sono modificabili</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left text-xs font-bold text-slate uppercase pb-2 pr-3 w-[26%]">Dimensione</th>
                  <th className="text-left text-xs font-bold text-slate uppercase pb-2 px-3 w-[37%]">AS-IS</th>
                  <th className="text-left text-xs font-bold text-teal uppercase pb-2 pl-3 w-[37%]">TO-BE con AI</th>
                </tr>
              </thead>
              <tbody>
                {analysis.confronto.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-semibold text-navy text-xs align-top pt-3">{row.dimensione}</td>
                    <td className="py-1.5 px-3">
                      <textarea
                        value={row.asis}
                        onChange={(e) => {
                          const updated = [...analysis.confronto];
                          updated[i] = { ...updated[i], asis: e.target.value };
                          setAnalysis({ ...analysis, confronto: updated });
                        }}
                        rows={2}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:border-primary"
                      />
                    </td>
                    <td className="py-1.5 pl-3">
                      <textarea
                        value={row.tobe}
                        onChange={(e) => {
                          const updated = [...analysis.confronto];
                          updated[i] = { ...updated[i], tobe: e.target.value };
                          setAnalysis({ ...analysis, confronto: updated });
                        }}
                        rows={2}
                        className="w-full border border-teal/30 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:border-teal bg-teal/5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      {analysis && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 mb-5 overflow-hidden">
          <button onClick={() => setChatOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center text-base">💬</span>
              <div className="text-left">
                <span className="font-semibold text-navy text-sm block leading-tight">Affina con l&apos;AI</span>
                <span className="text-[11px] text-slate">Conversa per approfondire e modificare la visione TO-BE</span>
              </div>
            </div>
            <span className="text-slate/40 text-lg">{chatOpen ? "∧" : "∨"}</span>
          </button>

          {chatOpen && (
            <div className="border-t border-slate-100">
              <div className="h-72 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                {chatMessages.map((msg, i) => {
                  const isLast = i === chatMessages.length - 1;
                  const isStreaming = isLast && msg.role === "assistant" && chatStreaming;
                  return (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5">AI</span>}
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-navy text-white rounded-br-sm" : "bg-slate-100 text-navy rounded-bl-sm"}`}>
                        {msg.content ? <ChatBubble content={msg.content} isStreaming={isStreaming} /> : (
                          <span className="flex gap-1 py-0.5">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <MicBtn size="md" active={isRec("chat")} loading={isLoad("chat")} onClick={() => toggleMic("chat", chatInput, setChatInput)} />
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={isRec("chat") ? "Registrazione in corso… clicca 🎤 per fermare" : "Scrivi o usa il microfono…"}
                    disabled={chatStreaming}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white disabled:opacity-50"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim() || chatStreaming}
                    className="shrink-0 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-deepblue disabled:bg-slate-200 disabled:text-slate transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-slate/40 mt-2 text-center">
                  Clicca 🎤 per parlare · Clicca di nuovo per fermare · Whisper trascrive · Invio per inviare
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <a href="/portfolio" className="text-sm text-slate hover:text-navy">← Portfolio</a>
        <button onClick={save} disabled={!analysis} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${analysis ? "bg-navy text-white hover:bg-deepblue" : "bg-slate-200 text-slate cursor-not-allowed"}`}>
          Salva e vai al Prompt Lab →
        </button>
      </div>
    </div>
  );
}
