/**
 * Type definitions for Local LLM Chat extension
 */

export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

/**
 * OpenAI-compatible API request format
 */
export interface LLMRequestOpenAI {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * OpenAI-compatible API response format
 */
export interface LLMResponseOpenAIChoice {
  index: number;
  message: ChatMessage;
  finish_reason?: string;
}

export interface LLMResponseOpenAI {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: LLMResponseOpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Ollama native API request format (using chat endpoint)
 */
export interface LLMRequestOllama {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

/**
 * Ollama native API response format
 */
export interface LLMResponseOllama {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * File suggestion extracted from LLM response
 */
export interface FileSuggestion {
  path: string;
  content: string;
}

/**
 * Extension configuration settings
 */
export interface LLMConfig {
  apiUrl: string;
  token: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  maxHistoryMessages: number;
  requestTimeout: number;
  maxFileSize: number;
  allowWriteWithoutPrompt: boolean;
}

/**
 * LLM call options
 */
export interface LLMCallOptions {
  apiUrl: string;
  model: string;
  token: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Webview message types
 */
export type WebviewMessageType =
  | 'chat:send'
  | 'chat:append'
  | 'chat:error'
  | 'chat:clear'
  | 'file:create'
  | 'file:suggest';

export interface WebviewMessage {
  type: WebviewMessageType;
  text?: string;
  role?: Role;
  content?: string;
  message?: string;
  file?: FileSuggestion;
}
