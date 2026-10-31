export interface LLMRequestOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonSchema?: Record<string, any>;
}

export interface ILLMProvider {
  readonly name: string;
  readonly model: string;
  generateStructured<T>(
    prompt: string,
    options?: LLMRequestOptions
  ): Promise<T>;
}
