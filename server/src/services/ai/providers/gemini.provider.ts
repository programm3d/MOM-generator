import { GoogleGenAI } from '@google/genai';
import { ILLMProvider, LLMRequestOptions } from '../provider.interface.js';
import { config } from '../../../config/index.js';
import { safeParseJson } from '../../../utils/json-safe-parser.js';

export class GeminiProvider implements ILLMProvider {
  public readonly name = 'gemini';
  public readonly model: string;
  private client: GoogleGenAI;

  constructor(apiKey = config.geminiApiKey, model = config.llmModel) {
    if (!apiKey) {
      throw new Error(
        'Gemini API key is missing. Please set GEMINI_API_KEY in your .env file or switch to another configured provider.'
      );
    }
    this.model = model || 'gemini-3.5-flash-lite';
    this.client = new GoogleGenAI({ apiKey });
  }

  public async generateStructured<T>(
    prompt: string,
    options: LLMRequestOptions = {}
  ): Promise<T> {
    const maxRetries = config.llmMaxRetries;
    const modelsToTry = [this.model];
    if (this.model !== 'gemini-3.1-flash-lite') {
      modelsToTry.push('gemini-3.1-flash-lite');
    }

    let lastError: any;

    for (const currentModel of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const generationConfig: Record<string, any> = {
            responseMimeType: 'application/json',
            temperature: options.temperature ?? (attempt > 1 ? 0.2 : 0.1),
          };

          if (options.systemInstruction) {
            generationConfig.systemInstruction = options.systemInstruction;
          }

          const response = await this.client.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: generationConfig,
          });

          const text = response.text || '';
          if (!text) {
            throw new Error(`Gemini (${currentModel}) returned an empty response.`);
          }

          return safeParseJson<T>(text);
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code;
          const is503 = status === 503 || (err?.message && err.message.includes('503'));
          const is429 = status === 429 || (err?.message && err.message.includes('429'));
          const isSyntax = err instanceof SyntaxError || err?.message?.includes('JSON');
          const isTransient = is503 || is429 || isSyntax;

          if (isTransient && attempt < maxRetries) {
            const delayMs = isSyntax ? 1000 : Math.min(1500 * Math.pow(2, attempt), 8000);
            console.warn(
              `[Gemini Provider] ${currentModel} returned ${isSyntax ? 'malformed JSON (' + err.message + ')' : status}. Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else if (isTransient && !isSyntax) {
            console.warn(`[Gemini Provider] Switching from ${currentModel} to fallback model due to high demand...`);
            break;
          } else {
            throw err;
          }
        }
      }
    }

    throw new Error(`Gemini generation failed: ${lastError?.message || 'Unknown error'}`);
  }
}
