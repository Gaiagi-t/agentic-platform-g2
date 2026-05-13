# Agentic AI for Business — Piattaforma Giornata 2

Workshop platform per la Masterclass IFAB "Agentic AI for Business" — Giornata 2: *From Insight to Action*.

## Step del workshop

| # | Route | Contenuto |
|---|---|---|
| 1 | `/portfolio` | Process Portfolio — 3 processi + matrice 2x2 impatto/difficoltà |
| 2 | `/mapping` | Mappatura AS-IS → TO-BE con analisi AI (Claude) |
| 3 | `/prompt-lab` | System Prompt Lab con test live in streaming |
| 4 | `/roadmap` | Roadmap Sprint 0-3m / 3-12m / 12-24m + Export PDF |

I dati di ogni partecipante vengono salvati in **localStorage** — rimangono sul browser, nessun dato inviato a server esterni ad eccezione delle chiamate AI.

## Setup locale

```bash
git clone https://github.com/Gaiagi-t/agentic-platform-g2
cd agentic-platform-g2
npm install
cp env.example .env.local
# Inserisci ANTHROPIC_API_KEY in .env.local
npm run dev
```

Apri `http://localhost:3000`

## Deploy su Vercel

1. Vai su [vercel.com](https://vercel.com) → **Add New Project** → importa `agentic-platform-g2`
2. Nella sezione **Environment Variables** aggiungi:
   ```
   ANTHROPIC_API_KEY = sk-ant-...
   ```
3. Clicca **Deploy**

Le API routes richiedono un runtime Node.js — Vercel le gestisce nativamente con Next.js.

## Variabili d'ambiente

| Variabile | Dove ottenerla |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
