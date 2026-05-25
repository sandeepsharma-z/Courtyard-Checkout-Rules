import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Fragment } from "react";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parsePublishedConfigSnapshot } from "../services/published-config-reader.server";
import { simulatePublishedConfigLookup } from "../services/rule-simulator.server";
import { readPublishedConfigMetafield } from "../services/shopify-config.server";
import type { SimulatorInputs } from "../types/rule-simulator";

const getInput = (url: URL, key: keyof SimulatorInputs) =>
  url.searchParams.get(key) ?? "";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const metafield = await readPublishedConfigMetafield(admin);
  const parsedConfig = parsePublishedConfigSnapshot(metafield?.value);
  const inputs: SimulatorInputs = {
    pincode: getInput(url, "pincode"),
    cartTotal: getInput(url, "cartTotal"),
    productTags: getInput(url, "productTags"),
    selectedShippingMethod: getInput(url, "selectedShippingMethod"),
    selectedPaymentMethod: getInput(url, "selectedPaymentMethod"),
    currentTime: getInput(url, "currentTime"),
  };
  const hasInputs = Object.values(inputs).some((value) => value.trim());
  const result =
    hasInputs && parsedConfig.status === "valid"
      ? simulatePublishedConfigLookup(parsedConfig.payload, inputs)
      : null;

  return {
    parsedConfig,
    inputs,
    result,
    hasInputs,
  };
};

export default function SimulatorPage() {
  const { parsedConfig, inputs, result, hasInputs } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Rule simulator">
      <s-section heading="Admin-only test inputs">
        <div style={{ display: "grid", gap: "1rem" }}>
          <p>
            This simulator reads the published config snapshot and performs only
            pincode lookup in this phase. It does not change checkout behavior.
          </p>
          <Form method="get">
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                maxWidth: "64rem",
              }}
            >
              <Field
                defaultValue={inputs.pincode}
                label="Pincode"
                name="pincode"
              />
              <Field
                defaultValue={inputs.cartTotal}
                label="Cart total"
                name="cartTotal"
              />
              <Field
                defaultValue={inputs.productTags}
                label="Product tags"
                name="productTags"
                placeholder="Comma-separated test tags"
              />
              <Field
                defaultValue={inputs.selectedShippingMethod}
                label="Selected shipping method"
                name="selectedShippingMethod"
              />
              <Field
                defaultValue={inputs.selectedPaymentMethod}
                label="Selected payment method"
                name="selectedPaymentMethod"
              />
              <Field
                defaultValue={inputs.currentTime}
                label="Current time"
                name="currentTime"
              />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button type="submit">Run simulation</button>
            </div>
          </Form>
        </div>
      </s-section>

      <s-section heading="Published config status">
        <p>
          Status: <strong>{parsedConfig.status}</strong>
        </p>
        {parsedConfig.errors.length > 0 && (
          <MessageList title="Errors" items={parsedConfig.errors} />
        )}
        {parsedConfig.warnings.length > 0 && (
          <MessageList title="Warnings" items={parsedConfig.warnings} />
        )}
      </s-section>

      <s-section heading="Simulation output">
        {!hasInputs ? (
          <s-paragraph>Enter test inputs and run the simulator.</s-paragraph>
        ) : parsedConfig.status !== "valid" ? (
          <s-paragraph>
            Simulation cannot run until a valid published config exists.
          </s-paragraph>
        ) : result ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            <PreviewCard
              items={[
                ["Status", result.outcome.pincode.status],
                ["Input", result.outcome.pincode.input || "not provided"],
                ["Pincode", result.outcome.pincode.record?.pc ?? "not matched"],
                ["State", result.outcome.pincode.record?.st ?? ""],
                ["District", result.outcome.pincode.record?.di ?? ""],
                ["Location", result.outcome.pincode.record?.ln ?? ""],
              ]}
              notes={result.outcome.pincode.notes}
              title="Pincode match"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.delivery.status],
                ["Area group", result.outcome.delivery.areaGroup],
                [
                  "Delivery availability",
                  result.outcome.delivery.deliveryAvailability,
                ],
                ["Same day", result.outcome.delivery.sameDayDeliveryRule],
                ["Next day", result.outcome.delivery.nextDayDeliveryRule],
                ["Remarks", result.outcome.delivery.remarks],
                ["Charge/pricing text", result.outcome.delivery.chargesPricingText],
              ]}
              notes={result.outcome.delivery.notes}
              title="Delivery availability preview"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.productRestrictions.status],
                [
                  "Input tags",
                  result.outcome.productRestrictions.inputTags.join(", "),
                ],
                [
                  "Product availability text",
                  result.outcome.productRestrictions.productAvailabilityRule,
                ],
                [
                  "Matched rules",
                  result.outcome.productRestrictions.matchedRules
                    .map((rule) => rule.name)
                    .join(", "),
                ],
                [
                  "Validation messages",
                  result.outcome.productRestrictions.validationMessages.join(
                    "; ",
                  ),
                ],
              ]}
              notes={result.outcome.productRestrictions.notes}
              title="Product tag restriction preview"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.shippingHide.status],
                [
                  "Selected shipping method",
                  result.outcome.shippingHide.selectedShippingMethod,
                ],
                [
                  "Hidden methods",
                  result.outcome.shippingHide.hiddenMethods.join(", "),
                ],
                [
                  "Matched rules",
                  result.outcome.shippingHide.matchedRules
                    .map((rule) => rule.name)
                    .join(", "),
                ],
              ]}
              notes={result.outcome.shippingHide.notes}
              title="Shipping hide preview"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.shippingRename.status],
                [
                  "Selected shipping method",
                  result.outcome.shippingRename.selectedShippingMethod,
                ],
                ["Renamed method", result.outcome.shippingRename.renamedMethod],
                [
                  "Matched rules",
                  result.outcome.shippingRename.matchedRules
                    .map((rule) => rule.name)
                    .join(", "),
                ],
              ]}
              notes={result.outcome.shippingRename.notes}
              title="Shipping rename preview"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.paymentHide.status],
                [
                  "Selected payment method",
                  result.outcome.paymentHide.selectedPaymentMethod,
                ],
                [
                  "Hidden payment methods",
                  result.outcome.paymentHide.hiddenPaymentMethods.join(", "),
                ],
                [
                  "Matched rules",
                  result.outcome.paymentHide.matchedRules
                    .map((rule) => rule.name)
                    .join(", "),
                ],
              ]}
              notes={result.outcome.paymentHide.notes}
              title="Payment hide preview"
            />

            <PreviewCard
              items={[
                ["Status", result.outcome.cutoff.status],
                ["Current time input", result.outcome.cutoff.currentTime],
                ["Parsed time", result.outcome.cutoff.parsedTime],
                [
                  "Matched settings",
                  result.outcome.cutoff.matchedSettings.join(", "),
                ],
              ]}
              notes={result.outcome.cutoff.notes}
              title="Cutoff/time preview"
            />

            <div>
              <strong>Accepted test inputs</strong>
              <ul>
                <li>Cart total: {inputs.cartTotal || "not provided"}</li>
                <li>
                  Product tags:{" "}
                  {result.parsedProductTags.length > 0
                    ? result.parsedProductTags.join(", ")
                    : "not provided"}
                </li>
                <li>
                  Selected shipping method:{" "}
                  {inputs.selectedShippingMethod || "not provided"}
                </li>
                <li>
                  Selected payment method:{" "}
                  {inputs.selectedPaymentMethod || "not provided"}
                </li>
                <li>Current time: {inputs.currentTime || "not provided"}</li>
              </ul>
            </div>

            <MessageList
              title="Final predicted outcome"
              items={result.outcome.finalOutcome.summary}
            />
          </div>
        ) : null}
      </s-section>
    </s-page>
  );
}

function Field({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue: string;
  label: string;
  name: keyof SimulatorInputs;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.35rem" }}>
      <strong>{label}</strong>
      <input
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        style={{
          border: "1px solid #d8ddd2",
          borderRadius: "6px",
          padding: "0.55rem",
        }}
        type="text"
      />
    </label>
  );
}

function MessageList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewCard({
  items,
  notes,
  title,
}: {
  items: Array<[string, string]>;
  notes: string[];
  title: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #d8ddd2",
        borderRadius: "8px",
        display: "grid",
        gap: "0.75rem",
        padding: "0.75rem",
      }}
    >
      <strong>{title}</strong>
      <dl
        style={{
          display: "grid",
          gap: "0.4rem",
          gridTemplateColumns: "14rem minmax(0, 1fr)",
          margin: 0,
        }}
      >
        {items.map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd style={{ margin: 0 }}>{value || "not available"}</dd>
          </Fragment>
        ))}
      </dl>
      <MessageList title="Notes" items={notes} />
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
