import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getRuleManagerData, handleRuleManagerAction } from "../services/rule-config-storage.server";
import {
  ChipList,
  ConditionBox,
  EmptyState,
  ManagedForm,
  RuleActions,
  RuleCard,
  RuleManagerLayout,
  RulePanel,
  TextField,
  ToggleField,
  parseJsonList,
} from "../components/rule-manager-ui";

type ProductRestrictionRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  productTagsJson: string;
  pincodesJson: string;
  areaGroupsJson: string;
  deliveryAvailabilityText: string;
  validationMessage: string;
  notes: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { productRestrictionRules } = await getRuleManagerData();
  return { rules: productRestrictionRules };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/product-restrictions");
};

export default function ProductRestrictionsPage() {
  const { rules } = useLoaderData<typeof loader>();
  const activeRules = rules.filter((rule) => rule.enabled).length;

  return (
    <RuleManagerLayout
      badges={["Validation preview", "Admin configurable", "No hardcoded tags"]}
      description="Build product restriction rules that can later block checkout when imported pincode data and admin-entered product tag conditions match."
      metrics={[
        { label: "Total rules", value: rules.length },
        { label: "Enabled", value: activeRules },
        { label: "Disabled", value: rules.length - activeRules },
      ]}
      side={
        <>
          <h2>Restriction notes</h2>
          <p>This manager prepares cart and checkout validation configuration. It does not block live checkout until a validation Function is separately approved and activated.</p>
          <ul>
            <li>Product tags come from admin input.</li>
            <li>Pincodes come from imported/admin data.</li>
            <li>Error messages stay configurable.</li>
          </ul>
        </>
      }
      title="Product restriction builder"
    >
      <RulePanel eyebrow="Create" title="Product validation rule">
        <ManagedForm intent="productRestriction:create">
          <div className="ccr-form-grid">
            <TextField label="Rule name" name="name" placeholder="Admin label for this validation rule" />
            <TextField defaultValue="100" help="Lower number means earlier evaluation." label="Priority" name="priority" />
          </div>
          <ToggleField label="Enabled for next published config" />
          <ConditionBox title="Product and pincode match">
            <div className="ccr-form-grid">
              <TextField help="Comma-separated admin-created values." label="Product tags" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" textarea />
              <TextField help="Comma-separated string values." label="Pincodes" name="pincodes" placeholder="PINCODE_PLACEHOLDER" textarea />
              <TextField help="Comma-separated imported/admin values." label="Area groups" name="areaGroups" placeholder="AREA_GROUP_PLACEHOLDER" textarea />
              <TextField help="Imported/admin-configured delivery availability text." label="Delivery availability text" name="deliveryAvailabilityText" placeholder="DELIVERY_TEXT_PLACEHOLDER" />
            </div>
          </ConditionBox>
          <ConditionBox title="Customer-facing validation message">
            <TextField label="Validation message" name="validationMessage" placeholder="VALIDATION_MESSAGE_PLACEHOLDER" textarea />
          </ConditionBox>
          <TextField label="Notes" name="notes" placeholder="Internal review notes" textarea />
          <RuleActions label="Create product restriction" />
        </ManagedForm>
      </RulePanel>

      <RulePanel eyebrow="Configured" title="Product restriction rules">
        <RuleList items={rules} />
      </RulePanel>
    </RuleManagerLayout>
  );
}

function RuleList({ items }: { items: ProductRestrictionRule[] }) {
  if (!items.length) {
    return <EmptyState label="No product restriction rules created yet." />;
  }

  return (
    <div className="ccr-rule-list">
      {items.map((item) => (
        <RuleCard
          actionsKind="productRestriction"
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          meta={[item.deliveryAvailabilityText ? `Delivery: ${item.deliveryAvailabilityText}` : "Any delivery text", item.validationMessage ? "Message configured" : "No message"]}
          notes={item.notes}
          priority={item.priority}
          title={item.name}
        >
          <ChipList items={parseJsonList(item.productTagsJson)} label="Product tags" />
          <ChipList items={parseJsonList(item.pincodesJson)} label="Pincodes" />
          <ChipList items={parseJsonList(item.areaGroupsJson)} label="Area groups" />
          {item.validationMessage ? <p className="ccr-help">Message: {item.validationMessage}</p> : null}
        </RuleCard>
      ))}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
