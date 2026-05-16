import type { AppState } from "./types";

const PARTICIPANT_KEY = "agentic-g2-participant";

const emptyPhase = () => ({ chi: "", cosa: "", strumento: "", kpi: "" });

const defaults: AppState = {
  processes: [],
  selectedProcessId: null,
  mapping: null,
  systemPrompt: "",
  commit30: "",
  roadmap: {
    quickWin: emptyPhase(),
    scale: emptyPhase(),
    transform: emptyPhase(),
  },
  toolChoice: {
    primaryLevel: null,
    secondaryLevel: null,
    notes: "",
  },
  agenticDesign: {
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
  },
};

function dataKey(name: string): string {
  return `agentic-g2-${name.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

export function getParticipant(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PARTICIPANT_KEY);
}

export function setParticipant(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARTICIPANT_KEY, name.trim());
}

export function clearParticipant(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PARTICIPANT_KEY);
}

function activeKey(): string {
  if (typeof window === "undefined") return "agentic-g2";
  const participant = getParticipant();
  return participant ? dataKey(participant) : "agentic-g2";
}

export function getState(): AppState {
  if (typeof window === "undefined") return structuredClone(defaults);
  try {
    const raw = localStorage.getItem(activeKey());
    if (!raw) return structuredClone(defaults);
    return { ...structuredClone(defaults), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaults);
  }
}

export function setState(partial: Partial<AppState>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(activeKey(), JSON.stringify({ ...getState(), ...partial }));
}

export function resetState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(activeKey());
}
