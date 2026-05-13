import Link from "next/link";

const STEPS = [
  {
    n: 1,
    href: "/portfolio",
    title: "Process Portfolio",
    sub: "Identifica 3 processi e posizionali sulla matrice impatto/difficoltà",
    time: "60 min",
    color: "border-teal",
    badge: "bg-teal",
  },
  {
    n: 2,
    href: "/mapping",
    title: "Mappatura AS-IS → TO-BE",
    sub: "Mappa il processo scelto e lascia che l'AI generi l'analisi agentificata",
    time: "70 min",
    color: "border-primary",
    badge: "bg-primary",
  },
  {
    n: 3,
    href: "/prompt-lab",
    title: "System Prompt Lab",
    sub: "Scrivi il system prompt del tuo agente e testalo live",
    time: "40 min",
    color: "border-gold",
    badge: "bg-gold",
  },
  {
    n: 4,
    href: "/roadmap",
    title: "Roadmap Sprint",
    sub: "Definisci le 3 fasi di adozione e il tuo commit per i prossimi 30 giorni",
    time: "45 min",
    color: "border-deepblue",
    badge: "bg-deepblue",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-block bg-navy text-teal text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Giornata 2
          </div>
          <h1 className="text-3xl font-bold text-navy mb-2">
            From Insight to Action
          </h1>
          <p className="text-slate text-sm max-w-md mx-auto">
            Quattro blocchi, un artefatto reale: la tua roadmap di adozione agentificata.
            Lavora in sequenza — ogni step alimenta il successivo.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <Link key={s.n} href={s.href}>
              <div className={`bg-white rounded-xl border-l-4 ${s.color} shadow-sm hover:shadow-md transition-shadow p-5 flex items-start gap-4 cursor-pointer`}>
                <span className={`${s.badge} text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                  {s.n}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-navy">{s.title}</span>
                    <span className="text-xs text-slate shrink-0">{s.time}</span>
                  </div>
                  <p className="text-sm text-slate mt-1 leading-snug">{s.sub}</p>
                </div>
                <span className="text-slate/40 text-lg mt-0.5">›</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-slate/60 mt-8">
          I tuoi dati vengono salvati localmente — rimangono sul tuo browser.
        </p>
      </div>
    </div>
  );
}
