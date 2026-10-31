import OpenAI from 'openai';
import { ILLMProvider, LLMRequestOptions } from '../provider.interface.js';
import { config } from '../../../config/index.js';
import { safeParseJson } from '../../../utils/json-safe-parser.js';

export class GroqProvider implements ILLMProvider {
  public readonly name = 'groq';
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey = config.groqApiKey, model = config.groqModel) {
    if (!apiKey) {
      throw new Error(
        'Groq API key is missing. Please set GROQ_API_KEY in your .env file.'
      );
    }
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  public async generateStructured<T>(
    prompt: string,
    options: LLMRequestOptions = {}
  ): Promise<T> {
    const maxRetries = config.llmMaxRetries;
    const modelsToTry = [this.model];
    if (this.model !== 'qwen/qwen3.8-27b') {
      modelsToTry.push('qwen/qwen3.8-27b');
    }

    let lastError: any;

    for (const currentModel of modelsToTry) {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      const systemText = `${options.systemInstruction || ''}\nIMPORTANT: You must respond ONLY with raw, valid JSON starting with '{' and ending with '}'. Do NOT use markdown code fences.`;
      
      messages.push({ role: 'system', content: systemText });
      messages.push({ role: 'user', content: prompt });

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.client.chat.completions.create({
            model: currentModel,
            messages,
            temperature: options.temperature ?? 0.1,
            response_format: { type: 'json_object' },
            max_tokens: options.maxOutputTokens ?? 3500,
          });

          const text = response.choices[0]?.message?.content || '';
          if (!text) {
            throw new Error(`Groq (${currentModel}) returned an empty response.`);
          }

          return safeParseJson<T>(text);
        } catch (err: any) {
          lastError = err;

          // 1. Check if Groq returned 400 with a failed_generation string we can recover
          const failedGen = err?.error?.failed_generation || err?.failed_generation;
          if (failedGen && typeof failedGen === 'string') {
            try {
              const cleaned = failedGen.replace(/```json/gi, '').replace(/```/g, '').trim();
              const startIdx = cleaned.indexOf('{');
              const endIdx = cleaned.lastIndexOf('}');
              if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const jsonStr = cleaned.substring(startIdx, endIdx + 1);
                const parsed = JSON.parse(jsonStr) as T;
                console.log(`[Groq Provider] Successfully recovered JSON from failed_generation on ${currentModel}!`);
                return parsed;
              }
            } catch {
              // Could not parse recovery string; proceed to retry or model switch
            }
          }

          const status = err?.status;
          const msg = err?.message || '';
          const isRateLimit = status === 429 || status === 413 || msg.includes('429') || msg.includes('413') || msg.includes('TPM');
          const isTransient = isRateLimit || (status && status >= 500);

          if (isTransient && attempt < maxRetries) {
            const delayMs = Math.min(8000 * attempt, 25000);
            console.warn(`[Groq Provider] ${currentModel} rate limit (attempt ${attempt}/${maxRetries}): ${msg}. Waiting ${delayMs / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else if (status === 400) {
            // If 400 JSON validation failure on this model, switch immediately to fallback model
            console.warn(`[Groq Provider] ${currentModel} returned 400 JSON validation error. Switching to fallback model...`);
            break;
          } else {
            break;
          }
        }
      }
    }

    throw new Error(`Groq generation failed: ${lastError?.message || 'Unknown error'}`);
  }
}
