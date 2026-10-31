import { ILLMProvider } from './provider.interface.js';
import { TranscriptChunk } from '../transcript/types.js';
import {
  ChunkExtractionResult,
  ChunkExtractionResultSchema,
  CHUNK_EXTRACTION_JSON_SCHEMA,
} from '../validation/schemas.js';
import {
  CHUNK_EXTRACTION_SYSTEM_PROMPT,
  buildChunkExtractionPrompt,
} from './prompts/chunk-extraction.js';

export async function extractChunkFacts(
  chunk: TranscriptChunk,
  totalChunks: number,
  provider: ILLMProvider
): Promise<ChunkExtractionResult> {
  const prompt = buildChunkExtractionPrompt(chunk.text, chunk.chunkIndex, totalChunks);

  let rawOutput: any;
  try {
    rawOutput = await provider.generateStructured<any>(prompt, {
      systemInstruction: CHUNK_EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.1,
      jsonSchema: CHUNK_EXTRACTION_JSON_SCHEMA,
    });
  } catch (err: any) {
    console.warn(
      `[Extraction Warning] Chunk ${chunk.chunkIndex} failed initial extraction: ${err.message}. Retrying with strict JSON instruction...`
    );
    try {
      rawOutput = await provider.generateStructured<any>(
        `${prompt}\n\nIMPORTANT: Output strictly valid JSON. NEVER use unescaped double quotes inside text; use single quotes (') for terms and names.`,
        {
          systemInstruction: CHUNK_EXTRACTION_SYSTEM_PROMPT,
          temperature: 0.2,
          jsonSchema: CHUNK_EXTRACTION_JSON_SCHEMA,
        }
      );
    } catch (secondErr: any) {
      console.error(
        `[Extraction Error] Chunk ${chunk.chunkIndex} recovery failed: ${secondErr.message}. Falling back to safe summary chunk.`
      );
      return {
        candidateMeetingTitle: null,
        candidateMeetingDate: null,
        candidateMeetingTime: null,
        candidateMeetingMode: null,
        candidateAttendees: null,
        candidateNotes: null,
        agendas: [
          {
            agendaPoint: `${chunk.chunkIndex}.1`,
            agenda: `Discussion in Transcript Chunk ${chunk.chunkIndex}`,
            discussionPoints: [
              `Discussion held across chunk segments (${chunk.segmentIds[0] || 'start'} to ${chunk.segmentIds[chunk.segmentIds.length - 1] || 'end'}).`,
            ],
            wayForward: ['Review recording and action items for this section.'],
            decisionMade: 'Not specified',
            responsiblePerson: 'Not specified',
            timeline: 'Not specified',
            evidence: [],
            uncertaintyNotes: [],
          },
        ],
      };
    }
  }

  // Runtime Zod validation
  const parsed = ChunkExtractionResultSchema.safeParse(rawOutput);
  if (parsed.success) {
    return parsed.data;
  }

  // Attempt 1 repair if schema validation failed
  console.warn(
    `[Validation Warning] Chunk ${chunk.chunkIndex} output failed initial schema validation: ${parsed.error.message}. Attempting repair...`
  );

  const repairPrompt = `The previous JSON response did not match the required schema:
Validation errors:
${JSON.stringify(parsed.error.errors, null, 2)}

Original chunk text:
${chunk.text}

Please fix the output to strictly match the requested JSON schema.`;

  const repairedOutput = await provider.generateStructured<any>(repairPrompt, {
    systemInstruction: CHUNK_EXTRACTION_SYSTEM_PROMPT,
    temperature: 0.0,
  });

  return ChunkExtractionResultSchema.parse(repairedOutput);
}
