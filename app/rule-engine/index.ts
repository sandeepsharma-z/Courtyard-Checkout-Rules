import type { PublishedConfigSnapshotPayload } from "../types/published-config";
import { evaluateCutoff } from "./cutoff";
import { composeFinalOutcome } from "./outcome";
import { evaluatePaymentHide } from "./payment";
import { evaluatePincode } from "./pincode";
import { evaluateProductRestrictions } from "./product-tags";
import { evaluateShippingHide, evaluateShippingRename } from "./shipping";
import type { RuleEngineInputs, RuleEngineOutcome } from "./types";

export function evaluateRulePreview(
  config: PublishedConfigSnapshotPayload,
  inputs: RuleEngineInputs,
): RuleEngineOutcome {
  const context = { config, inputs };
  const pincode = evaluatePincode(context);
  const delivery = {
    status: pincode.record ? "preview_only" : "not_matched",
    areaGroup: pincode.record?.ag ?? "",
    deliveryAvailability: pincode.record?.da ?? "",
    sameDayDeliveryRule: pincode.record?.sd ?? "",
    nextDayDeliveryRule: pincode.record?.nd ?? "",
    remarks: pincode.record?.rm ?? "",
    chargesPricingText: pincode.record?.ch ?? "",
    notes: pincode.record
      ? [
          "Delivery availability fields are imported/admin-configured strings.",
          "No live checkout delivery decision is applied in this phase.",
        ]
      : ["Delivery preview requires a matched pincode record."],
  } as const;
  const productRestrictions = evaluateProductRestrictions({
    ...context,
    pincode,
  });
  const shippingHide = evaluateShippingHide(context);
  const shippingRename = evaluateShippingRename(context);
  const paymentHide = evaluatePaymentHide(context);
  const cutoff = evaluateCutoff(context);
  const finalOutcome = composeFinalOutcome({
    pincodeMatched: pincode.status === "matched",
    delivery,
    productRestrictions,
    shippingHide,
    shippingRename,
    paymentHide,
  });

  return {
    schemaVersion: config.v,
    configRecordCount: config.pincodeData.records.length,
    pincode,
    delivery,
    productRestrictions,
    shippingHide,
    shippingRename,
    paymentHide,
    cutoff,
    finalOutcome,
  };
}
