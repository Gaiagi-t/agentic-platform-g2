"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getState, setState } from "@/lib/store";
import type { AgenticDesign, AIAnalysis } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────

const TOOL_OPTIONS = [
  { id: "retrieval", label: "Retrieval / Web Search", desc: "Ricerca web, RAG su documenti" },
  { id: "code", label: "Code Execution", desc: "Python sandbox, calcoli, analisi dati" },
  { id: "automation", label: "Process Automation", desc: "Make.com, Zapier, n8n" },
  { id: "crm", label: "CRM / Database", desc: "Salesforce, HubSpot, SQL" },
  { id: "email", label: "Email / Calendar", desc: "Gmail, Outlook, Google Calendar" },
  { id: "iot", label: "IoT / Sensori", desc: "Sistemi fisici connessi" },
  { id: "api", label: "Custom API", desc: "Qualsiasi REST/GraphQL endpoint" },
];

const GUARDRAIL_OPTIONS = [
  { id: "rilevanza", label: "Classificatore rilevanza", desc: "Blocca input fuori perimetro" },
  { id: "sicurezza", label: "Classificatore sicurezza", desc: "Intercetta contenuti pericolosi" },
  { id: "pii", label: "Filtro PII", desc: "Maschera dati personali (GDPR)" },
  { id: "moderazione", label: "Moderazione contenuti", desc: "Policy violations" },
  { id: "tools", label: "Tool safeguards", desc: "Sandbox, rate limiting, autorizzazioni" },
  { id: "output", label: "Validazione output", desc: "Schema check, consistency check" },
];

const DEMO_DESIGN: AgenticDesign = {
  systemPrompt: `Sei un agente AI specializzato nella qualifica di lead B2B.

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
- Non usare gergo tecnico nel report finale`,
  tools: ["retrieval", "crm", "email"],
  toolsCustom: "LinkedIn API, Clearbit per arricchimento dati aziendali",
  mcpServers: "MCP Salesforce, MCP Google Search",
  memorySTM: "Conversazione attiva con il sales rep, risultati ricerca corrente sul prospect",
  memoryLTM: "Storico lead qualificati, Ideal Customer Profile aggiornato, playbook commerciale",
  guardrails: ["rilevanza", "pii", "output"],
  guardrailsCustom: "",
  hitlPoints: "Review del sales manager per score < 5 prima di aggiornare il CRM. Approvazione umana per lead enterprise (>1000 dipendenti).",
  flussiAuto: "Ricerca web dell'azienda, estrazione dati LinkedIn, popolamento campi CRM standard, invio summary email al rep.",
};

const emptyDesign = (): AgenticDesign => ({
  systemPrompt: "",
  tools: [],
  toolsCustom: "",
  mcpServers: "",
  memorySTM: "",
  memoryLTM: "",
  guardrails: [],
  guardrailsCustom: "",
  hitlPoints: "",
  flussiAuto: "",
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function welcomeMsg(processName: string, pattern: string): ChatMsg {
  return {
    role: "assistant",
    content: `Ciao! Sono qui per aiutarti a progettare l'agente AI per "${processName}" (pattern: ${pattern}).\n\nChiedimi qualsiasi cosa: system prompt, quali tools servono, come strutturare la memoria, quali guardrails attivare, dove mettere l'HITL. Oppure premi "Genera il system prompt" e lo costruisco io.`,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────

function ChatBubble({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <span>
      {content.split("\n").map((line, i) => (
        <span key={i}>{i > 0 && <br />}{line}</span>
      ))}
      {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-slate-400 ml-0.5 align-middle animate-pulse" />}
    </span>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-navy/5 border-b border-slate-100">
        <span className="text-xs font-bold text-white bg-navy w-5 h-5 rounded-full flex items-center justify-center shrink-0">{num}</span>
        <span className="text-sm font-bold text-navy">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function PromptLabPage() {
  const router = useRouter();
  const [processName, setProcessName] = useState("");
  const [pattern, setPattern] = useState("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [design, setDesign] = useState<AgenticDesign>(emptyDesign());
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Prompt generation
  const [generating, setGenerating] = useState(false);

  // Live prompt test
  const [showTest, setShowTest] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testResp, setTestResp] = useState("");
  const [testStreaming, setTestStreaming] = useState(false);
  const [testError, setTestError] = useState("");

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 3)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    const pat = s.mapping?.tobe?.pattern || "Single Agent";
    setPattern(pat);
    setAnalysis(s.mapping?.tobe || null);

    const d = s.agenticDesign;
    if (!d.systemPrompt && s.systemPrompt) {
      setDesign({ ...d, systemPrompt: s.systemPrompt });
    } else {
      setDesign(d);
    }

    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  useEffect(() => {
    if (processName && pattern && chatMsgs.length === 0) {
      setChatMsgs([welcomeMsg(processName, pattern)]);
    }
  }, [processName, pattern, chatMsgs.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const updateDesign = (patch: Partial<AgenticDesign>) => {
    setDesign((prev) => {
      const next = { ...prev, ...patch };
      setState({ agenticDesign: next, systemPrompt: next.systemPrompt });
      return next;
    });
  };

  const toggleTool = (id: string) => {
    const tools = design.tools.includes(id)
      ? design.tools.filter((t) => t !== id)
      : [...design.tools, id];
    updateDesign({ tools });
  };

  const toggleGuardrail = (id: string) => {
    const guardrails = design.guardrails.includes(id)
      ? design.guardrails.filter((g) => g !== id)
      : [...design.guardrails, id];
    updateDesign({ guardrails });
  };

  const sendChat = async (override?: string) => {
    const text = override ?? chatInput.trim();
    if (!text || chatStreaming) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMsgs = [...chatMsgs, userMsg];
    setChatMsgs(newMsgs);
    if (!override) setChatInput("");
    setChatStreaming(true);

    try {
      const res = await fetch("/api/agentic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.slice(-12),
          design,
          processName,
          analysis,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let aiContent = "";
      setChatMsgs((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiContent += decoder.decode(value, { stream: true });
        setChatMsgs((prev) => [...prev.slice(0, -1), { role: "assistant", content: aiContent }]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore di rete";
      setChatMsgs((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setChatStreaming(false);
    }
  };

  const generatePromptInline = async () => {
    if (!processName || generating) return;
    setGenerating(true);
    setDesign((prev) => ({ ...prev, systemPrompt: "" }));

    const msg = `Genera un system prompt completo e professionale per un agente AI che gestisce il processo "${processName}". Pattern: ${pattern}. Input: ${analysis?.input || "N/D"}. Output atteso: ${analysis?.output || "N/D"}. Autonomia: ${analysis?.autonomia || "N/D"}. Rispondi SOLO con il testo del system prompt, senza intestazioni o spiegazioni aggiuntive.`;

    try {
      const res = await fetch("/api/agentic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: msg }],
          design: { ...design, systemPrompt: "" },
          processName,
          analysis,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let generated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        generated += decoder.decode(value, { stream: true });
        setDesign((prev) => ({ ...prev, systemPrompt: generated }));
      }
      setState({ agenticDesign: { ...design, systemPrompt: generated }, systemPrompt: generated });
    } catch {
      // ignore generation errors silently
    } finally {
      setGenerating(false);
    }
  };

  const testPrompt = async () => {
    if (!testMsg.trim() || !design.systemPrompt.trim()) return;
    setTestStreaming(true);
    setTestResp("");
    setTestError("");
    try {
      const res = await fetch("/api/prompt-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: design.systemPrompt, testMessage: testMsg }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setTestResp((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setTestStreaming(false);
    }
  };

  const save = () => {
    setState({ agenticDesign: design, systemPrompt: design.systemPrompt });
    setSaved(true);
    setTimeout(() => router.push("/roadmap"), 400);
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
    <div className="w-full max-w-[1400px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-gold text-navy text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">3</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Agentic Design Canvas</h1>
            <p className="text-sm text-slate">
              Processo: <strong className="text-navy">{processName || "il processo selezionato"}</strong>
              {pattern && <> · Pattern: <strong className="text-teal">{pattern}</strong></>}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDesign(DEMO_DESIGN);
            setState({ agenticDesign: DEMO_DESIGN, systemPrompt: DEMO_DESIGN.systemPrompt });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors"
        >
          ⚡ Demo rapida
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ── Canvas column ── */}
        <div className="flex flex-col gap-4">

          {/* 1. System Prompt */}
          <Section num="1" title="System Prompt">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                onClick={generatePromptInline}
                disabled={generating || !processName}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40"
              >
                {generating ? <><span className="inline-block w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Generando...</> : "✨ Genera con AI"}
              </button>
              <button
                onClick={() => { setShowTest((v) => !v); setTestResp(""); setTestError(""); }}
                className="px-3 py-1.5 bg-teal/10 text-teal border border-teal/20 rounded-lg text-xs font-semibold hover:bg-teal/20 transition-colors"
              >
                {showTest ? "Chiudi test" : "🧪 Testa prompt"}
              </button>
              <span className="ml-auto text-xs text-slate">{design.systemPrompt.length} caratteri</span>
            </div>
            <textarea
              value={design.systemPrompt}
              onChange={(e) => updateDesign({ systemPrompt: e.target.value })}
              placeholder="Scrivi o genera il system prompt del tuo agente..."
              className="w-full min-h-[220px] border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono resize-y focus:outline-none focus:border-primary"
            />
            {showTest && (
              <div className="mt-3 border border-teal/20 rounded-xl bg-teal/5 p-3">
                <p className="text-xs font-semibold text-teal mb-2">Test live — verifica il comportamento del prompt</p>
                <div className="bg-white rounded-lg border border-slate-100 min-h-[80px] max-h-[200px] overflow-y-auto p-2.5 text-xs text-slate-700 mb-2 whitespace-pre-wrap font-mono">
                  {testResp || <span className="text-slate/40 italic">La risposta dell&apos;agente apparirà qui...</span>}
                  {testStreaming && <span className="inline-block w-1 h-3 bg-teal animate-pulse ml-0.5 align-middle" />}
                </div>
                {testError && <p className="text-xs text-red-600 mb-2">{testError}</p>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Messaggio di test..."
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !testStreaming && testPrompt()}
                    className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal"
                  />
                  <button
                    onClick={testPrompt}
                    disabled={testStreaming || !testMsg.trim() || !design.systemPrompt.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal text-white disabled:bg-slate-200 disabled:text-slate transition-colors"
                  >
                    {testStreaming ? "..." : "Testa"}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* 2. Tools & Connettori */}
          <Section num="2" title="Tools & Connettori">
            <p className="text-xs text-slate mb-3">Quali capacità ha bisogno il tuo agente per svolgere il lavoro?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {TOOL_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    design.tools.includes(opt.id)
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={design.tools.includes(opt.id)}
                    onChange={() => toggleTool(opt.id)}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-navy">{opt.label}</p>
                    <p className="text-xs text-slate/60">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <input
              type="text"
              placeholder="Altri tools specifici (es. Notion API, Stripe, custom webhook)..."
              value={design.toolsCustom}
              onChange={(e) => updateDesign({ toolsCustom: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Section>

          {/* 3. MCP */}
          <Section num="3" title="MCP — Model Context Protocol">
            <p className="text-xs text-slate mb-2">
              Il protocollo &quot;USB-C delle AI&quot;: standardizza la connessione tra modelli e sorgenti dati.
              Quali sorgenti esponi all&apos;agente via MCP?
            </p>
            <input
              type="text"
              placeholder="es. MCP Salesforce, MCP Google Drive, MCP Notion, MCP GitHub..."
              value={design.mcpServers}
              onChange={(e) => updateDesign({ mcpServers: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-slate/40 mt-1.5">Opzionale — si aggiunge come layer architetturale successivo.</p>
          </Section>

          {/* 4. Memoria */}
          <Section num="4" title="Strategia di Memoria">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-navy mb-0.5">STM — Short-Term Memory</p>
                <p className="text-xs text-slate/60 mb-2">Context window: conversazione attiva, output tool recenti</p>
                <textarea
                  value={design.memorySTM}
                  onChange={(e) => updateDesign({ memorySTM: e.target.value })}
                  placeholder="Cosa deve tenere in memoria durante la sessione corrente?"
                  className="w-full min-h-[80px] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-navy mb-0.5">LTM — Long-Term Memory</p>
                <p className="text-xs text-slate/60 mb-2">DB / Vector store / RAG: conoscenza persistente tra sessioni</p>
                <textarea
                  value={design.memoryLTM}
                  onChange={(e) => updateDesign({ memoryLTM: e.target.value })}
                  placeholder="Quali dati devono persistere tra sessioni diverse?"
                  className="w-full min-h-[80px] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </Section>

          {/* 5. Guardrails */}
          <Section num="5" title="Guardrails & Sicurezza">
            <p className="text-xs text-slate mb-3">Quali protezioni attivi per il tuo agente?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {GUARDRAIL_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    design.guardrails.includes(opt.id)
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={design.guardrails.includes(opt.id)}
                    onChange={() => toggleGuardrail(opt.id)}
                    className="mt-0.5 accent-amber-500 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-navy">{opt.label}</p>
                    <p className="text-xs text-slate/60">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <input
              type="text"
              placeholder="Guardrails specifici aggiuntivi..."
              value={design.guardrailsCustom}
              onChange={(e) => updateDesign({ guardrailsCustom: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </Section>

          {/* 6. HITL */}
          <Section num="6" title="HITL — Human In The Loop">
            <p className="text-xs text-slate mb-2">
              Dove il controllo umano è necessario? (approvazioni pre-azione, review output critico, escalation, soglie finanziarie)
            </p>
            <textarea
              value={design.hitlPoints}
              onChange={(e) => updateDesign({ hitlPoints: e.target.value })}
              placeholder="es. Approvazione manager prima di inviare email al cliente, review score < 5, escalation se confidence < 80%, approvazione per ordini > 1000€..."
              className="w-full min-h-[80px] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </Section>

          {/* 7. Flussi automatizzabili */}
          <Section num="7" title="Flussi Automatizzabili">
            <p className="text-xs text-slate mb-2">
              Quali sotto-task possono girare in autonomia completa, senza supervisione umana?
            </p>
            <textarea
              value={design.flussiAuto}
              onChange={(e) => updateDesign({ flussiAuto: e.target.value })}
              placeholder="es. Ricerca web, estrazione dati da documenti, popolamento CRM, invio notifiche interne, generazione report standard, log strutturati..."
              className="w-full min-h-[80px] border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </Section>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <a href="/mapping" className="text-sm text-slate hover:text-navy">← Mappatura</a>
            <button
              onClick={save}
              className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-navy text-white hover:bg-deepblue transition-colors"
            >
              {saved ? "✓ Salvato!" : "Salva e vai alla Roadmap →"}
            </button>
          </div>
        </div>

        {/* ── Chat column ── */}
        <div className="lg:sticky lg:top-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[500px] lg:max-h-[calc(100vh-5rem)]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
            <span className="w-2 h-2 rounded-full bg-teal shrink-0 animate-pulse" />
            <p className="text-sm font-bold text-navy">Advisor AI</p>
            <p className="text-xs text-slate ml-auto">Agentic Design Expert</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
            {chatMsgs.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-navy text-white rounded-tr-sm"
                      : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm"
                  }`}
                >
                  <ChatBubble
                    content={msg.content}
                    isStreaming={chatStreaming && i === chatMsgs.length - 1 && msg.role === "assistant"}
                  />
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 px-3 py-3 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Fai una domanda sull'agente..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !chatStreaming && sendChat()}
                disabled={chatStreaming}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal disabled:bg-slate-50"
              />
              <button
                onClick={() => sendChat()}
                disabled={chatStreaming || !chatInput.trim()}
                className="px-3 py-2 rounded-lg bg-teal text-white text-sm font-bold disabled:bg-slate-200 disabled:text-slate transition-colors"
              >
                {chatStreaming ? "·" : "→"}
              </button>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {["Genera il system prompt", "Quali tools mi servono?", "Spiegami i guardrails", "Come gestisco la memoria?"].map((q) => (
                <button
                  key={q}
                  onClick={() => sendChat(q)}
                  disabled={chatStreaming}
                  className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate hover:border-teal hover:text-teal transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
