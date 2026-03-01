import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

type PostWebhookOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postWebhookJson(
  url: string,
  payload: Record<string, unknown>,
  options: PostWebhookOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Webhook status ${response.status}`);
      }

      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(retryDelayMs);
      }
    }
  }

  throw lastError;
}
