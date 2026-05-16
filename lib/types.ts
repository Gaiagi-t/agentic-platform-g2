export interface Process {
  id: string;
  name: string;
  description: string;
  impatto: "alto" | "basso";
  facilita: "facile" | "difficile";
  analyzed?: boolean;
  aiExplanation?: string;
  manuallyMoved?: boolean;
}

export interface ASISStep {
  nome: string;
  chi: string;
  strumenti: string;
  tempo: string;
}

export interface ComparisoRow {
  dimensione: string;
  asis: string;
  tobe: string;
}

export interface AIAnalysis {
  pattern: string;
  vision: string;
  input: string;
  output: string;
  autonomia: string;
  approccio: "Sostituzione" | "Augmentation";
  score: number;
  rischi: string[];
  fattibilita: string;
  timeline: string;
  quick_win: string;
  confronto: ComparisoRow[];
}

export interface Mapping {
  processId: string;
  asis: {
    steps: ASISStep[];
    painPoints: string;
  };
  tobe: AIAnalysis | null;
}

export interface RoadmapPhase {
  chi: string;
  cosa: string;
  strumento: string;
  kpi: string;
}

export interface AgenticDesign {
  systemPrompt: string;
  tools: string[];
  toolsCustom: string;
  mcpServers: string;
  memorySTM: string;
  memoryLTM: string;
  guardrails: string[];
  guardrailsCustom: string;
  hitlPoints: string;
  flussiAuto: string;
}

export interface AppState {
  processes: Process[];
  selectedProcessId: string | null;
  mapping: Mapping | null;
  systemPrompt: string;
  commit30: string;
  roadmap: {
    quickWin: RoadmapPhase;
    scale: RoadmapPhase;
    transform: RoadmapPhase;
  };
  agenticDesign: AgenticDesign;
}
