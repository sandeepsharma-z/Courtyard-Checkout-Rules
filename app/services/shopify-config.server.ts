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

type ShopifyPublishedConfigMetafieldResponse = {
  data?: {
    shop?: {
      metafield?: {
        id: string;
        value: string;
        updatedAt: string;
      } | null;
    };
  };
};

type ShopifyGraphqlError = {
  message: string;
};

type ShopifyFunctionsResponse = {
  data?: {
    shopifyFunctions?: {
      nodes?: Array<{
        id: string;
        title: string;
        apiType: string;
      }>;
    };
  };
  errors?: ShopifyGraphqlError[];
};

type ShopifyValidationsResponse = {
  data?: {
    validations?: {
      nodes?: Array<ShopifyValidation>;
    };
  };
  errors?: ShopifyGraphqlError[];
};

type ShopifyValidationMutationResponse = {
  data?: {
    validationCreate?: ShopifyValidationMutationResult;
    validationUpdate?: ShopifyValidationMutationResult;
  };
  errors?: ShopifyGraphqlError[];
};

type ShopifyValidationMutationResult = {
  validation?: ShopifyValidation | null;
  userErrors?: Array<{ field?: string[]; message: string; code?: string }>;
};

export type ShopifyValidation = {
  id: string;
  title: string;
  enabled: boolean;
  blockOnFailure: boolean;
  shopifyFunction: {
    id: string;
    title: string;
    apiType: string;
  };
};

const CHECKOUT_VALIDATION_TITLE = "Courtyard Checkout Validation";
const CHECKOUT_VALIDATION_HANDLE = "courtyard-checkout-validation";

function throwGraphqlErrors(errors: ShopifyGraphqlError[] | undefined) {
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }
}

function throwUserErrors(
  userErrors:
    | Array<{ field?: string[]; message: string; code?: string }>
    | undefined,
) {
  if (userErrors?.length) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}

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

export async function readPublishedConfigMetafield(admin: ShopifyAdminClient) {
  const response = await admin.graphql(
    `#graphql
      query CourtyardCheckoutRulesReadPublishedConfig($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            value
            updatedAt
          }
        }
      }
    `,
    {
      variables: {
        namespace: PUBLISHED_CONFIG_NAMESPACE,
        key: PUBLISHED_CONFIG_KEY,
      },
    },
  );
  const json = (await response.json()) as ShopifyPublishedConfigMetafieldResponse;

  return json.data?.shop?.metafield ?? null;
}

export async function getCheckoutValidationStatus(admin: ShopifyAdminClient) {
  const response = await admin.graphql(`#graphql
    query CourtyardCheckoutRulesValidationStatus {
      validations(first: 50) {
        nodes {
          id
          title
          enabled
          blockOnFailure
          shopifyFunction {
            id
            title
            apiType
          }
        }
      }
    }
  `);
  const json = (await response.json()) as ShopifyValidationsResponse;
  throwGraphqlErrors(json.errors);

  const validation =
    json.data?.validations?.nodes?.find(
      (node) =>
        node.title === CHECKOUT_VALIDATION_TITLE ||
        node.shopifyFunction.title === CHECKOUT_VALIDATION_TITLE,
    ) ?? null;

  return {
    title: CHECKOUT_VALIDATION_TITLE,
    handle: CHECKOUT_VALIDATION_HANDLE,
    validation,
    isActive: Boolean(validation?.enabled && validation.blockOnFailure),
  };
}

export async function enableCheckoutValidation(admin: ShopifyAdminClient) {
  const status = await getCheckoutValidationStatus(admin);

  if (status.validation) {
    const result = await updateCheckoutValidation(admin, status.validation.id);
    return {
      action: "updated",
      validation: result,
    };
  }

  try {
    const result = await createCheckoutValidationWithHandle(admin);
    return {
      action: "created",
      validation: result,
    };
  } catch (handleError) {
    const shopifyFunction = await findCheckoutValidationFunction(admin);

    if (!shopifyFunction) {
      throw new Error(
        "Checkout validation Function was not found on this shop. Deploy the checkout-validation extension first, then try again.",
      );
    }

    try {
      const result = await createCheckoutValidationWithFunctionId(
        admin,
        shopifyFunction.id,
      );
      return {
        action: "created",
        validation: result,
      };
    } catch (idError) {
      throw new Error(
        `Checkout validation could not be enabled. Handle attempt: ${
          handleError instanceof Error ? handleError.message : "failed"
        }. Function ID attempt: ${
          idError instanceof Error ? idError.message : "failed"
        }.`,
      );
    }
  }
}

async function updateCheckoutValidation(
  admin: ShopifyAdminClient,
  validationId: string,
) {
  const response = await admin.graphql(
    `#graphql
      mutation CourtyardCheckoutRulesUpdateValidation($id: ID!, $validation: ValidationUpdateInput!) {
        validationUpdate(id: $id, validation: $validation) {
          userErrors {
            field
            message
            code
          }
          validation {
            id
            title
            enabled
            blockOnFailure
            shopifyFunction {
              id
              title
              apiType
            }
          }
        }
      }
    `,
    {
      variables: {
        id: validationId,
        validation: {
          title: CHECKOUT_VALIDATION_TITLE,
          enable: true,
          blockOnFailure: true,
        },
      },
    },
  );
  const json = (await response.json()) as ShopifyValidationMutationResponse;
  throwGraphqlErrors(json.errors);
  throwUserErrors(json.data?.validationUpdate?.userErrors);

  const validation = json.data?.validationUpdate?.validation;
  if (!validation) {
    throw new Error("Shopify did not return an updated validation.");
  }

  return validation;
}

async function createCheckoutValidationWithHandle(admin: ShopifyAdminClient) {
  const response = await admin.graphql(
    `#graphql
      mutation CourtyardCheckoutRulesCreateValidation($validation: ValidationCreateInput!) {
        validationCreate(validation: $validation) {
          userErrors {
            field
            message
            code
          }
          validation {
            id
            title
            enabled
            blockOnFailure
            shopifyFunction {
              id
              title
              apiType
            }
          }
        }
      }
    `,
    {
      variables: {
        validation: {
          title: CHECKOUT_VALIDATION_TITLE,
          functionHandle: CHECKOUT_VALIDATION_HANDLE,
          enable: true,
          blockOnFailure: true,
        },
      },
    },
  );
  const json = (await response.json()) as ShopifyValidationMutationResponse;
  throwGraphqlErrors(json.errors);
  throwUserErrors(json.data?.validationCreate?.userErrors);

  const validation = json.data?.validationCreate?.validation;
  if (!validation) {
    throw new Error("Shopify did not return a created validation.");
  }

  return validation;
}

async function createCheckoutValidationWithFunctionId(
  admin: ShopifyAdminClient,
  functionId: string,
) {
  const response = await admin.graphql(
    `#graphql
      mutation CourtyardCheckoutRulesCreateValidation($validation: ValidationCreateInput!) {
        validationCreate(validation: $validation) {
          userErrors {
            field
            message
            code
          }
          validation {
            id
            title
            enabled
            blockOnFailure
            shopifyFunction {
              id
              title
              apiType
            }
          }
        }
      }
    `,
    {
      variables: {
        validation: {
          title: CHECKOUT_VALIDATION_TITLE,
          functionId,
          enable: true,
          blockOnFailure: true,
        },
      },
    },
  );
  const json = (await response.json()) as ShopifyValidationMutationResponse;
  throwGraphqlErrors(json.errors);
  throwUserErrors(json.data?.validationCreate?.userErrors);

  const validation = json.data?.validationCreate?.validation;
  if (!validation) {
    throw new Error("Shopify did not return a created validation.");
  }

  return validation;
}

async function findCheckoutValidationFunction(admin: ShopifyAdminClient) {
  const response = await admin.graphql(`#graphql
    query CourtyardCheckoutRulesShopifyFunctions {
      shopifyFunctions(first: 50) {
        nodes {
          id
          title
          apiType
        }
      }
    }
  `);
  const json = (await response.json()) as ShopifyFunctionsResponse;
  throwGraphqlErrors(json.errors);

  return (
    json.data?.shopifyFunctions?.nodes?.find(
      (node) => node.title === CHECKOUT_VALIDATION_TITLE,
    ) ?? null
  );
}
