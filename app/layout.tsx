import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic AI for Business — Giornata 2",
  description: "Piattaforma workshop IFAB — Masterclass Agentic AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#f8fafc]">
        <header className="bg-navy text-white px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base tracking-widest">
              <span className="text-teal">i</span>FAB
            </span>
            <span className="text-white/30 mx-2">|</span>
            <span className="text-white/80 text-sm">Masterclass Agentic AI · Giornata 2</span>
          </div>
          <span className="text-white/40 text-xs">From Insight to Action</span>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
