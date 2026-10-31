import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root or server directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config(); // fallback to local server/.env if present

export interface AppConfig {
  nodeEnv: string;
  port: number;
  clientOrigin: string;
  uploadMaxMb: number;
  tempDir: string;
  jobRetentionMinutes: number;
  
  // LLM Config
  llmProvider: 'gemini' | 'groq' | 'openai';
  llmModel: string;
  geminiApiKey: string;
  groqApiKey: string;
  groqModel: string;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  llmMaxConcurrency: number;

  // Chunking Config
  chunkMaxTokens: number;
  chunkOverlapTokens: number;
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadMaxMb: parseInt(process.env.UPLOAD_MAX_MB || '25', 10),
  tempDir: path.resolve(process.cwd(), process.env.TEMP_DIR || './tmp'),
  jobRetentionMinutes: parseInt(process.env.JOB_RETENTION_MINUTES || '120', 10),

  llmProvider: (process.env.LLM_PROVIDER as any) || 'gemini',
  llmModel: process.env.LLM_MODEL || 'gemini-3.5-flash-lite',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '120000', 10),
  llmMaxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
  llmMaxConcurrency: parseInt(process.env.LLM_MAX_CONCURRENCY || '2', 10),

  chunkMaxTokens: parseInt(process.env.CHUNK_MAX_TOKENS || '12000', 10),
  chunkOverlapTokens: parseInt(process.env.CHUNK_OVERLAP_TOKENS || '400', 10),
};
