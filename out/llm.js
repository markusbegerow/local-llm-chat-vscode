"use strict";
/**
 * LLM API interaction module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecretToken = getSecretToken;
exports.setSecretToken = setSecretToken;
exports.callLLM = callLLM;
const utils_1 = require("./utils");
/**
 * Secret storage key for API token
 */
const SECRET_KEY = 'localLLM.apiToken';
/**
 * Retrieves the stored API token from secure storage
 */
async function getSecretToken(context) {
    return context.secrets.get(SECRET_KEY);
}
/**
 * Stores the API token in secure storage
 */
async function setSecretToken(context, value) {
    if (value && value.trim().length > 0) {
        await context.secrets.store(SECRET_KEY, value);
    }
    else {
        // Clear token if empty string provided
        await context.secrets.delete(SECRET_KEY);
    }
}
/**
 * Calls the LLM API with the provided options
 *
 * @param options - LLM call configuration options
 * @returns Promise resolving to the LLM's response text
 * @throws Error if the API call fails or times out
 */
async function callLLM(options) {
    const { apiUrl, apiCompat, model, token, messages, customEndpoint, temperature = 0.7, maxTokens = 2048, timeout = 120000 } = options;
    if (!model || model.trim().length === 0) {
        throw new Error('Model name is not configured. Please set it in settings.');
    }
    // Build headers
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token && token.trim().length > 0) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // Use custom endpoint if provided
    if (customEndpoint && customEndpoint.trim().length > 0) {
        if (!(0, utils_1.validateUrl)(customEndpoint)) {
            throw new Error(`Invalid custom endpoint URL: ${customEndpoint}`);
        }
        return await callOpenAIEndpoint(customEndpoint, model, messages, headers, temperature, maxTokens, timeout);
    }
    // Validate API URL
    if (!apiUrl || apiUrl.trim().length === 0) {
        throw new Error('API URL is not configured. Please set it in settings.');
    }
    if (!(0, utils_1.validateUrl)(apiUrl)) {
        throw new Error(`Invalid API URL: ${apiUrl}`);
    }
    // Call appropriate endpoint based on compatibility mode
    if (apiCompat === 'openai') {
        const url = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
        return await callOpenAIEndpoint(url, model, messages, headers, temperature, maxTokens, timeout);
    }
    else {
        // Ollama native API - use /api/chat endpoint for proper conversation support
        const url = apiUrl.replace(/\/$/, '') + '/api/chat';
        return await callOllamaEndpoint(url, model, messages, headers, temperature, maxTokens, timeout);
    }
}
/**
 * Calls an OpenAI-compatible endpoint
 */
async function callOpenAIEndpoint(url, model, messages, headers, temperature, maxTokens, timeout) {
    const body = {
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
            throw new Error(`LLM API error (${response.status}): ${errorText || response.statusText}`);
        }
        const json = (await response.json());
        if (!json.choices || json.choices.length === 0) {
            throw new Error('No response choices returned from LLM');
        }
        const content = json.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from LLM');
        }
        return content.trim();
    }
    catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000} seconds`);
        }
        throw error;
    }
}
/**
 * Calls the Ollama native /api/chat endpoint
 * This properly supports conversation history unlike /api/generate
 */
async function callOllamaEndpoint(url, model, messages, headers, temperature, maxTokens, timeout) {
    const body = {
        model,
        messages,
        stream: false,
        options: {
            temperature,
            num_predict: maxTokens
        }
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
            throw new Error(`Ollama API error (${response.status}): ${errorText || response.statusText}`);
        }
        const json = (await response.json());
        if (!json.message || !json.message.content) {
            throw new Error('Empty response from Ollama');
        }
        return json.message.content.trim();
    }
    catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000} seconds`);
        }
        throw error;
    }
}
//# sourceMappingURL=llm.js.map