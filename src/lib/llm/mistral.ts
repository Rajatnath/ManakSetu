// Minimal Mistral La Plateforme client (REST, OpenAI-compatible endpoints).
// Used for both tender requirement extraction (chat) and embeddings.
// Keeps all retry/failover logic in one place shared by API routes and scripts.

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MistralError extends Error {
  status?: number;
}

function errorStatus(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err
    ? (err as { status?: number }).status
    : undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Chat completion with per-model retries and failover across `models`.
 * Returns the assistant content string. Throws with `status` attached on failure.
 */
export async function chatCompletionWithRetry(opts: {
  apiKey: string;
  models: string[];
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  maxRetriesPerModel?: number;
}): Promise<string> {
  const { apiKey, models, messages } = opts;
  const maxTokens = opts.maxTokens ?? 8000;
  const temperature = opts.temperature ?? 0;
  const maxRetries = opts.maxRetriesPerModel ?? 2;
  const tried: string[] = [];
  let lastError: unknown = null;

  for (const model of models) {
    tried.push(model);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        });
        if (!res.ok) {
          const err: MistralError = new Error(
            `Mistral chat failed (${res.status}): ${(await res.text()).slice(0, 300)}`
          );
          err.status = res.status;
          throw err;
        }
        const data: unknown = await res.json();
        const content = (data as { choices?: { message?: { content?: unknown } }[] })
          ?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error(`Mistral model ${model} returned an empty response.`);
        }
        return content;
      } catch (error: unknown) {
        lastError = error;
        const status = errorStatus(error);
        if (status !== undefined && !isRetryableStatus(status)) throw error;
        const isLastAttempt = attempt >= maxRetries - 1;
        if (isLastAttempt) {
          console.warn(`[${status ?? 'network'}] Mistral ${model} still unavailable after ${maxRetries} attempts; trying fallback models...`);
          break;
        }
        const delayMs = (attempt + 1) * 2000 + Math.floor(Math.random() * 1000);
        console.warn(`[${status ?? 'network'}] Mistral ${model} is temporarily unavailable. Retrying in ${(delayMs / 1000).toFixed(1)}s...`);
        await sleep(delayMs);
      }
    }
  }

  const err: MistralError = new Error(
    `${errorMessage(lastError) || 'Mistral request failed'}. Tried models: ${tried.join(', ')}.`
  );
  err.status = errorStatus(lastError);
  throw err;
}

/**
 * Embed a batch of texts with `mistral-embed` (1024 dims).
 * Returns one vector per input, in order. Throws on failure (callers fall back).
 */
export async function embedTexts(opts: {
  apiKey: string;
  model?: string;
  inputs: string[];
}): Promise<number[][]> {
  const model = opts.model ?? 'mistral-embed';
  const res = await fetch(`${MISTRAL_API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: opts.inputs }),
  });
  if (!res.ok) {
    const err: MistralError = new Error(
      `Mistral embeddings failed (${res.status}): ${(await res.text()).slice(0, 300)}`
    );
    err.status = res.status;
    throw err;
  }
  const data: unknown = await res.json();
  const vectors = ((data as { data?: { embedding?: unknown }[] }).data || []).map(
    (d) => d.embedding
  );
  if (
    vectors.length !== opts.inputs.length ||
    !vectors.every((v): v is number[] => Array.isArray(v))
  ) {
    throw new Error('Mistral embeddings returned an unexpected response shape.');
  }
  return vectors;
}
