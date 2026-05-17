"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getState, setState } from "@/lib/store";
import type { RoadmapPhase } from "@/lib/types";

const PHASES = [
  { key: "quickWin" as const, title: "Quick Win", horizon: "0–3 mesi", icon: "⚡", color: "border-teal", badge: "bg-teal/10 text-teal" },
  { key: "scale" as const, title: "Scale", horizon: "3–12 mesi", icon: "📈", color: "border-primary", badge: "bg-primary/10 text-primary" },
  { key: "transform" as const, title: "Transform", horizon: "12–24 mesi", icon: "🔮", color: "border-deepblue", badge: "bg-deepblue/10 text-deepblue" },
];

const FIELDS: { key: keyof RoadmapPhase; label: string; placeholder: string }[] = [
  { key: "chi", label: "Chi fa cosa", placeholder: "es. Team marketing con supporto IT..." },
  { key: "cosa", label: "Cosa si automatizza", placeholder: "es. Prima automazione del processo X..." },
  { key: "strumento", label: "Strumento / Piattaforma", placeholder: "es. Claude API, Make.com, n8n..." },
  { key: "kpi", label: "Come si misura il successo", placeholder: "es. -30% tempo su X, +20 lead/settimana..." },
];

const DEMO_ROADMAP = {
  quickWin: { chi: "Sales Rep + 1 dev part-time", cosa: "Agente che ricerca automaticamente l'azienda prospect e produce una scheda qualifica in 60 secondi", strumento: "Claude API + Make.com", kpi: "-70% tempo per lead, capacità da 30 a 100 qualifiche/settimana" },
  scale: { chi: "Team Sales + IT + RevOps", cosa: "Integrazione con Salesforce: l'agente aggiorna automaticamente il CRM dopo ogni qualifica", strumento: "Claude API + Salesforce API + n8n", kpi: "100% record CRM aggiornati, 0 data entry manuale" },
  transform: { chi: "CEO + Head of Sales + Product", cosa: "Modello SDR aumentato: ogni commerciale gestisce 3× il volume con l'AI come copilota continuativo", strumento: "Piattaforma custom su Claude Agent SDK", kpi: "CAC -40%, lead-to-opportunity rate +25%" },
};

const DEMO_COMMIT = "Entro il 20 giugno 2026 avrò testato un prototipo di agente Make.com + Claude che qualifica automaticamente 5 lead reali del nostro pipeline.";

type ChatMsg = { role: "user" | "assistant"; content: string };

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

export default function RoadmapPage() {
  const [processName, setProcessName] = useState("");
  const [roadmap, setRoadmap] = useState<Record<string, RoadmapPhase>>({
    quickWin: { chi: "", cosa: "", strumento: "", kpi: "" },
    scale: { chi: "", cosa: "", strumento: "", kpi: "" },
    transform: { chi: "", cosa: "", strumento: "", kpi: "" },
  });
  const [commit, setCommit] = useState("");
  const [exported, setExported] = useState(false);
  const [locked, setLocked] = useState(false);

  // Chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Full state snapshot for API calls
  const [stateSnap, setStateSnap] = useState<ReturnType<typeof getState> | null>(null);

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 5)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    setStateSnap(s);
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    setRoadmap(s.roadmap as Record<string, RoadmapPhase>);
    setCommit(s.commit30 || "");

    const pat = s.mapping?.tobe?.pattern || "Single Agent";
    const procName = proc?.name || "il processo";
    setChatMsgs([{
      role: "assistant",
      content: `Ciao! Ho accesso a tutto il lavoro che hai fatto: processo "${procName}", pattern ${pat}, canvas agentico e scelta del tool.\n\nSono qui per aiutarti a riempire le 3 fasi della roadmap con suggerimenti concreti. Dimmi da dove vuoi partire, oppure premi uno dei suggerimenti qui sotto.`,
    }]);

    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const update = (phase: string, field: keyof RoadmapPhase, val: string) => {
    setRoadmap((prev) => {
      const next = { ...prev, [phase]: { ...prev[phase], [field]: val } };
      setState({ roadmap: next as { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase } });
      return next;
    });
  };

  const sendChat = async (override?: string) => {
    const text = override ?? chatInput.trim();
    if (!text || chatStreaming || !stateSnap) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const newMsgs = [...chatMsgs, userMsg];
    setChatMsgs(newMsgs);
    if (!override) setChatInput("");
    setChatStreaming(true);

    const proc = stateSnap.processes.find((p) => p.id === stateSnap.selectedProcessId) ?? null;

    try {
      const res = await fetch("/api/roadmap-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.slice(-12),
          processName,
          process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null,
          analysis: stateSnap.mapping?.tobe ?? null,
          agenticDesign: stateSnap.agenticDesign,
          toolChoice: stateSnap.toolChoice,
          roadmap,
          commit,
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

  const loadDemo = () => {
    setRoadmap(DEMO_ROADMAP);
    setCommit(DEMO_COMMIT);
  };

  const save = () => setState({
    roadmap: roadmap as { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase },
    commit30: commit,
  });

  const exportPDF = async () => {
    save();
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const NAVY: [number, number, number] = [2, 31, 84];
    const TEAL: [number, number, number] = [37, 183, 211];
    let y = 0;

    const header = (title: string) => {
      doc.setFillColor(...NAVY); doc.rect(0, y, W, 18, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text("iFAB · Masterclass Agentic AI · Giornata 2", 10, y + 7);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(title, 10, y + 14);
      y += 24;
    };

    const section = (label: string) => {
      doc.setFillColor(...TEAL); doc.rect(10, y, W - 20, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), 14, y + 5); y += 10;
    };

    const row = (label: string, value: string) => {
      doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(label, 14, y); y += 4;
      doc.setTextColor(30, 41, 59); doc.setFontSize(10);
      const lines = doc.splitTextToSize(value || "—", W - 28);
      doc.text(lines, 14, y); y += lines.length * 5 + 4;
    };

    header(`Processo: ${proc?.name || "—"}`);
    section("Processo selezionato");
    row("Nome", proc?.name || ""); row("Descrizione", proc?.description || "");
    row("Impatto / Difficoltà", `${proc?.impatto === "alto" ? "Alto" : "Basso"} / ${proc?.facilita === "facile" ? "Facile" : "Difficile"}`);
    y += 4;

    if (s.mapping) {
      section("AS-IS — Passaggi principali");
      s.mapping.asis.steps.forEach((step, i) => {
        if (!step.nome) return;
        doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text(`Step ${i + 1}: ${step.nome}`, 14, y); y += 4;
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        if (step.chi) { doc.text(`Chi: ${step.chi}`, 18, y); y += 4; }
        if (step.strumenti) { doc.text(`Strumenti: ${step.strumenti}`, 18, y); y += 4; }
      });
      if (s.mapping.asis.painPoints) row("Pain points", s.mapping.asis.painPoints);
      y += 4;
      if (s.mapping.tobe) {
        section("TO-BE — Visione agentificata");
        row("Pattern agentico", s.mapping.tobe.pattern); row("Score fattibilità", `${s.mapping.tobe.score}/10`);
        row("Visione", s.mapping.tobe.vision); row("Input agente", s.mapping.tobe.input);
        row("Output agente", s.mapping.tobe.output); row("Timeline", s.mapping.tobe.timeline);
        row("Rischi", s.mapping.tobe.rischi.join(", "));
      }
    }

    doc.addPage(); y = 0;
    header("Agentic Design Canvas + Roadmap Sprint");
    section("System Prompt");
    if (s.systemPrompt) {
      doc.setTextColor(30, 41, 59); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(s.systemPrompt, W - 28).slice(0, 30);
      doc.text(lines, 14, y); y += lines.length * 4 + 4;
    }
    y += 4;

    PHASES.forEach((phase) => {
      section(`${phase.title} — ${phase.horizon}`);
      const p = roadmap[phase.key];
      row("Chi fa cosa", p.chi); row("Cosa si automatizza", p.cosa); row("Strumento", p.strumento); row("KPI", p.kpi);
      y += 2;
    });

    if (commit) { section("Il mio commit — prossimi 30 giorni"); row("Azione concreta", commit); }
    doc.save(`iFAB_Agentic_${(proc?.name || "Roadmap").replace(/\s+/g, "_")}.pdf`);
    setExported(true); setTimeout(() => setExported(false), 3000);
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
          <span className="bg-deepblue text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">5</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Roadmap Sprint</h1>
            <p className="text-sm text-slate">Processo: <span className="font-semibold text-navy">{processName || "—"}</span></p>
          </div>
        </div>
        <button onClick={loadDemo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors">
          ⚡ Demo rapida
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ── Roadmap column ── */}
        <div className="flex flex-col gap-4">
          {PHASES.map((phase) => (
            <div key={phase.key} className={`bg-white rounded-xl shadow-sm border-l-4 ${phase.color} border border-slate-200 p-5`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{phase.icon}</span>
                <div>
                  <p className="font-bold text-navy">{phase.title}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${phase.badge}`}>{phase.horizon}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className={f.key === "cosa" ? "sm:col-span-2" : ""}>
                    <label className="text-xs font-bold text-slate uppercase block mb-1">{f.label}</label>
                    <input
                      value={roadmap[phase.key]?.[f.key] || ""}
                      onChange={(e) => update(phase.key, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Commit */}
          <div className="bg-navy rounded-xl p-5">
            <h2 className="font-bold text-white mb-1">Il mio commit — prossimi 30 giorni</h2>
            <p className="text-white/60 text-xs mb-3">Una sola azione concreta e misurabile. Non &quot;esplorare&quot;, non &quot;valutare&quot;.</p>
            <input
              value={commit}
              onChange={(e) => setCommit(e.target.value)}
              placeholder="Entro il [data] avrò [azione specifica e misurabile]..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-teal"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1">
            <a href="/tool-selection" className="text-sm text-slate hover:text-navy">← Scelta del Tool</a>
            <div className="flex gap-3">
              <button onClick={save} className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 text-navy hover:bg-slate-200 transition-colors border border-slate-200">
                Salva
              </button>
              <button
                onClick={exportPDF}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${exported ? "bg-green-500 text-white" : "bg-navy text-white hover:bg-deepblue"}`}
              >
                {exported ? "PDF scaricato!" : "Esporta PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Chat column ── */}
        <div className="lg:sticky lg:top-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[500px] lg:max-h-[calc(100vh-5rem)]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
            <span className="w-2 h-2 rounded-full bg-deepblue shrink-0 animate-pulse" />
            <p className="text-sm font-bold text-navy">Advisor AI</p>
            <p className="text-xs text-slate ml-auto">Roadmap Strategist</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
            {chatMsgs.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-navy text-white rounded-tr-sm"
                    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm"
                }`}>
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
                placeholder="Chiedi un suggerimento..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !chatStreaming && sendChat()}
                disabled={chatStreaming}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-deepblue disabled:bg-slate-50"
              />
              <button
                onClick={() => sendChat()}
                disabled={chatStreaming || !chatInput.trim()}
                className="px-3 py-2 rounded-lg bg-deepblue text-white text-sm font-bold disabled:bg-slate-200 disabled:text-slate transition-colors"
              >
                {chatStreaming ? "·" : "→"}
              </button>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[
                "Suggerisci il Quick Win",
                "Chi coinvolgere?",
                "Quali KPI misurare?",
                "Aiutami con il commit 30 giorni",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendChat(q)}
                  disabled={chatStreaming}
                  className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate hover:border-deepblue hover:text-deepblue transition-colors disabled:opacity-40"
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
