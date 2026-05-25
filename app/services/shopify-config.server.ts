import {
  PUBLISHED_CONFIG_KEY,
  PUBLISHED_CONFIG_NAMESPACE,
  PUBLISHED_CONFIG_TYPE,
} from "../types/published-config";

type ShopifyAdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type ShopifyMetafieldsSetResponse = {
  data?: {
    metafieldsSet?: {
      metafields?: Array<{ id: string }>;
      userErrors?: Array<{ field?: string[]; message: string; code?: string }>;
    };
  };
};

type ShopifyShopResponse = {
  data?: {
    shop?: {
      id: string;
      myshopifyDomain: string;
    };
  };
};

export async function getShopIdentity(admin: ShopifyAdminClient) {
  const response = await admin.graphql(`#graphql
    query CourtyardCheckoutRulesShopIdentity {
      shop {
        id
        myshopifyDomain
      }
    }
  `);
  const json = (await response.json()) as ShopifyShopResponse;
  const shop = json.data?.shop;

  if (!shop?.id || !shop.myshopifyDomain) {
    throw new Error("Unable to read Shopify shop identity.");
  }

  return shop;
}

export async function publishConfigMetafield(input: {
  admin: ShopifyAdminClient;
  ownerId: string;
  payloadJson: string;
}) {
  const response = await input.admin.graphql(
    `#graphql
      mutation CourtyardCheckoutRulesPublishConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: input.ownerId,
            namespace: PUBLISHED_CONFIG_NAMESPACE,
            key: PUBLISHED_CONFIG_KEY,
            type: PUBLISHED_CONFIG_TYPE,
            value: input.payloadJson,
          },
        ],
      },
    },
  );
  const json = (await response.json()) as ShopifyMetafieldsSetResponse;
  const result = json.data?.metafieldsSet;
  const userErrors = result?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }

  const metafieldId = result?.metafields?.[0]?.id;
  if (!metafieldId) {
    throw new Error("Shopify did not return a published metafield ID.");
  }

  return { metafieldId };
}
