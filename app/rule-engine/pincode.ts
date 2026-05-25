import type { RuleEngineContext } from "./types";

export function evaluatePincode({ config, inputs }: RuleEngineContext) {
  const input = inputs.pincode.trim();
  const record =
    config.pincodeData.records.find((pincodeRecord) => pincodeRecord.pc === input) ??
    null;

  return {
    status: record ? "matched" : "not_matched",
    input,
    record,
    notes: record
      ? ["Pincode matched a published config record."]
      : ["No published pincode record matched the simulator input."],
  } as const;
}
