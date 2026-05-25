import type { CutoffPreview, RuleEngineContext } from "./types";

const parseDisplayTime = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  const timestamp = Date.parse(trimmedValue);
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString();
};

export function evaluateCutoff({ inputs }: RuleEngineContext): CutoffPreview {
  return {
    status: "not_configured",
    currentTime: inputs.currentTime,
    parsedTime: parseDisplayTime(inputs.currentTime),
    notes: [
      "Current time is accepted as a simulator input only.",
      "Published cutoff rule definitions are not available yet.",
      "No live cutoff behavior will run in this phase.",
    ],
  };
}
