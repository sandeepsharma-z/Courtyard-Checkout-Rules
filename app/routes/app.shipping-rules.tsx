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

type MethodMapping = { id: string; name: string };
type CutoffSetting = { id: string; name: string };
type ShippingRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  shippingMethodMappingId: string;
  cutoffRuleSettingId: string;
  productTagsJson: string;
  pincodesJson: string;
  areaGroupsJson: string;
  deliveryAvailabilityText: string;
  notes: string;
};
type ShippingRenameRule = ShippingRule & { newLabel: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const data = await getRuleManagerData();
  return {
    hideRules: data.shippingHideRules,
    renameRules: data.shippingRenameRules,
    mappings: data.shippingMethodMappings,
    cutoffs: data.cutoffRuleSettings,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await handleRuleManagerAction(await request.formData());
  return redirect("/app/shipping-rules");
};

export default function ShippingRulesPage() {
  const { cutoffs, hideRules, mappings, renameRules } = useLoaderData<typeof loader>();
  const enabledHide = hideRules.filter((rule) => rule.enabled).length;
  const enabledRename = renameRules.filter((rule) => rule.enabled).length;

  return (
    <RuleManagerLayout
      badges={["Hide wins over rename", "Published schema v2", "Preview before live rollout"]}
      description="Create layered delivery customization rules using admin-configured method mappings, pincode groups, imported delivery text, and optional cutoff settings."
      metrics={[
        { label: "Method mappings", value: mappings.length },
        { label: "Active hide rules", value: enabledHide },
        { label: "Active rename rules", value: enabledRename },
      ]}
      side={
        <>
          <h2>Rule behavior</h2>
          <p>Shipping rules stay local until you publish the config snapshot. Checkout Functions read only the published Shopify-side config.</p>
          <ul>
            <li>Hide rules run before rename rules.</li>
            <li>Lower priority numbers run first.</li>
            <li>Unsupported or missing config safely no-ops.</li>
            <li>No real method names or labels are hardcoded in app logic.</li>
          </ul>
        </>
      }
      title="Shipping rule builder"
    >
      <RulePanel eyebrow="Step 1" title="Create shipping hide rule">
        <ShippingRuleForm cutoffs={cutoffs} intent="shippingHide:create" mappings={mappings} submitLabel="Create hide rule" />
      </RulePanel>

      <RulePanel eyebrow="Step 2" title="Create shipping rename rule">
        <ShippingRuleForm cutoffs={cutoffs} intent="shippingRename:create" mappings={mappings} rename submitLabel="Create rename rule" />
      </RulePanel>

      <RulePanel eyebrow="Configured" title="Shipping hide rules">
        <RuleList items={hideRules} kind="shippingHide" mappings={mappings} />
      </RulePanel>

      <RulePanel eyebrow="Configured" title="Shipping rename rules">
        <RenameRuleList items={renameRules} mappings={mappings} />
      </RulePanel>
    </RuleManagerLayout>
  );
}

function ShippingRuleForm({
  cutoffs,
  intent,
  mappings,
  rename = false,
  submitLabel,
}: {
  cutoffs: CutoffSetting[];
  intent: string;
  mappings: MethodMapping[];
  rename?: boolean;
  submitLabel: string;
}) {
  return (
    <ManagedForm intent={intent}>
      <div className="ccr-form-grid">
        <TextField label="Rule name" name="name" placeholder="Admin label for this rule" />
        <TextField defaultValue="100" help="Lower number means earlier evaluation." label="Priority" name="priority" />
      </div>
      <ToggleField label="Enabled for next published config" />
      <ConditionBox title="Shipping method condition">
        <div className="ccr-form-grid">
          <SelectField help="Create mappings from the Shipping mappings page." label="Shipping method mapping" name="shippingMethodMappingId" options={mappings} />
          <SelectField label="Cutoff setting" name="cutoffRuleSettingId" optional options={cutoffs} />
        </div>
      </ConditionBox>
      <ConditionBox title="Pincode and delivery conditions">
        <div className="ccr-form-grid">
          <TextField help="Comma-separated. Values stay as strings." label="Pincodes" name="pincodes" placeholder="PINCODE_PLACEHOLDER" textarea />
          <TextField help="Comma-separated. Use imported/admin values only." label="Area groups" name="areaGroups" placeholder="AREA_GROUP_PLACEHOLDER" textarea />
          <TextField help="Matches imported/admin-configured delivery availability text." label="Delivery availability text" name="deliveryAvailabilityText" placeholder="DELIVERY_TEXT_PLACEHOLDER" />
          <TextField help="Future-ready condition. Delivery Function currently no-ops if product tag rules are active." label="Product tags" name="productTags" placeholder="PRODUCT_TAG_PLACEHOLDER" />
        </div>
      </ConditionBox>
      {rename ? (
        <ConditionBox title="Rename output">
          <TextField help="Use admin/imported labels only, not hardcoded app logic." label="New shipping label" name="newLabel" placeholder="SHIPPING_LABEL_PLACEHOLDER" />
        </ConditionBox>
      ) : null}
      <TextField label="Notes" name="notes" placeholder="Internal review notes" textarea />
      <RuleActions label={submitLabel} />
    </ManagedForm>
  );
}

function RuleList({ items, kind, mappings }: { items: ShippingRule[]; kind: string; mappings: MethodMapping[] }) {
  if (!items.length) {
    return <EmptyState label="No shipping hide rules created yet." />;
  }

  return (
    <div className="ccr-rule-list">
      {items.map((item) => (
        <RuleCard
          actionsKind={kind}
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          meta={[`Mapping: ${mappingName(mappings, item.shippingMethodMappingId)}`, item.deliveryAvailabilityText ? `Delivery: ${item.deliveryAvailabilityText}` : "Any delivery text"]}
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

function RenameRuleList({ items, mappings }: { items: ShippingRenameRule[]; mappings: MethodMapping[] }) {
  if (!items.length) {
    return <EmptyState label="No shipping rename rules created yet." />;
  }

  return (
    <div className="ccr-rule-list">
      {items.map((item) => (
        <RuleCard
          actionsKind="shippingRename"
          enabled={item.enabled}
          id={item.id}
          key={item.id}
          meta={[`Mapping: ${mappingName(mappings, item.shippingMethodMappingId)}`, `New label: ${item.newLabel || "Not set"}`]}
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

function mappingName(mappings: MethodMapping[], id: string) {
  return mappings.find((mapping) => mapping.id === id)?.name || "Unmapped";
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
