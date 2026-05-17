import OpenAI from "openai";

/**
 * Wraps an OpenAI API call with exponential backoff on 429 RateLimitError.
 * Retries up to maxRetries times with delays of 1s, 2s, 4s before giving up.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      if (e instanceof OpenAI.RateLimitError && attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
