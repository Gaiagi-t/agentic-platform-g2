"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function RoadmapPage() {
  const [processName, setProcessName] = useState("");
  const [roadmap, setRoadmap] = useState<Record<string, RoadmapPhase>>({ quickWin: { chi: "", cosa: "", strumento: "", kpi: "" }, scale: { chi: "", cosa: "", strumento: "", kpi: "" }, transform: { chi: "", cosa: "", strumento: "", kpi: "" } });
  const [commit, setCommit] = useState("");
  const [exported, setExported] = useState(false);
  const [locked, setLocked] = useState(false);

  const checkSession = useCallback(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setLocked(d.step < 5)).catch(() => {});
  }, []);

  useEffect(() => {
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId);
    if (proc) setProcessName(proc.name);
    setRoadmap(s.roadmap as Record<string, RoadmapPhase>);
    setCommit(s.commit30 || "");
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  const update = (phase: string, field: keyof RoadmapPhase, val: string) =>
    setRoadmap((prev) => ({ ...prev, [phase]: { ...prev[phase], [field]: val } }));

  const loadDemo = () => {
    setRoadmap(DEMO_ROADMAP);
    setCommit(DEMO_COMMIT);
  };

  const save = () => setState({ roadmap: roadmap as { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase }, commit30: commit });

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
    header("System Prompt + Roadmap Sprint");
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
    <div className="max-w-3xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-deepblue text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">5</span>
          <div>
            <h1 className="text-xl font-bold text-navy">Roadmap Sprint</h1>
            <p className="text-sm text-slate">Processo: <span className="font-semibold text-navy">{processName || "—"}</span></p>
          </div>
        </div>
        <button onClick={loadDemo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 text-navy border border-gold/40 text-xs font-semibold hover:bg-gold/30 transition-colors">
          ⚡ Demo rapida
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
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
                  <input value={roadmap[phase.key]?.[f.key] || ""} onChange={(e) => update(phase.key, f.key, e.target.value)} placeholder={f.placeholder} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-navy rounded-xl p-5 mb-6">
        <h2 className="font-bold text-white mb-1">Il mio commit — prossimi 30 giorni</h2>
        <p className="text-white/60 text-xs mb-3">Una sola azione concreta e misurabile. Non &quot;esplorare&quot;, non &quot;valutare&quot;.</p>
        <input value={commit} onChange={(e) => setCommit(e.target.value)} placeholder="Entro il [data] avrò [azione specifica e misurabile]..." className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-teal" />
      </div>

      <div className="flex items-center justify-between">
        <a href="/prompt-lab" className="text-sm text-slate hover:text-navy">← Prompt Lab</a>
        <div className="flex gap-3">
          <button onClick={save} className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 text-navy hover:bg-slate-200 transition-colors border border-slate-200">Salva</button>
          <button onClick={exportPDF} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${exported ? "bg-green-500 text-white" : "bg-navy text-white hover:bg-deepblue"}`}>
            {exported ? "PDF scaricato!" : "Esporta PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
