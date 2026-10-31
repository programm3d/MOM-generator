import { ILLMProvider } from '../provider.interface.js';
import { GeminiProvider } from './gemini.provider.js';
import { GroqProvider } from './groq.provider.js';
import { config } from '../../../config/index.js';

export * from '../provider.interface.js';
export * from './gemini.provider.js';
export * from './groq.provider.js';

export function getLLMProvider(): ILLMProvider {
  const preferred = config.llmProvider;

  if (preferred === 'gemini') {
    if (config.geminiApiKey) {
      return new GeminiProvider();
    }
    if (config.groqApiKey) {
      console.warn('[AI Provider] GEMINI_API_KEY not found; falling back to configured GROQ_API_KEY.');
      return new GroqProvider();
    }
    throw new Error(
      'No LLM API key found. Please set GEMINI_API_KEY in your .env file (obtainable for free at https://aistudio.google.com/) or set GROQ_API_KEY.'
    );
  }

  if (preferred === 'groq') {
    if (config.groqApiKey) {
      return new GroqProvider();
    }
    if (config.geminiApiKey) {
      console.warn('[AI Provider] GROQ_API_KEY not found; falling back to configured GEMINI_API_KEY.');
      return new GeminiProvider();
    }
    throw new Error(
      'No LLM API key found. Please set GROQ_API_KEY in your .env file or set GEMINI_API_KEY.'
    );
  }

  throw new Error(`Unsupported LLM provider: ${preferred}`);
}
