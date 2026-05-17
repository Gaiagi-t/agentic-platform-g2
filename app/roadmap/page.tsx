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
    proc?.name, proc?.description,
    s.mapping?.asis.steps[0]?.nome,
    tobe?.vision, tobe?.pattern,
    design.systemPrompt,
    tc.primaryLevel,
    s.roadmap.quickWin.chi, s.roadmap.quickWin.cosa,
    s.roadmap.quickWin.strumento, s.roadmap.quickWin.kpi,
    s.roadmap.scale.chi, s.roadmap.scale.cosa,
    s.roadmap.transform.chi, s.roadmap.transform.cosa,
    s.commit30,
  ];
  const completezza = (keyFields.filter(Boolean).length / keyFields.length) * 10;

  return [fattibilita, impatto, velocita, governance, completezza];
}

function renderRadarCanvas(labels: string[], values: number[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 500;
  const ctx = canvas.getContext("2d")!;
  const cx = 250, cy = 250, r = 155;
  const n = labels.length;
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n - Math.PI / 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 500, 500);

  for (let ring = 1; ring <= 5; ring++) {
    const fr = (ring / 5) * r;
    ctx.beginPath();
    angles.forEach((a, i) => {
      const x = cx + fr * Math.cos(a), y = cy + fr * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = ring === 5 ? "#94a3b8" : "#e2e8f0";
    ctx.lineWidth = ring === 5 ? 1.5 : 1;
    ctx.stroke();
    if (ring % 2 === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${ring * 2}`, cx + 5, cy - fr + 13);
    }
  }

  angles.forEach((a) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.beginPath();
  angles.forEach((a, i) => {
    const fr = (values[i] / 10) * r;
    const x = cx + fr * Math.cos(a), y = cy + fr * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(27, 152, 224, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "#1b98e0";
  ctx.lineWidth = 3;
  ctx.stroke();

  angles.forEach((a, i) => {
    const fr = (values[i] / 10) * r;
    ctx.beginPath();
    ctx.arc(cx + fr * Math.cos(a), cy + fr * Math.sin(a), 6, 0, Math.PI * 2);
    ctx.fillStyle = "#1b98e0";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.textAlign = "center";
  angles.forEach((a, i) => {
    const lr = r + 32;
    const lx = cx + lr * Math.cos(a);
    const ly = cy + lr * Math.sin(a);
    const parts = labels[i].split("\n");
    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#021f54";
    parts.forEach((part, pi) => {
      ctx.fillText(part, lx, ly + pi * 15 - ((parts.length - 1) * 7.5));
    });
    ctx.font = "12px Arial";
    ctx.fillStyle = "#1b98e0";
    ctx.fillText(`${values[i].toFixed(1)}/10`, lx, ly + parts.length * 15 - ((parts.length - 1) * 7.5));
  });

  return canvas.toDataURL("image/png");
}

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
  const [exporting, setExporting] = useState(false);
  const [locked, setLocked] = useState(false);

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    setExporting(true);
    try {
      const s = getState();
      const proc = s.processes.find((p) => p.id === s.selectedProcessId);

      const radarScores = computeRadarScores(s);
      const radarLabels = ["Fattibilità\nTecnica", "Impatto\nAtteso", "Velocità\nDeploy", "Governance\n& Sicurezza", "Completezza\nProgetto"];
      let radarImg = "";
      try { radarImg = renderRadarCanvas(radarLabels, radarScores); } catch { /* skip chart if canvas unavailable */ }

      let evaluation: { valutazione?: string; punti_di_forza?: string[]; rischi?: string[]; raccomandazione?: string } = {};
      try {
        const evalRes = await fetch("/api/export-evaluation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processName: proc?.name || "",
            process: proc ? { description: proc.description, impatto: proc.impatto, facilita: proc.facilita } : null,
            analysis: s.mapping?.tobe ?? null,
            agenticDesign: s.agenticDesign,
            toolChoice: s.toolChoice,
            roadmap: s.roadmap,
            commit: s.commit30 || "",
          }),
        });
        if (evalRes.ok) evaluation = await evalRes.json();
      } catch { /* proceed without evaluation */ }

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const M = 14;
      const CW = W - M * 2;
      const NAVY: [number, number, number] = [2, 31, 84];
      const TEAL: [number, number, number] = [37, 183, 211];
      const PRIMARY: [number, number, number] = [27, 152, 224];
      const SLATE: [number, number, number] = [100, 116, 139];
      const DARK: [number, number, number] = [30, 41, 59];
      const VIOLET: [number, number, number] = [99, 102, 241];
      let y = 0;
      let pageNum = 1;
      let subtitle = "";

      const pageHeader = (sub: string) => {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, W, 16, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("iFAB · Masterclass Agentic AI · Giornata 2", M, 7);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(sub, M, 12);
        doc.setTextColor(...SLATE);
        doc.text(`${pageNum}`, W - M, 12, { align: "right" });
        y = 22;
      };

      const newPage = (sub: string) => {
        doc.addPage();
        pageNum++;
        subtitle = sub;
        pageHeader(sub);
      };

      const checkPage = (needed: number) => {
        if (y + needed > 280) newPage(subtitle);
      };

      const sectionBar = (label: string, color: [number, number, number] = TEAL) => {
        checkPage(14);
        doc.setFillColor(...color);
        doc.rect(M, y, CW, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(label.toUpperCase(), M + 3, y + 5);
        y += 10;
      };

      const labelValue = (label: string, value: string, maxLines = 15) => {
        if (!value) return;
        checkPage(14);
        doc.setTextColor(...SLATE);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(label, M, y);
        y += 3.5;
        doc.setTextColor(...DARK);
        doc.setFontSize(9);
        const allLines = doc.splitTextToSize(value, CW);
        const lines: string[] = allLines.slice(0, maxLines);
        lines.forEach((line: string) => {
          checkPage(5);
          doc.text(line, M, y);
          y += 4.5;
        });
        if (allLines.length > maxLines) {
          doc.setFontSize(7.5);
          doc.setTextColor(...SLATE);
          doc.text("[... testo troncato]", M, y);
          y += 4;
        }
        y += 2;
      };

      // ─── PAGE 1: PROCESSO + AS-IS ───
      subtitle = `Processo: ${proc?.name || "—"}`;
      pageHeader(subtitle);

      sectionBar("Processo Selezionato");
      labelValue("Nome del processo", proc?.name || "");
      labelValue("Descrizione", proc?.description || "");
      labelValue("Impatto / Difficoltà", `${proc?.impatto === "alto" ? "Alto" : "Basso"} / ${proc?.facilita === "facile" ? "Facile" : "Difficile"}`);
      y += 3;

      if (s.mapping) {
        sectionBar("AS-IS — Mappatura del Processo Attuale");
        const filledSteps = s.mapping.asis.steps.filter((st) => st.nome);
        filledSteps.forEach((step, i) => {
          checkPage(22);
          doc.setTextColor(...DARK);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`Passaggio ${i + 1}: ${step.nome}`, M, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...SLATE);
          if (step.chi) { doc.text(`Chi: ${step.chi}`, M + 4, y); y += 4; }
          if (step.strumenti) { doc.text(`Strumenti: ${step.strumenti}`, M + 4, y); y += 4; }
          if (step.tempo) { doc.text(`Tempo: ${step.tempo}`, M + 4, y); y += 4; }
          y += 2;
        });
        if (s.mapping.asis.painPoints) {
          y += 2;
          labelValue("Pain Points / Inefficienze", s.mapping.asis.painPoints);
        }
      }

      // ─── PAGE 2: TO-BE + CONFRONTO ───
      if (s.mapping?.tobe) {
        newPage("TO-BE — Visione Agentificata");
        const tobe = s.mapping.tobe;

        sectionBar("Analisi TO-BE — Visione Agentificata", PRIMARY);

        const scoreColor: [number, number, number] = tobe.score >= 7 ? TEAL : tobe.score >= 5 ? [219, 203, 79] : [239, 68, 68];
        doc.setFillColor(...scoreColor);
        doc.roundedRect(M, y, 52, 9, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`Score: ${tobe.score}/10`, M + 4, y + 6);

        const approccioColor: [number, number, number] = tobe.approccio === "Augmentation" ? VIOLET : TEAL;
        doc.setFillColor(...approccioColor);
        doc.roundedRect(M + 57, y, 60, 9, 2, 2, "F");
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
          checkPage(30);
          sectionBar("Confronto AS-IS vs. TO-BE");

          const col0 = CW * 0.28, col1 = CW * 0.36, col2 = CW * 0.36;
          doc.setFillColor(241, 245, 249);
          doc.rect(M, y, CW, 7.5, "F");
          doc.setTextColor(...SLATE);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text("Dimensione", M + 2, y + 5.5);
          doc.text("AS-IS", M + col0 + 2, y + 5.5);
          doc.text("TO-BE", M + col0 + col1 + 2, y + 5.5);
          y += 8;

          tobe.confronto.forEach((row, idx) => {
            checkPage(12);
            doc.setFillColor(...(idx % 2 === 0 ? ([255, 255, 255] as [number, number, number]) : ([248, 250, 252] as [number, number, number])));
            doc.rect(M, y, CW, 10, "F");
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...DARK);
            doc.text(doc.splitTextToSize(row.dimensione, col0 - 4)[0] || "", M + 2, y + 6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...SLATE);
            doc.text(doc.splitTextToSize(row.asis, col1 - 4)[0] || "", M + col0 + 2, y + 6.5);
            doc.setTextColor(...PRIMARY);
            doc.text(doc.splitTextToSize(row.tobe, col2 - 4)[0] || "", M + col0 + col1 + 2, y + 6.5);
            y += 10;
          });
          y += 4;
        }
      }

      // ─── PAGE 3: AGENTIC DESIGN CANVAS + TOOL CHOICE ───
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
        doc.setTextColor(...SLATE);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text("System Prompt", M, y);
        y += 3.5;
        doc.setTextColor(...DARK);
        doc.setFontSize(8.5);
        const spAll = doc.splitTextToSize(design.systemPrompt, CW);
        const spLines: string[] = spAll.slice(0, 22);
        spLines.forEach((line: string) => {
          checkPage(5);
          doc.text(line, M, y);
          y += 4;
        });
        if (spAll.length > 22) {
          doc.setFontSize(7.5);
          doc.setTextColor(...SLATE);
          doc.text("[... testo troncato per brevità]", M, y);
          y += 4;
        }
        y += 3;
      }

      const allTools = [...design.tools, ...(design.toolsCustom ? [design.toolsCustom] : [])].join(", ");
      labelValue("Tools & Connettori", allTools);
      labelValue("MCP Servers", design.mcpServers);
      labelValue("Memoria a Breve Termine (STM)", design.memorySTM);
      labelValue("Memoria a Lungo Termine (LTM)", design.memoryLTM);
      const allGuardrails = [...design.guardrails, ...(design.guardrailsCustom ? [design.guardrailsCustom] : [])].join(", ");
      labelValue("Guardrails", allGuardrails);
      labelValue("Punti HITL (Human-in-the-Loop)", design.hitlPoints);
      labelValue("Flussi Automatizzabili", design.flussiAuto);
      y += 3;

      sectionBar("Scelta del Tool — Matrice di Posizionamento", VIOLET);
      if (s.toolChoice.primaryLevel) {
        labelValue("Livello primario", `${s.toolChoice.primaryLevel} — ${levelNames[s.toolChoice.primaryLevel] || ""}`);
      }
      if (s.toolChoice.secondaryLevel) {
        labelValue("Livello secondario (complementare)", `${s.toolChoice.secondaryLevel} — ${levelNames[s.toolChoice.secondaryLevel] || ""}`);
      }
      labelValue("Note sulla scelta", s.toolChoice.notes);

      // ─── PAGE 4: ROADMAP SPRINT ───
      newPage("Roadmap Sprint — Piano di Attuazione");
      subtitle = "Roadmap Sprint — Piano di Attuazione";

      const phaseColors: [number, number, number][] = [TEAL, PRIMARY, NAVY];
      const phaseLabels = [
        { title: "Quick Win", horizon: "0–3 mesi" },
        { title: "Scale", horizon: "3–12 mesi" },
        { title: "Transform", horizon: "12–24 mesi" },
      ];
      const phaseKeys: Array<"quickWin" | "scale" | "transform"> = ["quickWin", "scale", "transform"];

      phaseKeys.forEach((key, i) => {
        checkPage(40);
        sectionBar(`${phaseLabels[i].title} — ${phaseLabels[i].horizon}`, phaseColors[i]);
        const phase = s.roadmap[key];
        labelValue("Chi fa cosa", phase.chi);
        labelValue("Cosa si automatizza", phase.cosa);
        labelValue("Strumento / Piattaforma", phase.strumento);
        labelValue("Come si misura il successo (KPI)", phase.kpi);
        y += 3;
      });

      if (s.commit30) {
        checkPage(22);
        doc.setFillColor(...NAVY);
        doc.roundedRect(M, y, CW, 18, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Il mio commit — prossimi 30 giorni", M + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const commitLines: string[] = doc.splitTextToSize(s.commit30, CW - 8).slice(0, 2);
        commitLines.forEach((line: string, ci: number) => {
          doc.text(line, M + 4, y + 12 + ci * 4.5);
        });
        y += 23;
      }

      // ─── PAGE 5: RADAR CHART + AI EVALUATION ───
      newPage("Valutazione Complessiva del Progetto Agentico");
      subtitle = "Valutazione Complessiva del Progetto Agentico";

      sectionBar("Profilo di Maturità del Progetto", PRIMARY);
      y += 2;
      if (radarImg) {
        doc.addImage(radarImg, "PNG", M + (CW - 110) / 2, y, 110, 110);
        y += 115;
      } else {
        doc.setTextColor(...SLATE);
        doc.setFontSize(8);
        doc.text("(grafico non disponibile)", W / 2, y + 20, { align: "center" });
        y += 30;
      }

      const axisLabels = ["Fattibilità Tecnica", "Impatto Atteso", "Velocità Deploy", "Governance & Sicurezza", "Completezza Progetto"];
      const boxW = (CW - 8) / 5;
      axisLabels.forEach((label, i) => {
        const bx = M + i * (boxW + 2);
        const scoreVal = radarScores[i];
        const bColor: [number, number, number] = scoreVal >= 7 ? TEAL : scoreVal >= 4 ? [219, 203, 79] : [239, 68, 68];
        doc.setFillColor(...bColor);
        doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${scoreVal.toFixed(1)}`, bx + boxW / 2, y + 7, { align: "center" });
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        const llines: string[] = doc.splitTextToSize(label, boxW - 2);
        llines.slice(0, 2).forEach((ll: string, li: number) => {
          doc.text(ll, bx + boxW / 2, y + 11 + li * 3, { align: "center" });
        });
      });
      y += 20;

      if (evaluation.valutazione || (evaluation.punti_di_forza?.length ?? 0) > 0) {
        y += 4;
        sectionBar("Valutazione AI del Progetto", VIOLET);

        labelValue("Valutazione complessiva", evaluation.valutazione || "");

        if ((evaluation.punti_di_forza?.length ?? 0) > 0) {
          checkPage(20);
          doc.setTextColor(...SLATE);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text("Punti di forza", M, y);
          y += 4;
          evaluation.punti_di_forza!.forEach((pt) => {
            checkPage(8);
            doc.setTextColor(...TEAL);
            doc.setFontSize(10);
            doc.text("✓", M, y);
            doc.setTextColor(...DARK);
            doc.setFontSize(9);
            const ptLines: string[] = doc.splitTextToSize(pt, CW - 8);
            ptLines.slice(0, 2).forEach((l: string) => {
              doc.text(l, M + 7, y);
              y += 4.5;
            });
          });
          y += 3;
        }

        if ((evaluation.rischi?.length ?? 0) > 0) {
          checkPage(20);
          doc.setTextColor(...SLATE);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text("Rischi da presidiare", M, y);
          y += 4;
          evaluation.rischi!.forEach((r) => {
            checkPage(8);
            doc.setTextColor(239, 68, 68);
            doc.setFontSize(10);
            doc.text("!", M + 1, y);
            doc.setTextColor(...DARK);
            doc.setFontSize(9);
            const rLines: string[] = doc.splitTextToSize(r, CW - 8);
            rLines.slice(0, 2).forEach((l: string) => {
              doc.text(l, M + 7, y);
              y += 4.5;
            });
          });
          y += 3;
        }

        if (evaluation.raccomandazione) {
          checkPage(22);
          doc.setFillColor(235, 247, 255);
          doc.roundedRect(M, y, CW, 18, 2, 2, "F");
          doc.setTextColor(...NAVY);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text("Raccomandazione principale", M + 4, y + 5.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...DARK);
          const recLines: string[] = doc.splitTextToSize(evaluation.raccomandazione, CW - 8).slice(0, 2);
          recLines.forEach((l: string, ri: number) => {
            doc.text(l, M + 4, y + 10.5 + ri * 4.5);
          });
          y += 22;
        }
      }

      doc.setTextColor(...SLATE);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Generato da iFAB Agentic Platform · ${new Date().toLocaleDateString("it-IT")}`,
        W / 2,
        290,
        { align: "center" }
      );

      doc.save(`iFAB_Agentic_${(proc?.name || "Roadmap").replace(/\s+/g, "_")}.pdf`);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } finally {
      setExporting(false);
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

          <div className="flex items-center justify-between pt-1">
            <a href="/tool-selection" className="text-sm text-slate hover:text-navy">← Scelta del Tool</a>
            <div className="flex gap-3">
              <button onClick={save} className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 text-navy hover:bg-slate-200 transition-colors border border-slate-200">
                Salva
              </button>
              <button
                onClick={exportPDF}
                disabled={exporting}
                className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  exported
                    ? "bg-green-500 text-white"
                    : exporting
                    ? "bg-slate-300 text-slate cursor-not-allowed"
                    : "bg-navy text-white hover:bg-deepblue"
                }`}
              >
                {exported ? "PDF scaricato!" : exporting ? "Generazione in corso..." : "Esporta PDF"}
              </button>
            </div>
          </div>
        </div>

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
