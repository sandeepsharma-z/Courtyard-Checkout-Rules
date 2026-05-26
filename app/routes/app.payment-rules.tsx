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
  SelectField,
  TextField,
  ToggleField,
  parseJsonList,
} from "../components/rule-manager-ui";

type Option = { id: string; name: string };
type PaymentHideRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  paymentMethodMappingId: string;
  cutoffRuleSettingId: string;
  selectedShippingContains: string;
  productTagsJson: string;
  pincodesJson: string;
  areaGroupsJson: string;
  deliveryAvailabilityText: string;
  notes: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const data = await getRuleManagerData();
  return { rules: data.paymentHideRules, mappings: data.paymentMethodMappings, cutoffs: data.cutoffRuleSettings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/payment-rules");
};

export default function PaymentRulesPage() {
  const { cutoffs, mappings, rules } = useLoaderData<typeof loader>();
  const activeRules = rules.filter((rule) => rule.enabled).length;

  return (
    <RuleManagerLayout
      badges={["Preview-only until payment Function", "Admin method mappings", "Config snapshot ready"]}
      description="Prepare payment hide rules using payment mappings, selected shipping text, pincode conditions, area groups, and optional cutoff settings."
      metrics={[
        { label: "Payment mappings", value: mappings.length },
        { label: "Enabled rules", value: activeRules },
        { label: "Total rules", value: rules.length },
      ]}
      side={
        <>
          <h2>Payment scope</h2>
          <p>Payment rules are stored and published as configuration only. They do not affect live payment methods until a payment customization Function is separately approved.</p>
          <ul>
            <li>Payment names come from mappings.</li>
            <li>Shipping text conditions are admin-entered.</li>
            <li>No payment Function exists yet.</li>
          </ul>
        </>
      }
      title="Payment hide rule builder"
    >
      <RulePanel eyebrow="Create" title="Payment hide rule">
        <ManagedForm intent="paymentHide:create">
          <div className="ccr-form-grid">
            <TextField label="Rule name" name="name" placeholder="Admin label for this payment rule" />
            <TextField defaultValue="100" help="Lower number means earlier evaluation." label="Priority" name="priority" />
          </div>
          <ToggleField label="Enabled for next published config" />
          <ConditionBox title="Payment and shipping conditions">
            <div className="ccr-form-grid">
              <SelectField label="Payment method mapping" name="paymentMethodMappingId" options={mappings} />
              <SelectField label="Cutoff setting" name="cutoffRuleSettingId" optional options={cutoffs} />
              <TextField help="Admin-entered string match against selected shipping method." label="Selected shipping contains" name="selectedShippingContains" placeholder="SHIPPING_METHOD_TEXT_PLACEHOLDER" />
              <TextField help="Imported/admin-configured delivery availability text." label="Delivery availability text" name="deliveryAvailabilityText" placeholder="DELIVERY_TEXT_PLACEHOLDER" />
            </div>
          </ConditionBox>
          <ConditionBox title="Pincode and product conditions">
            <div className="ccr-form-grid">
              <TextField label="Pincodes" name="pincodes" placeholder="PINCODE_PLACEHOLDER" textarea />
              <TextField label="Area groups" name="areaGroups" placeholder="AREA_GROUP_PLACEHOLDER" textarea />
              <TextField label="Product tags" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" />
            </div>
          </ConditionBox>
          <TextField label="Notes" name="notes" placeholder="Internal review notes" textarea />
          <RuleActions label="Create payment hide rule" />
        </ManagedForm>
      </RulePanel>

      <RulePanel eyebrow="Configured" title="Payment hide rules">
        <RuleList items={rules} mappings={mappings} />
      </RulePanel>
    </RuleManagerLayout>
  );
}

function RuleList({ items, mappings }: { items: PaymentHideRule[]; mappings: Option[] }) {
  if (!items.length) {
    return <EmptyState label="No payment hide rules created yet." />;
  }

  return (
    <div className="ccr-rule-list">
      {items.map((item) => (
        <RuleCard
          actionsKind="paymentHide"
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          meta={[`Mapping: ${mappingName(mappings, item.paymentMethodMappingId)}`, item.selectedShippingContains ? `Shipping contains: ${item.selectedShippingContains}` : "Any shipping text"]}
          notes={item.notes}
          priority={item.priority}
          title={item.name}
        >
          <ChipList items={parseJsonList(item.pincodesJson)} label="Pincodes" />
          <ChipList items={parseJsonList(item.areaGroupsJson)} label="Area groups" />
          <ChipList items={parseJsonList(item.productTagsJson)} label="Product tags" />
        </RuleCard>
      ))}
    </div>
  );
}

function mappingName(mappings: Option[], id: string) {
  return mappings.find((mapping) => mapping.id === id)?.name || "Unmapped";
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
