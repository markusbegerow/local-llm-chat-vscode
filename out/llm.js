"use strict";
/**
 * LLM API interaction module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.callLLM = callLLM;
const utils_1 = require("./utils");
/**
 * Calls the LLM API with the provided options
 *
 * @param options - LLM call configuration options
 * @returns Promise resolving to the LLM's response text
 * @throws Error if the API call fails or times out
 */
async function callLLM(options) {
    const { apiUrl, model, token, messages, temperature = 0.7, maxTokens = 2048, timeout = 120000 } = options;
    if (!model || model.trim().length === 0) {
        throw new Error('Model name is not configured. Please set it in settings.');
    }
    // Validate API URL
    if (!apiUrl || apiUrl.trim().length === 0) {
        throw new Error('API URL is not configured. Please set it in settings.');
    }
    if (!(0, utils_1.validateUrl)(apiUrl)) {
        throw new Error(`Invalid API URL: ${apiUrl}`);
    }
    // Build headers
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token && token.trim().length > 0) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // All providers now use OpenAI-compatible format
    return await callOpenAIEndpoint(apiUrl, model, messages, headers, temperature, maxTokens, timeout);
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
//# sourceMappingURL=llm.js.map