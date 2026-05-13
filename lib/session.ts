declare global {
  // eslint-disable-next-line no-var
  var _sessionStep: number | undefined;
}

export function getSessionStep(): number {
  return globalThis._sessionStep ?? 0;
}

export function setSessionStep(step: number): void {
  globalThis._sessionStep = step;
}
