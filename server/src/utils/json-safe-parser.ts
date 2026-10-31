import { jsonrepair } from 'jsonrepair';

/**
 * Safely parses JSON strings produced by LLMs, automatically fixing common issues
 * like unescaped quotes inside strings, trailing commas, missing brackets, and markdown fences.
 */
export function safeParseJson<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Cannot parse empty or non-string JSON response');
  }

  // 1. Remove markdown code fences if any
  let cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  // 2. Extract substring between first '{' and last '}' or '[' and ']'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Fast path: Standard native JSON.parse
  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // 4. Fallback path 1: jsonrepair
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired) as T;
    } catch {
      // 5. Fallback path 2: regex cleanup of trailing commas and control characters
      try {
        const withoutTrailingCommas = cleaned
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        const repaired2 = jsonrepair(withoutTrailingCommas);
        return JSON.parse(repaired2) as T;
      } catch (finalErr: any) {
        throw new Error(
          `JSON parsing failed: ${err.message || 'SyntaxError'}. Snippet: ${cleaned.slice(0, 150)}...`
        );
      }
    }
  }
}
