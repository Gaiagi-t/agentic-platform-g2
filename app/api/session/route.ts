import { getSessionStep, setSessionStep } from "@/lib/session";

export async function GET() {
  return Response.json({ step: getSessionStep() });
}

export async function POST(request: Request) {
  const { step, pin } = await request.json();
  const adminPin = process.env.ADMIN_PIN ?? "IFAB2026";
  if (pin !== adminPin) {
    return Response.json({ error: "PIN non valido" }, { status: 401 });
  }
  if (typeof step === "number" && step >= 0 && step <= 4) {
    setSessionStep(step);
  }
  return Response.json({ step: getSessionStep() });
}
