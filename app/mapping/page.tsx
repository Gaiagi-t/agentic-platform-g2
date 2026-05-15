"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; [i: number]: SRAlternative }
interface SRResultList { length: number; [i: number]: SRResult }
interface SREvent extends Event { resultIndex: number; results: SRResultList }
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onresult: ((ev: SREvent) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { ASISStep, AIAnalysis, Mapping } from "@/lib/types";

const PATTERNS = ["Single Agent", "Routing", "Parallelizzazione", "Orchestrazione", "HITL by Design"];

const emptyStep = (): ASISStep => ({ nome: "", chi: "", strumenti: "", tempo: "" });

const DEMO_STEPS: ASISStep[] = [
  { nome: "Ricezione richiesta prospect", chi: "Sales Rep", strumenti: "Email", tempo: "5 min" },
  { nome: "Ricerca azienda su web e LinkedIn", chi: "Sales Rep", strumenti: "Google, LinkedIn", tempo: "45 min" },
  { nome: "Verifica budget e fit con ICP", chi: "Sales Rep", strumenti: "Spreadsheet manuale", tempo: "30 min" },
  { nome: "Compilazione scheda nel CRM", chi: "Sales Manager", strumenti: "Salesforce", tempo: "20 min" },
];

const DEMO_PAIN =
  "Troppo tempo su ricerche manuali ripetitive. Qualità dell'analisi variabile tra rep diversi. Dati dispersi tra email, fogli Excel e CRM. Tasso di aggiornamento CRM basso.";

const DEMO_ANALYSIS: AIAnalysis = {
  pattern: "Parallelizzazione",
  vision:
    "Un agente AI riceve il nome dell'azienda prospect, esegue in parallelo ricerca web, analisi LinkedIn e check CRM, e produce in 60 secondi una scheda strutturata con score di qualificazione e azione consigliata.",
  input: "Nome azienda, email/richiesta iniziale del prospect",
  output: "Scheda qualifica con score 1-10, executive summary, punti di forza, red flags e next action",
  autonomia: "Supervised",
  score: 8,
  rischi: [
    "Qualità dati web variabile per aziende piccole",
    "GDPR sulla raccolta automatica dati prospect",
    "Resistenza adoption dai sales rep senior",
  ],
  fattibilita:
    "Alta fattibilità tecnica: dati accessibili via web, pattern chiaro e ripetibile. Media complessità organizzativa per change management.",
  timeline: "2–3 mesi",
  quick_win:
    "Agente che ricerca automaticamente l'azienda su web e produce un 1-pager in 60 secondi tramite GPT-4o + Make.com",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function welcomeMessage(processName: string, analysis: AIAnalysis): ChatMsg {
  return {
    role: "assistant",
    content: `Ho generato la visione TO-BE per "${processName}": pattern ${analysis.pattern}, autonomia ${analysis.autonomia}, score ${analysis.score}/10.\n\nPuoi chiedermi di approfondire un aspetto, esplorare rischi, confrontare pattern alternativi o raffinare il quick win. Come vuoi procedere?`,
  };
}

// Minimal markdown renderer: bold + newlines
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

export default function MappingPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [steps, setSteps] = useState<ASISStep[]>([emptyStep()]);
  const [painPoints, setPainPoints] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  // Voice state
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalAccumulatedRef = useRef("");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  const checkSession = useCallback(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setLocked(d.step < 2))
      .catch(() => {});
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

  const toggleMic = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }

    const SR: (new () => SpeechRecognitionInstance) | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Il tuo browser non supporta il riconoscimento vocale.\nUsa Chrome o Edge per questa funzione.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;

    finalAccumulatedRef.current = chatInput;

    recognition.onresult = (event: SREvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalAccumulatedRef.current += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setChatInput(finalAccumulatedRef.current);
      setInterimText(interim);
    };

    recognition.onend = () => {
      setRecording(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setRecording(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
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
        <p className="text-slate text-sm">Il facilitatore aprirà questo step a breve. La pagina si aggiorna automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">2</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Mappatura AS-IS → TO-BE</h1>
            <p className="text-sm text-slate">
              Processo: <span className="font-semibold text-navy">{processName || "—"}</span>
            </p>
          </div>
        </div>
        <button
          onClick={loadDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors"
        >
          ⚡ Demo rapida
        </button>
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
                  <button
                    onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
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
          <button
            onClick={() => setSteps((prev) => [...prev, emptyStep()])}
            className="text-sm text-primary hover:text-deepblue font-medium self-start"
          >
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
            <span
              className={`ml-auto text-sm font-bold px-2 py-0.5 rounded-full ${
                analysis.score >= 7
                  ? "bg-green-100 text-green-700"
                  : analysis.score >= 5
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
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
                {PATTERNS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
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

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      {analysis && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 mb-5 overflow-hidden">
          {/* Toggle header */}
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
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
              {/* Message list */}
              <div
                ref={chatListRef}
                className="h-72 overflow-y-auto px-4 py-4 flex flex-col gap-3"
              >
                {chatMessages.map((msg, i) => {
                  const isLast = i === chatMessages.length - 1;
                  const isStreaming = isLast && msg.role === "assistant" && chatStreaming;
                  return (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <span className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs shrink-0 mr-2 mt-0.5">AI</span>
                      )}
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-navy text-white rounded-br-sm"
                            : "bg-slate-100 text-navy rounded-bl-sm"
                        }`}
                      >
                        {msg.content ? (
                          <ChatBubble content={msg.content} isStreaming={isStreaming} />
                        ) : (
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

              {/* Input area */}
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                {/* Recording indicator */}
                {recording && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                    <span className="text-xs text-red-600 font-medium">Registrazione in corso — clicca il microfono per fermare</span>
                  </div>
                )}
                {/* Interim transcript preview */}
                {interimText && (
                  <div className="text-xs text-slate italic mb-2 px-1">
                    <span className="opacity-60">&ldquo;{interimText}&rdquo;</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Mic button */}
                  <button
                    onClick={toggleMic}
                    title={recording ? "Clicca per fermare la registrazione" : "Clicca per iniziare a parlare"}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      recording
                        ? "bg-red-500 text-white shadow-md scale-110"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm-1 1.93V18H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.07A5.002 5.002 0 0017 11a1 1 0 00-2 0 3 3 0 01-6 0 1 1 0 00-2 0 5.002 5.002 0 004 4.93z" />
                    </svg>
                  </button>

                  {/* Text input */}
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    placeholder={recording ? "Parla ora…" : "Scrivi o usa il microfono…"}
                    disabled={chatStreaming}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white disabled:opacity-50"
                  />

                  {/* Send button */}
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim() || chatStreaming}
                    className="shrink-0 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-deepblue disabled:bg-slate-200 disabled:text-slate transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>

                {!recording && (
                  <p className="text-[10px] text-slate/40 mt-2 text-center">
                    Clicca il microfono per parlare · Clicca di nuovo per fermare · Invio per inviare
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <a href="/portfolio" className="text-sm text-slate hover:text-navy">
          ← Portfolio
        </a>
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
