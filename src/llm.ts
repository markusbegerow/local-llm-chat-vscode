/**
 * LLM API interaction module
 */

import {
  ChatMessage,
  LLMRequestOpenAI,
  LLMResponseOpenAI,
  LLMCallOptions
} from './types';
import { validateUrl } from './utils';

/**
 * Calls the LLM API with the provided options
 *
 * @param options - LLM call configuration options
 * @returns Promise resolving to the LLM's response text
 * @throws Error if the API call fails or times out
 */
export async function callLLM(options: LLMCallOptions): Promise<string> {
  const {
    apiUrl,
    model,
    token,
    messages,
    temperature = 0.7,
    maxTokens = 2048,
    timeout = 120000
  } = options;

  if (!model || model.trim().length === 0) {
    throw new Error('Model name is not configured. Please set it in settings.');
  }

  // Validate API URL
  if (!apiUrl || apiUrl.trim().length === 0) {
    throw new Error('API URL is not configured. Please set it in settings.');
  }

  if (!validateUrl(apiUrl)) {
    throw new Error(`Invalid API URL: ${apiUrl}`);
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // All providers now use OpenAI-compatible format
  return await callOpenAIEndpoint(
    apiUrl,
    model,
    messages,
    headers,
    temperature,
    maxTokens,
    timeout
  );
}

/**
 * Calls an OpenAI-compatible endpoint
 */
async function callOpenAIEndpoint(
  url: string,
  model: string,
  messages: ChatMessage[],
  headers: Record<string, string>,
  temperature: number,
  maxTokens: number,
  timeout: number
): Promise<string> {
  const body: LLMRequestOpenAI = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LLM API error (${response.status}): ${errorText || response.statusText}`
      );
    }

    const json = (await response.json()) as LLMResponseOpenAI;

    if (!json.choices || json.choices.length === 0) {
      throw new Error('No response choices returned from LLM');
    }

    const content = json.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content.trim();

  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds`);
    }
    throw error;
  }
}

