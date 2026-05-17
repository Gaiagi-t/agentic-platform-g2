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

// ─── Guide renderer helpers ───────────────────────────────────────────────────

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="font-semibold text-navy">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="bg-slate-100 text-primary text-xs px-1 py-0.5 rounded font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderLine(line: string, key: number) {
  if (line.startsWith("## ")) {
    return (
      <h2 key={key} className="text-navy font-bold text-base mt-7 mb-3 border-b-2 border-teal/30 pb-2 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-teal rounded-full shrink-0" />
        {line.slice(3)}
      </h2>
    );
  }
  if (line.startsWith("### ")) {
    return <h3 key={key} className="text-primary font-semibold text-sm mt-5 mb-1.5">{line.slice(4)}</h3>;
  }
  const numMatch = line.match(/^(\d+)\.\s+(.*)/);
  if (numMatch) {
    return (
      <div key={key} className="flex gap-3 my-2.5 items-start">
        <span className="bg-teal text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">{numMatch[1]}</span>
        <span className="text-sm text-slate-700 flex-1 leading-relaxed">{renderInline(numMatch[2])}</span>
      </div>
    );
  }
  if (line.startsWith("- ") || line.startsWith("* ")) {
    return (
      <div key={key} className="flex gap-2.5 my-1.5 items-start ml-2">
        <span className="text-teal font-bold text-xs shrink-0 mt-1">▸</span>
        <span className="text-sm text-slate-700 leading-relaxed">{renderInline(line.slice(2))}</span>
      </div>
    );
  }
  if (line.trim() === "") return <div key={key} className="h-2" />;
  return <p key={key} className="text-sm text-slate-700 my-1 leading-relaxed">{renderInline(line)}</p>;
}

function GuideRenderer({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const parts: Array<{ type: "text" | "code"; text: string }> = [];
  let remaining = content;

  while (remaining.length > 0) {
    const start = remaining.indexOf("```");
    if (start === -1) { parts.push({ type: "text", text: remaining }); break; }
    if (start > 0) parts.push({ type: "text", text: remaining.slice(0, start) });
    const end = remaining.indexOf("```", start + 3);
    if (end === -1) {
      parts.push({ type: "code", text: remaining.slice(start + 3).replace(/^\w*\n/, "") });
      break;
    }
    parts.push({ type: "code", text: remaining.slice(start + 3, end).replace(/^\w*\n/, "") });
    remaining = remaining.slice(end + 3);
  }

  return (
    <div>
      {parts.map((part, pi) =>
        part.type === "code" ? (
          <pre key={pi} className="bg-slate-900 text-emerald-300 text-xs p-4 rounded-xl overflow-x-auto my-4 font-mono leading-relaxed">
            {part.text}
          </pre>
        ) : (
          <div key={pi}>
            {part.text.split("\n").map((line, li) => renderLine(line, li))}
          </div>
        )
      )}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 bg-teal ml-0.5 align-middle animate-pulse" />
      )}
    </div>
  );
}

// ─── Radar / PDF helpers ──────────────────────────────────────────────────────

function computeRadarScores(s: ReturnType<typeof getState>): number[] {
  const tobe = s.mapping?.tobe;
  const proc = s.processes.find((p) => p.id === s.selectedProcessId);
  const design = s.agenticDesign;
  const tc = s.toolChoice;

  const fattibilita = Math.min(10, Math.max(0, tobe?.score ?? 5));
  const impatto = proc?.impatto === "alto"
    ? Math.min(10, (tobe?.score ?? 5) * 0.5 + 5)
    : Math.min(10, (tobe?.score ?? 5) * 0.4 + 3);
  const speedBase: Record<string, number> = { A: 7.5, B: 8.5, C: 5.0, D: 6.0 };
  let velocita = speedBase[tc.primaryLevel ?? ""] ?? 5;
  if (s.roadmap.quickWin.strumento) velocita = Math.min(10, velocita + 0.5);
  let governance = design.guardrails.length * 1.5;
  if (design.hitlPoints) governance += 2;
  if (tc.primaryLevel === "A") governance += 1.5;
  governance = Math.min(10, Math.max(1, governance));
  const keyFields = [
    proc?.name, proc?.description, s.mapping?.asis.steps[0]?.nome,
    tobe?.vision, tobe?.pattern, design.systemPrompt, tc.primaryLevel,
    s.roadmap.quickWin.chi, s.roadmap.quickWin.cosa, s.roadmap.quickWin.strumento, s.roadmap.quickWin.kpi,
    s.roadmap.scale.chi, s.roadmap.scale.cosa, s.roadmap.transform.chi, s.roadmap.transform.cosa, s.commit30,
  ];
  const completezza = (keyFields.filter(Boolean).length / keyFields.length) * 10;
  return [fattibilita, impatto, velocita, governance, completezza];
}

function renderRadarCanvas(labels: string[], values: number[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = 500; canvas.height = 500;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const cx = 250, cy = 250, r = 155;
  const n = labels.length;
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n - Math.PI / 2);

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 500, 500);
  for (let ring = 1; ring <= 5; ring++) {
    const fr = (ring / 5) * r;
    ctx.beginPath();
    angles.forEach((a, i) => { const x = cx + fr * Math.cos(a), y = cy + fr * Math.sin(a); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.closePath(); ctx.strokeStyle = ring === 5 ? "#94a3b8" : "#e2e8f0"; ctx.lineWidth = ring === 5 ? 1.5 : 1; ctx.stroke();
    if (ring % 2 === 0) { ctx.fillStyle = "#94a3b8"; ctx.font = "11px Arial"; ctx.textAlign = "center"; ctx.fillText(`${ring * 2}`, cx + 5, cy - fr + 13); }
  }
  angles.forEach((a) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1; ctx.stroke(); });
  ctx.beginPath();
  angles.forEach((a, i) => { const fr = (values[i] / 10) * r; const x = cx + fr * Math.cos(a), y = cy + fr * Math.sin(a); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.closePath(); ctx.fillStyle = "rgba(27, 152, 224, 0.2)"; ctx.fill(); ctx.strokeStyle = "#1b98e0"; ctx.lineWidth = 3; ctx.stroke();
  angles.forEach((a, i) => { const fr = (values[i] / 10) * r; ctx.beginPath(); ctx.arc(cx + fr * Math.cos(a), cy + fr * Math.sin(a), 6, 0, Math.PI * 2); ctx.fillStyle = "#1b98e0"; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke(); });
  ctx.textAlign = "center";
  angles.forEach((a, i) => {
    const lr = r + 32, lx = cx + lr * Math.cos(a), ly = cy + lr * Math.sin(a);
    const parts = labels[i].split("\n");
    ctx.font = "bold 13px Arial"; ctx.fillStyle = "#021f54";
    parts.forEach((part, pi) => ctx.fillText(part, lx, ly + pi * 15 - ((parts.length - 1) * 7.5)));
    ctx.font = "12px Arial"; ctx.fillStyle = "#1b98e0";
    ctx.fillText(`${values[i].toFixed(1)}/10`, lx, ly + parts.length * 15 - ((parts.length - 1) * 7.5));
  });
  return canvas.toDataURL("image/png");
}

// ─── Infographic helpers ──────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxL = 99): number {
  if (!text) return y;
  const words = text.split(" ");
  let line = "";
  let drawn = 0;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line) {
      if (drawn >= maxL) return y;
      ctx.fillText(line.trim(), x, y);
      line = word + " ";
      y += lh;
      drawn++;
    } else {
      line = test;
    }
  }
  if (drawn < maxL && line.trim()) ctx.fillText(line.trim(), x, y);
  return y + lh;
}

function drawPill(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, bg: string, fg = "#fff"): number {
  const pad = 10, h = 26;
  ctx.font = "bold 12px Arial";
  const w = ctx.measureText(label).width + pad * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.fillText(label, x + pad, y + 18);
  return x + w + 8;
}

function drawSectionBar(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 12, y + 19);
  return y + 36;
}

function ChatBubble({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  return (
    <span>
      {content.split("\n").map((line, i) => (<span key={i}>{i > 0 && <br />}{line}</span>))}
      {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-slate-400 ml-0.5 align-middle animate-pulse" />}
    </span>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [processName, setProcessName] = useState("");
  const [roadmap, setRoadmap] = useState<Record<string, RoadmapPhase>>({
    quickWin: { chi: "", cosa: "", strumento: "", kpi: "" },
    scale: { chi: "", cosa: "", strumento: "", kpi: "" },
    transform: { chi: "", cosa: "", strumento: "", kpi: "" },
  });
  const [commit, setCommit] = useState("");
  const [saved, setSaved] = useState(false);
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingInfographic, setExportingInfographic] = useState(false);
  const [exportedInfographic, setExportedInfographic] = useState(false);
  const [locked, setLocked] = useState(false);

  // Roadmap advisor chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Quick Win implementation guide
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideContent, setGuideContent] = useState("");
  const [guideStreaming, setGuideStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const guideEndRef = useRef<HTMLDivElement>(null);

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
    setChatMsgs([{ role: "assistant", content: `Ciao! Ho accesso a tutto il lavoro che hai fatto: processo "${procName}", pattern ${pat}, canvas agentico e scelta del tool.\n\nSono qui per aiutarti a riempire le 3 fasi della roadmap con suggerimenti concreti. Dimmi da dove vuoi partire, oppure premi uno dei suggerimenti qui sotto.` }]);
    checkSession();
    const id = setInterval(checkSession, 10000);
    return () => clearInterval(id);
  }, [checkSession]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);
  useEffect(() => { if (guideOpen) guideEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [guideContent, guideOpen]);

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
        body: JSON.stringify({ messages: newMsgs.slice(-12), processName, process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null, analysis: stateSnap.mapping?.tobe ?? null, agenticDesign: stateSnap.agenticDesign, toolChoice: stateSnap.toolChoice, roadmap, commit }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); if (!reader) throw new Error("No stream");
      let aiContent = ""; setChatMsgs((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        aiContent += decoder.decode(value, { stream: true });
        setChatMsgs((prev) => [...prev.slice(0, -1), { role: "assistant", content: aiContent }]);
      }
    } catch (e: unknown) {
      setChatMsgs((prev) => [...prev, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Errore di rete"}` }]);
    } finally { setChatStreaming(false); }
  };

  const generateGuide = async () => {
    if (guideStreaming) return;
    if (!roadmap.quickWin?.strumento) {
      setGuideOpen(true);
      setGuideContent("⚠️ Compila prima il campo **Strumento / Piattaforma** nella card Quick Win per generare una guida specifica.");
      return;
    }
    setGuideOpen(true);
    setGuideContent("");
    setGuideStreaming(true);
    const s = getState();
    const proc = s.processes.find((p) => p.id === s.selectedProcessId) ?? null;
    try {
      const res = await fetch("/api/quickwin-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName, process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null, quickWin: roadmap.quickWin, toolChoice: s.toolChoice, analysis: s.mapping?.tobe ?? null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); if (!reader) throw new Error("No stream");
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        setGuideContent((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e: unknown) {
      setGuideContent((prev) => prev + `\n\n⚠️ Errore: ${e instanceof Error ? e.message : "Errore di rete"}`);
    } finally { setGuideStreaming(false); }
  };

  const copyGuide = async () => {
    await navigator.clipboard.writeText(guideContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadDemo = () => { setRoadmap(DEMO_ROADMAP); setCommit(DEMO_COMMIT); };

  const save = () => {
    setState({ roadmap: roadmap as { quickWin: RoadmapPhase; scale: RoadmapPhase; transform: RoadmapPhase }, commit30: commit });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const exportPDF = async () => {
    save();
    setExporting(true);
    try {
      const s = getState();
      const proc = s.processes.find((p) => p.id === s.selectedProcessId);
      const radarScores = computeRadarScores(s);
      const radarLabels = ["Fattibilità\nTecnica", "Impatto\nAtteso", "Velocità\nDeploy", "Governance\n& Sicurezza", "Completezza\nProgetto"];
      let radarImg = "";
      try { radarImg = renderRadarCanvas(radarLabels, radarScores); } catch { /* skip if canvas unavailable */ }
      let evaluation: { valutazione?: string; punti_di_forza?: string[]; rischi?: string[]; raccomandazione?: string } = {};
      try {
        const evalRes = await fetch("/api/export-evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processName: proc?.name || "", process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null, analysis: s.mapping?.tobe ?? null, agenticDesign: s.agenticDesign, toolChoice: s.toolChoice, roadmap: s.roadmap, commit: s.commit30 || "" }) });
        if (evalRes.ok) evaluation = await evalRes.json();
      } catch { /* proceed without evaluation */ }

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210, M = 14, CW = W - M * 2;
      const NAVY: [number, number, number] = [2, 31, 84];
      const TEAL: [number, number, number] = [37, 183, 211];
      const PRIMARY: [number, number, number] = [27, 152, 224];
      const SLATE: [number, number, number] = [100, 116, 139];
      const DARK: [number, number, number] = [30, 41, 59];
      const VIOLET: [number, number, number] = [99, 102, 241];
      let y = 0, pageNum = 1;
      let subtitle = "";

      const pageHeader = (sub: string) => {
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 16, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("iFAB · Masterclass Agentic AI · Giornata 2", M, 7);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        doc.text(sub, M, 12);
        doc.setTextColor(...SLATE); doc.text(`${pageNum}`, W - M, 12, { align: "right" });
        y = 22;
      };
      const newPage = (sub: string) => { doc.addPage(); pageNum++; subtitle = sub; pageHeader(sub); };
      const checkPage = (needed: number) => { if (y + needed > 280) newPage(subtitle); };
      const sectionBar = (label: string, color: [number, number, number] = TEAL) => {
        checkPage(14); doc.setFillColor(...color); doc.rect(M, y, CW, 7, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text(label.toUpperCase(), M + 3, y + 5); y += 10;
      };
      const labelValue = (label: string, value: string, maxLines = 15) => {
        if (!value) return;
        checkPage(14);
        doc.setTextColor(...SLATE); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text(label, M, y); y += 3.5;
        doc.setTextColor(...DARK); doc.setFontSize(9);
        const allLines = doc.splitTextToSize(value, CW);
        const lines: string[] = allLines.slice(0, maxLines);
        lines.forEach((line: string) => { checkPage(5); doc.text(line, M, y); y += 4.5; });
        if (allLines.length > maxLines) { doc.setFontSize(7.5); doc.setTextColor(...SLATE); doc.text("[... testo troncato]", M, y); y += 4; }
        y += 2;
      };

      // Page 1: Processo + AS-IS
      subtitle = `Processo: ${proc?.name || "—"}`;
      pageHeader(subtitle);
      sectionBar("Processo Selezionato");
      labelValue("Nome del processo", proc?.name || "");
      labelValue("Descrizione", proc?.description || "");
      labelValue("Impatto / Difficoltà", `${proc?.impatto === "alto" ? "Alto" : "Basso"} / ${proc?.facilita === "facile" ? "Facile" : "Difficile"}`);
      y += 3;
      if (s.mapping) {
        sectionBar("AS-IS — Mappatura del Processo Attuale");
        s.mapping.asis.steps.filter((st) => st.nome).forEach((step, i) => {
          checkPage(22);
          doc.setTextColor(...DARK); doc.setFontSize(9); doc.setFont("helvetica", "bold");
          doc.text(`Passaggio ${i + 1}: ${step.nome}`, M, y); y += 5;
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...SLATE);
          if (step.chi) { doc.text(`Chi: ${step.chi}`, M + 4, y); y += 4; }
          if (step.strumenti) { doc.text(`Strumenti: ${step.strumenti}`, M + 4, y); y += 4; }
          if (step.tempo) { doc.text(`Tempo: ${step.tempo}`, M + 4, y); y += 4; }
          y += 2;
        });
        if (s.mapping.asis.painPoints) { y += 2; labelValue("Pain Points / Inefficienze", s.mapping.asis.painPoints); }
      }

      // Page 2: TO-BE + confronto
      if (s.mapping?.tobe) {
        newPage("TO-BE — Visione Agentificata");
        const tobe = s.mapping.tobe;
        sectionBar("Analisi TO-BE — Visione Agentificata", PRIMARY);
        const scoreColor: [number, number, number] = tobe.score >= 7 ? TEAL : tobe.score >= 5 ? [219, 203, 79] : [239, 68, 68];
        doc.setFillColor(...scoreColor); doc.roundedRect(M, y, 52, 9, 2, 2, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(`Score: ${tobe.score}/10`, M + 4, y + 6);
        const approccioColor: [number, number, number] = tobe.approccio === "Augmentation" ? VIOLET : TEAL;
        doc.setFillColor(...approccioColor); doc.roundedRect(M + 57, y, 60, 9, 2, 2, "F");
        doc.text(`Approccio: ${tobe.approccio}`, M + 61, y + 6);
        y += 14;
        labelValue("Pattern Agentico", tobe.pattern);
        labelValue("Visione TO-BE", tobe.vision);
        labelValue("Input dell'agente", tobe.input);
        labelValue("Output dell'agente", tobe.output);
        labelValue("Livello di autonomia", tobe.autonomia);
        labelValue("Quick Win suggerito", tobe.quick_win);
        labelValue("Timeline stimata", tobe.timeline);
        labelValue("Rischi identificati", tobe.rischi.join(" • "));
        y += 3;
        if (tobe.confronto && tobe.confronto.length > 0) {
          checkPage(30); sectionBar("Confronto AS-IS vs. TO-BE");
          const col0 = CW * 0.28, col1 = CW * 0.36, col2 = CW * 0.36;
          doc.setFillColor(241, 245, 249); doc.rect(M, y, CW, 7.5, "F");
          doc.setTextColor(...SLATE); doc.setFontSize(8); doc.setFont("helvetica", "bold");
          doc.text("Dimensione", M + 2, y + 5.5); doc.text("AS-IS", M + col0 + 2, y + 5.5); doc.text("TO-BE", M + col0 + col1 + 2, y + 5.5);
          y += 8;
          tobe.confronto.forEach((row, idx) => {
            checkPage(12);
            doc.setFillColor(...(idx % 2 === 0 ? ([255, 255, 255] as [number, number, number]) : ([248, 250, 252] as [number, number, number])));
            doc.rect(M, y, CW, 10, "F");
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
            doc.text(doc.splitTextToSize(row.dimensione, col0 - 4)[0] || "", M + 2, y + 6.5);
            doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
            doc.text(doc.splitTextToSize(row.asis, col1 - 4)[0] || "", M + col0 + 2, y + 6.5);
            doc.setTextColor(...PRIMARY);
            doc.text(doc.splitTextToSize(row.tobe, col2 - 4)[0] || "", M + col0 + col1 + 2, y + 6.5);
            y += 10;
          });
          y += 4;
        }
      }

      // Page 3: Canvas + Tool
      newPage("Agentic Design Canvas + Scelta del Tool");
      subtitle = "Agentic Design Canvas + Scelta del Tool";
      const design = s.agenticDesign;
      const levelNames: Record<string, string> = {
        A: "Piattaforme Hosted Enterprise (Copilot Studio, Vertex AI, Bedrock)",
        B: "Automation Platforms (n8n, Make.com, Dify, Zapier)",
        C: "Framework Open-Source (LangGraph, CrewAI, AutoGen)",
        D: "SDK Vendor (Anthropic SDK, OpenAI Agents SDK, Google ADK)",
      };
      sectionBar("Agentic Design Canvas");
      if (design.systemPrompt) {
        doc.setTextColor(...SLATE); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text("System Prompt", M, y); y += 3.5;
        doc.setTextColor(...DARK); doc.setFontSize(8.5);
        const spAll = doc.splitTextToSize(design.systemPrompt, CW);
        const spLines: string[] = spAll.slice(0, 22);
        spLines.forEach((line: string) => { checkPage(5); doc.text(line, M, y); y += 4; });
        if (spAll.length > 22) { doc.setFontSize(7.5); doc.setTextColor(...SLATE); doc.text("[... testo troncato per brevità]", M, y); y += 4; }
        y += 3;
      }
      labelValue("Tools & Connettori", [...design.tools, ...(design.toolsCustom ? [design.toolsCustom] : [])].join(", "));
      labelValue("MCP Servers", design.mcpServers);
      labelValue("Memoria a Breve Termine (STM)", design.memorySTM);
      labelValue("Memoria a Lungo Termine (LTM)", design.memoryLTM);
      labelValue("Guardrails", [...design.guardrails, ...(design.guardrailsCustom ? [design.guardrailsCustom] : [])].join(", "));
      labelValue("Punti HITL (Human-in-the-Loop)", design.hitlPoints);
      labelValue("Flussi Automatizzabili", design.flussiAuto);
      y += 3;
      sectionBar("Scelta del Tool — Matrice di Posizionamento", VIOLET);
      if (s.toolChoice.primaryLevel) labelValue("Livello primario", `${s.toolChoice.primaryLevel} — ${levelNames[s.toolChoice.primaryLevel] || ""}`);
      if (s.toolChoice.secondaryLevel) labelValue("Livello secondario", `${s.toolChoice.secondaryLevel} — ${levelNames[s.toolChoice.secondaryLevel] || ""}`);
      labelValue("Note sulla scelta", s.toolChoice.notes);

      // Page 4: Roadmap
      newPage("Roadmap Sprint — Piano di Attuazione");
      subtitle = "Roadmap Sprint — Piano di Attuazione";
      const phaseColors: [number, number, number][] = [TEAL, PRIMARY, NAVY];
      const phaseLabels = [{ title: "Quick Win", horizon: "0–3 mesi" }, { title: "Scale", horizon: "3–12 mesi" }, { title: "Transform", horizon: "12–24 mesi" }];
      const phaseKeys: Array<"quickWin" | "scale" | "transform"> = ["quickWin", "scale", "transform"];
      phaseKeys.forEach((key, i) => {
        checkPage(40); sectionBar(`${phaseLabels[i].title} — ${phaseLabels[i].horizon}`, phaseColors[i]);
        const phase = s.roadmap[key];
        labelValue("Chi fa cosa", phase.chi); labelValue("Cosa si automatizza", phase.cosa);
        labelValue("Strumento / Piattaforma", phase.strumento); labelValue("Come si misura il successo (KPI)", phase.kpi);
        y += 3;
      });
      if (s.commit30) {
        checkPage(22); doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 18, 2, 2, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text("Il mio commit — prossimi 30 giorni", M + 4, y + 6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        const commitLines: string[] = doc.splitTextToSize(s.commit30, CW - 8).slice(0, 2);
        commitLines.forEach((line: string, ci: number) => { doc.text(line, M + 4, y + 12 + ci * 4.5); });
        y += 23;
      }

      // Page 5: Radar + AI evaluation
      newPage("Valutazione Complessiva del Progetto Agentico");
      subtitle = "Valutazione Complessiva del Progetto Agentico";
      sectionBar("Profilo di Maturità del Progetto", PRIMARY);
      y += 2;
      if (radarImg) {
        doc.addImage(radarImg, "PNG", M + (CW - 110) / 2, y, 110, 110); y += 115;
      } else {
        doc.setTextColor(...SLATE); doc.setFontSize(8); doc.text("(grafico non disponibile)", W / 2, y + 20, { align: "center" }); y += 30;
      }
      const axisLabels = ["Fattibilità Tecnica", "Impatto Atteso", "Velocità Deploy", "Governance & Sicurezza", "Completezza Progetto"];
      const boxW = (CW - 8) / 5;
      axisLabels.forEach((label, i) => {
        const bx = M + i * (boxW + 2), scoreVal = radarScores[i];
        const bColor: [number, number, number] = scoreVal >= 7 ? TEAL : scoreVal >= 4 ? [219, 203, 79] : [239, 68, 68];
        doc.setFillColor(...bColor); doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text(`${scoreVal.toFixed(1)}`, bx + boxW / 2, y + 7, { align: "center" });
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.splitTextToSize(label, boxW - 2).slice(0, 2).forEach((ll: string, li: number) => doc.text(ll, bx + boxW / 2, y + 11 + li * 3, { align: "center" }));
      });
      y += 20;
      if (evaluation.valutazione || (evaluation.punti_di_forza?.length ?? 0) > 0) {
        y += 4; sectionBar("Valutazione AI del Progetto", VIOLET);
        labelValue("Valutazione complessiva", evaluation.valutazione || "");
        if ((evaluation.punti_di_forza?.length ?? 0) > 0) {
          checkPage(20); doc.setTextColor(...SLATE); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text("Punti di forza", M, y); y += 4;
          evaluation.punti_di_forza!.forEach((pt) => {
            checkPage(8); doc.setTextColor(...TEAL); doc.setFontSize(10); doc.text("✓", M, y);
            doc.setTextColor(...DARK); doc.setFontSize(9);
            doc.splitTextToSize(pt, CW - 8).slice(0, 2).forEach((l: string) => { doc.text(l, M + 7, y); y += 4.5; });
          }); y += 3;
        }
        if ((evaluation.rischi?.length ?? 0) > 0) {
          checkPage(20); doc.setTextColor(...SLATE); doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.text("Rischi da presidiare", M, y); y += 4;
          evaluation.rischi!.forEach((r) => {
            checkPage(8); doc.setTextColor(239, 68, 68); doc.setFontSize(10); doc.text("!", M + 1, y);
            doc.setTextColor(...DARK); doc.setFontSize(9);
            doc.splitTextToSize(r, CW - 8).slice(0, 2).forEach((l: string) => { doc.text(l, M + 7, y); y += 4.5; });
          }); y += 3;
        }
        if (evaluation.raccomandazione) {
          checkPage(22); doc.setFillColor(235, 247, 255); doc.roundedRect(M, y, CW, 18, 2, 2, "F");
          doc.setTextColor(...NAVY); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Raccomandazione principale", M + 4, y + 5.5);
          doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
          doc.splitTextToSize(evaluation.raccomandazione, CW - 8).slice(0, 2).forEach((l: string, ri: number) => doc.text(l, M + 4, y + 10.5 + ri * 4.5));
          y += 22;
        }
      }

      // Page 6: Quick Win implementation guide (if already generated)
      if (guideContent && !guideStreaming) {
        newPage("Guida all'Implementazione — Quick Win");
        subtitle = "Guida all'Implementazione — Quick Win";
        sectionBar(`Guida implementazione: ${roadmap.quickWin?.strumento || "Quick Win"}`, TEAL);
        doc.setTextColor(...DARK); doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
        const guideLines: string[] = doc.splitTextToSize(
          guideContent.replace(/#{1,3}\s/g, "").replace(/\*\*/g, "").replace(/`/g, ""),
          CW
        ).slice(0, 120);
        guideLines.forEach((line: string) => { checkPage(5); doc.text(line, M, y); y += 4.5; });
      }

      doc.setTextColor(...SLATE); doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.text(`Generato da iFAB Agentic Platform · ${new Date().toLocaleDateString("it-IT")}`, W / 2, 290, { align: "center" });
      doc.save(`iFAB_Agentic_${(proc?.name || "Roadmap").replace(/\s+/g, "_")}.pdf`);
      setExported(true); setTimeout(() => setExported(false), 3000);
    } finally { setExporting(false); }
  };

  const exportInfographic = async () => {
    save();
    setExportingInfographic(true);
    try {
      const s = getState();
      const proc = s.processes.find((p) => p.id === s.selectedProcessId);
      const radarScores = computeRadarScores(s);
      const radarLabels = ["Fattibilità\nTecnica", "Impatto\nAtteso", "Velocità\nDeploy", "Governance\n& Sicurezza", "Completezza\nProgetto"];

      let evaluation: { valutazione?: string; punti_di_forza?: string[]; rischi?: string[]; raccomandazione?: string } = {};
      try {
        const evalRes = await fetch("/api/export-evaluation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processName: proc?.name || "", process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null, analysis: s.mapping?.tobe ?? null, agenticDesign: s.agenticDesign, toolChoice: s.toolChoice, roadmap: s.roadmap, commit: s.commit30 || "" }),
        });
        if (evalRes.ok) evaluation = await evalRes.json();
      } catch { /* proceed without */ }

      const IW = 1920, IH = 1080;
      const ic = document.createElement("canvas");
      ic.width = IW; ic.height = IH;
      const ctx = ic.getContext("2d");
      if (!ctx) return;

      const CNAV = "#021f54", CPRI = "#1b98e0", CTEAL = "#25b7d3";
      const CSLT = "#64748b", CW2 = "#ffffff", CBG = "#f8fafc";
      const CGOLD = "#f5c842", CVIO = "#6366f1", CDARK = "#1e293b";

      ctx.fillStyle = CBG; ctx.fillRect(0, 0, IW, IH);

      // Header
      ctx.fillStyle = CNAV; ctx.fillRect(0, 0, IW, 90);
      ctx.fillStyle = CGOLD; ctx.font = "bold 30px Arial"; ctx.textAlign = "left";
      ctx.fillText("iFAB", 40, 40);
      ctx.fillStyle = CW2; ctx.font = "15px Arial";
      ctx.fillText("Masterclass Agentic AI · Giornata 2", 40, 65);
      ctx.font = "bold 26px Arial"; ctx.textAlign = "center";
      ctx.fillText(proc?.name || "Progetto Agentico", 960, 45);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "14px Arial";
      ctx.fillText("Piano di Adozione Agentic AI", 960, 70);
      ctx.textAlign = "right";
      ctx.fillText(new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }), 1880, 55);

      // Footer
      ctx.fillStyle = CNAV; ctx.fillRect(0, 940, 960, 140);
      ctx.fillStyle = CPRI; ctx.fillRect(960, 940, 960, 140);
      ctx.fillStyle = CW2; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
      ctx.fillText("PUNTI DI FORZA", 40, 968);
      ctx.font = "13px Arial";
      const strengths = evaluation.punti_di_forza ?? [];
      if (strengths.length > 0) {
        strengths.slice(0, 3).forEach((pt, i) => {
          ctx.fillStyle = CTEAL; ctx.fillText("✓", 40, 992 + i * 26);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(pt.length > 92 ? pt.slice(0, 92) + "…" : pt, 62, 992 + i * 26);
        });
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText("Genera la valutazione tramite 'Esporta PDF' per visualizzarla", 40, 990);
      }
      ctx.fillStyle = CW2; ctx.font = "bold 14px Arial"; ctx.textAlign = "left";
      ctx.fillText("RACCOMANDAZIONE AI", 980, 968);
      if (evaluation.raccomandazione) {
        ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "14px Arial";
        wrapText(ctx, evaluation.raccomandazione, 980, 990, 860, 22, 3);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "13px Arial";
        ctx.fillText("Genera la valutazione tramite 'Esporta PDF'", 980, 990);
      }
      ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "11px Arial"; ctx.textAlign = "center";
      ctx.fillText(`iFAB Agentic Platform · ${new Date().toLocaleDateString("it-IT")}`, 960, 1068);

      // Column dividers
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(520, 90); ctx.lineTo(520, 940); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1400, 90); ctx.lineTo(1400, 940); ctx.stroke();

      // === COLUMN 1: Processo + TO-BE + Tool ===
      const c1x = 40, c1w = 460; let c1y = 106;

      c1y = drawSectionBar(ctx, "PROCESSO", c1x, c1y, c1w, CNAV) + 4;
      ctx.fillStyle = CDARK; ctx.font = "bold 17px Arial"; ctx.textAlign = "left";
      ctx.fillText(proc?.name || "—", c1x, c1y); c1y += 22;
      if (proc?.description) {
        ctx.fillStyle = CSLT; ctx.font = "13px Arial";
        c1y = wrapText(ctx, proc.description, c1x, c1y, c1w, 18, 3);
      }
      c1y += 4;
      let px = c1x;
      if (proc?.impatto) px = drawPill(ctx, proc.impatto === "alto" ? "Alto impatto" : "Basso impatto", px, c1y, proc.impatto === "alto" ? CTEAL : CSLT);
      if (proc?.facilita) drawPill(ctx, proc.facilita === "facile" ? "Facile" : "Difficile", px, c1y, proc.facilita === "facile" ? "#22c55e" : "#ef4444");
      c1y += 40;

      if (s.mapping?.tobe) {
        const tobe = s.mapping.tobe;
        c1y = drawSectionBar(ctx, "ANALISI TO-BE", c1x, c1y, c1w, CPRI) + 8;
        const scColor = tobe.score >= 7 ? CTEAL : tobe.score >= 5 ? "#f59e0b" : "#ef4444";
        px = drawPill(ctx, `Score ${tobe.score}/10`, c1x, c1y, scColor);
        drawPill(ctx, (tobe.pattern || "—").slice(0, 22), px, c1y, CNAV);
        c1y += 38;
        if (tobe.vision) {
          ctx.fillStyle = CSLT; ctx.font = "bold 11px Arial"; ctx.textAlign = "left";
          ctx.fillText("VISIONE", c1x, c1y); c1y += 15;
          ctx.fillStyle = CDARK; ctx.font = "13px Arial";
          c1y = wrapText(ctx, tobe.vision, c1x, c1y, c1w, 18, 3); c1y += 4;
        }
        if (tobe.autonomia) {
          ctx.fillStyle = CSLT; ctx.font = "bold 11px Arial"; ctx.textAlign = "left";
          ctx.fillText("AUTONOMIA", c1x, c1y); c1y += 15;
          ctx.fillStyle = CDARK; ctx.font = "13px Arial";
          c1y = wrapText(ctx, tobe.autonomia, c1x, c1y, c1w, 18, 2); c1y += 4;
        }
      }

      if (s.toolChoice.primaryLevel) {
        const lvl: Record<string, string> = { A: "Hosted Enterprise", B: "Automation Platforms", C: "Framework OSS", D: "SDK Vendor" };
        c1y = drawSectionBar(ctx, "TOOL SCELTO", c1x, c1y, c1w, CVIO) + 8;
        px = drawPill(ctx, `${s.toolChoice.primaryLevel}: ${lvl[s.toolChoice.primaryLevel] || ""}`, c1x, c1y, CVIO);
        if (s.toolChoice.secondaryLevel) {
          drawPill(ctx, `+ ${s.toolChoice.secondaryLevel}: ${lvl[s.toolChoice.secondaryLevel] || ""}`, px, c1y, "#8b5cf6");
        }
      }

      // === COLUMN 2: Radar + Score boxes ===
      const c2x = 540, c2w = 840; let c2y = 106;
      c2y = drawSectionBar(ctx, "PROFILO DI MATURITÀ DEL PROGETTO", c2x, c2y, c2w, CPRI) + 16;

      const radarDataUrl = renderRadarCanvas(radarLabels, radarScores);
      if (radarDataUrl) {
        try {
          const radarImg = await loadImage(radarDataUrl);
          const cs = 380;
          ctx.drawImage(radarImg, c2x + (c2w - cs) / 2, c2y, cs, cs);
          c2y += cs + 16;
        } catch { c2y += 30; }
      }
      const sLbls = ["Fattibilità\nTecnica", "Impatto\nAtteso", "Velocità\nDeploy", "Governance\n& Sic.", "Completezza\nProgetto"];
      const bw = (c2w - 32) / 5, bh = 72;
      sLbls.forEach((lbl, i) => {
        const bx = c2x + i * (bw + 8), sv = radarScores[i];
        ctx.fillStyle = sv >= 7 ? CTEAL : sv >= 4 ? "#f59e0b" : "#ef4444";
        ctx.beginPath(); ctx.roundRect(bx, c2y, bw, bh, 8); ctx.fill();
        ctx.fillStyle = CW2; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
        ctx.fillText(`${sv.toFixed(1)}`, bx + bw / 2, c2y + 32);
        ctx.font = "10px Arial";
        lbl.split("\n").forEach((part, pi) => ctx.fillText(part, bx + bw / 2, c2y + 48 + pi * 14));
      });

      // === COLUMN 3: Roadmap ===
      const c3x = 1420, c3w = 460; let c3y = 106;
      c3y = drawSectionBar(ctx, "ROADMAP SPRINT", c3x, c3y, c3w, CNAV) + 10;

      const phDefs = [
        { key: "quickWin" as const, label: "⚡ Quick Win · 0–3 mesi", color: CTEAL },
        { key: "scale" as const, label: "📈 Scale · 3–12 mesi", color: CPRI },
        { key: "transform" as const, label: "🔮 Transform · 12–24 mesi", color: CNAV },
      ];
      for (const ph of phDefs) {
        const phase = s.roadmap[ph.key];
        ctx.fillStyle = ph.color; ctx.fillRect(c3x, c3y, c3w, 26);
        ctx.fillStyle = CW2; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
        ctx.fillText(ph.label, c3x + 10, c3y + 18); c3y += 32;
        if (phase.cosa) {
          ctx.fillStyle = CSLT; ctx.font = "bold 10px Arial"; ctx.textAlign = "left";
          ctx.fillText("COSA", c3x, c3y); c3y += 14;
          ctx.fillStyle = CDARK; ctx.font = "12px Arial";
          c3y = wrapText(ctx, phase.cosa, c3x, c3y, c3w, 17, 2); c3y += 2;
        }
        if (phase.strumento) {
          drawPill(ctx, phase.strumento.slice(0, 32), c3x, c3y, ph.color);
          c3y += 32;
        }
        if (phase.kpi) {
          ctx.fillStyle = CSLT; ctx.font = "bold 10px Arial"; ctx.textAlign = "left";
          ctx.fillText("KPI", c3x, c3y); c3y += 14;
          ctx.fillStyle = CDARK; ctx.font = "12px Arial";
          c3y = wrapText(ctx, phase.kpi, c3x, c3y, c3w, 17, 2); c3y += 2;
        }
        c3y += 12;
      }
      if (s.commit30) {
        ctx.fillStyle = "#0f172a"; ctx.fillRect(c3x, c3y, c3w, 26);
        ctx.fillStyle = CGOLD; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
        ctx.fillText("COMMIT 30 GIORNI", c3x + 10, c3y + 18); c3y += 32;
        ctx.fillStyle = CDARK; ctx.font = "12px Arial";
        wrapText(ctx, s.commit30, c3x, c3y, c3w, 17, 3);
      }

      const link = document.createElement("a");
      link.download = `iFAB_Infografica_${(proc?.name || "Agentic").replace(/\s+/g, "_")}.png`;
      link.href = ic.toDataURL("image/png");
      link.click();
      setExportedInfographic(true);
      setTimeout(() => setExportedInfographic(false), 3000);
    } catch (e: unknown) {
      console.error("Infographic export error:", e);
    } finally {
      setExportingInfographic(false);
    }
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
    <>
      {/* ── Guide modal ── */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setGuideOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative">
            {/* Header */}
            <div className="bg-navy rounded-t-2xl px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-white font-bold text-lg">Guida all&apos;implementazione</h2>
                  <p className="text-white/60 text-sm mt-0.5">Quick Win · {processName || "—"}</p>
                  {roadmap.quickWin?.strumento && (
                    <span className="inline-block mt-2 bg-teal/20 text-teal text-xs font-semibold px-2.5 py-1 rounded-full border border-teal/30">
                      {roadmap.quickWin.strumento}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setGuideOpen(false)}
                  className="text-white/60 hover:text-white transition-colors text-3xl leading-none shrink-0 mt-[-4px]"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 min-h-[200px]">
              {guideContent ? (
                <GuideRenderer content={guideContent} isStreaming={guideStreaming} />
              ) : (
                <div className="flex items-center justify-center py-20 gap-2">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-2.5 h-2.5 rounded-full bg-teal animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              )}
              <div ref={guideEndRef} />
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setGuideOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:border-slate-400 transition-colors"
              >
                Chiudi
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setGuideContent(""); generateGuide(); }}
                  disabled={guideStreaming}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                >
                  ↺ Rigenera
                </button>
                <button
                  onClick={copyGuide}
                  disabled={!guideContent || guideStreaming}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                    copied ? "bg-green-500 text-white" : "bg-navy text-white hover:bg-deepblue"
                  }`}
                >
                  {copied ? "Copiato!" : "Copia testo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="w-full max-w-[1400px] mx-auto px-4 py-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

          {/* Roadmap column */}
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

                {/* Guide button — Quick Win only */}
                {phase.key === "quickWin" && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={generateGuide}
                      disabled={guideStreaming}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal/10 border border-teal/30 text-teal text-sm font-semibold hover:bg-teal/20 transition-colors disabled:opacity-50"
                    >
                      <span>📋</span>
                      {guideStreaming ? "Generazione guida in corso..." : "Genera guida all'implementazione"}
                    </button>
                  </div>
                )}
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
                <button onClick={save} className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors border ${saved ? "bg-green-500 text-white border-green-500" : "bg-slate-100 text-navy hover:bg-slate-200 border-slate-200"}`}>
                  {saved ? "Salvato!" : "Salva"}
                </button>
                <button
                  onClick={exportPDF}
                  disabled={exporting}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    exported ? "bg-green-500 text-white" : exporting ? "bg-slate-300 text-slate cursor-not-allowed" : "bg-navy text-white hover:bg-deepblue"
                  }`}
                >
                  {exported ? "PDF scaricato!" : exporting ? "Generazione..." : "Esporta PDF"}
                </button>
                <button
                  onClick={exportInfographic}
                  disabled={exportingInfographic}
                  className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    exportedInfographic ? "bg-green-500 text-white" : exportingInfographic ? "bg-slate-300 text-slate cursor-not-allowed" : "bg-primary text-white hover:bg-deepblue"
                  }`}
                >
                  {exportedInfographic ? "Infografica esportata!" : exportingInfographic ? "Generazione..." : "Esporta infografica"}
                </button>
              </div>
            </div>
          </div>

          {/* Chat column */}
          <div className="lg:sticky lg:top-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[500px] lg:max-h-[calc(100vh-5rem)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="w-2 h-2 rounded-full bg-deepblue shrink-0 animate-pulse" />
              <p className="text-sm font-bold text-navy">Advisor AI</p>
              <p className="text-xs text-slate ml-auto">Roadmap Strategist</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
              {chatMsgs.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${msg.role === "user" ? "bg-navy text-white rounded-tr-sm" : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm"}`}>
                    <ChatBubble content={msg.content} isStreaming={chatStreaming && i === chatMsgs.length - 1 && msg.role === "assistant"} />
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-slate-100 px-3 py-3 shrink-0">
              <div className="flex gap-2">
                <input type="text" placeholder="Chiedi un suggerimento..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !chatStreaming && sendChat()} disabled={chatStreaming} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-deepblue disabled:bg-slate-50" />
                <button onClick={() => sendChat()} disabled={chatStreaming || !chatInput.trim()} className="px-3 py-2 rounded-lg bg-deepblue text-white text-sm font-bold disabled:bg-slate-200 disabled:text-slate transition-colors">
                  {chatStreaming ? "·" : "→"}
                </button>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {["Suggerisci il Quick Win", "Chi coinvolgere?", "Quali KPI misurare?", "Aiutami con il commit 30 giorni"].map((q) => (
                  <button key={q} onClick={() => sendChat(q)} disabled={chatStreaming} className="text-xs px-2 py-1 rounded-full border border-slate-200 text-slate hover:border-deepblue hover:text-deepblue transition-colors disabled:opacity-40">{q}</button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
