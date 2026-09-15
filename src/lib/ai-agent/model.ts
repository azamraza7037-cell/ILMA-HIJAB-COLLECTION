import type { AIModel, AIRequest, AIResponse } from './types';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_TIMEOUT_MS = 20000;

class OllamaModel implements AIModel {
  async generate(input: AIRequest): Promise<AIResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: input.system
            ? [{ role: 'system', content: input.system }, ...input.messages]
            : input.messages,
          stream: false,
          ...(input.json ? { format: 'json' } : {}),
          options: {
            temperature: input.temperature ?? 0.2,
            num_predict: input.maxTokens ?? 512,
          },
        }),
      });

      if (!res.ok) {
        return {
          text: '',
          model: OLLAMA_MODEL,
          provider: 'ollama',
          ok: false,
          error: `Ollama HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as { message?: { content?: string } };
      const text = data?.message?.content || '';
      if (!text.trim()) {
        return { text: '', model: OLLAMA_MODEL, provider: 'ollama', ok: false, error: 'Empty response' };
      }
      return { text, model: OLLAMA_MODEL, provider: 'ollama', ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { text: '', model: OLLAMA_MODEL, provider: 'ollama', ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

class OpenAIModel implements AIModel {
  async generate(input: AIRequest): Promise<AIResponse> {
    if (!OPENAI_API_KEY) {
      return { text: '', model: 'none', provider: 'openai', ok: false, error: 'OPENAI_API_KEY not configured' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: input.system
            ? [{ role: 'system', content: input.system }, ...input.messages]
            : input.messages,
          ...(input.json ? { response_format: { type: 'json_object' } } : {}),
          max_tokens: input.maxTokens ?? 512,
          temperature: input.temperature ?? 0.2,
        }),
      });

      if (!res.ok) {
        return {
          text: '',
          model: 'gpt-4o-mini',
          provider: 'openai',
          ok: false,
          error: `OpenAI HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text.trim()) {
        return { text: '', model: 'gpt-4o-mini', provider: 'openai', ok: false, error: 'Empty response' };
      }
      return { text, model: 'gpt-4o-mini', provider: 'openai', ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { text: '', model: 'gpt-4o-mini', provider: 'openai', ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function ollamaHealthCheck(timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    return Array.isArray(data.models);
  } catch {
    return false;
  }
}

/**
 * Model chain: local Ollama (qwen2.5-coder) first, then OpenAI only if a key
 * is already configured, otherwise a not-ok response signals the caller to use
 * the deterministic fallback path. Business logic never depends on a specific
 * provider.
 */
export const model: AIModel = {
  async generate(input: AIRequest): Promise<AIResponse> {
    if (await ollamaHealthCheck()) {
      const ollamaRes = await new OllamaModel().generate(input);
      if (ollamaRes.ok) return ollamaRes;
    }
    if (OPENAI_API_KEY) {
      const openaiRes = await new OpenAIModel().generate(input);
      if (openaiRes.ok) return openaiRes;
    }
    return {
      text: '',
      model: 'none',
      provider: 'none',
      ok: false,
      error: 'No AI model available (Ollama unreachable, no OpenAI key configured)',
    };
  },
};

export async function getModelInfo(): Promise<{
  primary: string;
  provider: string;
  available: boolean;
  fallback: string;
}> {
  const available = await ollamaHealthCheck();
  return {
    primary: OLLAMA_MODEL,
    provider: 'ollama',
    available,
    fallback: OPENAI_API_KEY ? 'openai:gpt-4o-mini → deterministic' : 'deterministic engine',
  };
}
