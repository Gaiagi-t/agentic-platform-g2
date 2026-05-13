import type { AppState } from "./types";

const KEY = "agentic-g2";

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
};

export function getState(): AppState {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    return { ...structuredClone(defaults), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaults);
  }
}

export function setState(partial: Partial<AppState>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...getState(), ...partial }));
}

export function resetState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
