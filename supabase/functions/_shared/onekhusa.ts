declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface OneKhusaConfig {
  baseUrl: string;
  merchantAccountNumber: number;
  capturedBy: string;
  apiToken: string;
}

export function getOneKhusaConfig(): OneKhusaConfig {
  const baseUrl = (Deno.env.get("ONEKHUSA_BASE_URL") || "https://api.onekhusa.com/sandbox/v1").replace(/\/+$/, "");
  const merchantRaw = Deno.env.get("ONEKHUSA_MERCHANT_ACCOUNT_NUMBER");
  const capturedBy = Deno.env.get("ONEKHUSA_CAPTURED_BY_EMAIL");
  const apiToken = Deno.env.get("ONEKHUSA_SECRET_KEY");

  if (!merchantRaw || !capturedBy || !apiToken) {
    throw new Error("Missing OneKhusa configuration. Required: ONEKHUSA_MERCHANT_ACCOUNT_NUMBER, ONEKHUSA_CAPTURED_BY_EMAIL, ONEKHUSA_SECRET_KEY");
  }

  const merchantAccountNumber = Number(merchantRaw);
  if (!Number.isInteger(merchantAccountNumber) || merchantAccountNumber < 10000000) {
    throw new Error("ONEKHUSA_MERCHANT_ACCOUNT_NUMBER must be a valid 8+ digit integer");
  }

  return {
    baseUrl,
    merchantAccountNumber,
    capturedBy,
    apiToken,
  };
}

export async function requestToPay(params: {
  amount: number;
  referenceNumber: string;
  description: string;
  idempotencyKey: string;
}) {
  const cfg = getOneKhusaConfig();

  const resp = await fetch(`${cfg.baseUrl}/collections/requestToPay/initiate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      "Accept-Language": "en",
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      merchantAccountNumber: cfg.merchantAccountNumber,
      transactionAmount: Number(params.amount),
      transactionDescription: params.description,
      referenceNumber: params.referenceNumber,
      capturedBy: cfg.capturedBy,
    }),
  });

  const data = await resp.json();
  return { resp, data };
}

export async function getCollectionTransaction(transactionReferenceNumber: string) {
  const cfg = getOneKhusaConfig();

  const resp = await fetch(`${cfg.baseUrl}/collections/getTransaction`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiToken}`,
      "Content-Type": "application/json",
      "Accept-Language": "en",
    },
    body: JSON.stringify({
      merchantAccountNumber: cfg.merchantAccountNumber,
      transactionReferenceNumber,
    }),
  });

  const data = await resp.json();
  return { resp, data };
}
