import type { CutoffPreview, RuleEngineContext } from "./types";

const parseDisplayTime = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  const timestamp = Date.parse(trimmedValue);
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString();
};

const parseMinutes = (value: string) => {
  const trimmedValue = value.trim();
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmedValue);

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  const timestamp = Date.parse(trimmedValue);
  if (Number.isNaN(timestamp)) return null;

  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
};

export function evaluateCutoff({ config, inputs }: RuleEngineContext): CutoffPreview {
  const parsedTime = parseDisplayTime(inputs.currentTime);
  const currentMinutes = parseMinutes(inputs.currentTime);
  const matchedSettings =
    currentMinutes === null
      ? []
      : (config.rules?.cutoffSettings ?? [])
          .filter((setting) => {
            const settingMinutes = parseMinutes(setting.timeValue);
            if (settingMinutes === null) return false;

            if (setting.matchMode === "after") {
              return currentMinutes > settingMinutes;
            }
            if (setting.matchMode === "equal") {
              return currentMinutes === settingMinutes;
            }

            return currentMinutes < settingMinutes;
          })
          .map((setting) => setting.name);

  return {
    status: matchedSettings.length > 0 ? "matched" : "not_configured",
    currentTime: inputs.currentTime,
    parsedTime,
    matchedSettings,
    notes: [
      "Current time is accepted as a simulator input only.",
      matchedSettings.length > 0
        ? "Published cutoff settings matched this simulation."
        : "No published cutoff setting matched this simulation.",
      "No live cutoff behavior will run in this phase.",
    ],
  };
}
