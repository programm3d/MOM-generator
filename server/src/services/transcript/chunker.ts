import { encode } from 'gpt-tokenizer';
import { NormalizedTranscript, TranscriptChunk, SourceSegment } from './types.js';
import { config } from '../../config/index.js';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export function chunkTranscript(
  transcript: NormalizedTranscript,
  options: ChunkOptions = {}
): TranscriptChunk[] {
  const maxTokens = options.maxTokens ?? config.chunkMaxTokens;
  const overlapTokens = options.overlapTokens ?? config.chunkOverlapTokens;

  const segments = transcript.segments;
  if (segments.length === 0) {
    return [];
  }

  // Pre-calculate token counts for each segment with marker
  const segmentData = segments.map((seg) => {
    const formatted = `[Segment ${seg.id}] ${seg.text}`;
    const tokenCount = encode(formatted).length;
    return {
      segment: seg,
      formatted,
      tokens: tokenCount,
    };
  });

  const chunks: TranscriptChunk[] = [];
  let currentChunkSegments: SourceSegment[] = [];
  let currentChunkFormattedTexts: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 1;

  for (let i = 0; i < segmentData.length; i++) {
    const item = segmentData[i];

    // If adding this segment exceeds maxTokens and we already have segments in the chunk
    if (currentTokens + item.tokens > maxTokens && currentChunkSegments.length > 0) {
      // Save current chunk
      chunks.push({
        chunkIndex: chunkIndex++,
        text: currentChunkFormattedTexts.join('\n\n'),
        tokenCount: currentTokens,
        segmentIds: currentChunkSegments.map((s) => s.id),
        segments: [...currentChunkSegments],
      });

      // Compute overlap: roll back segments from the end of current chunk that fit within overlapTokens
      let overlapAccumulator = 0;
      const overlapSegments: SourceSegment[] = [];
      const overlapTexts: string[] = [];

      for (let j = currentChunkSegments.length - 1; j >= 0; j--) {
        const segTokens = encode(currentChunkFormattedTexts[j]).length;
        if (overlapAccumulator + segTokens <= overlapTokens) {
          overlapAccumulator += segTokens;
          overlapSegments.unshift(currentChunkSegments[j]);
          overlapTexts.unshift(currentChunkFormattedTexts[j]);
        } else {
          break;
        }
      }

      currentChunkSegments = [...overlapSegments, item.segment];
      currentChunkFormattedTexts = [...overlapTexts, item.formatted];
      currentTokens = overlapAccumulator + item.tokens;
    } else {
      currentChunkSegments.push(item.segment);
      currentChunkFormattedTexts.push(item.formatted);
      currentTokens += item.tokens;
    }
  }

  // Final chunk
  if (currentChunkSegments.length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      text: currentChunkFormattedTexts.join('\n\n'),
      tokenCount: currentTokens,
      segmentIds: currentChunkSegments.map((s) => s.id),
      segments: [...currentChunkSegments],
    });
  }

  return chunks;
}
