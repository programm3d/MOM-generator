import { encode } from 'gpt-tokenizer';
import { ExtractionResult } from '../ingestion/extractor.interface.js';
import { SourceSegment, NormalizedTranscript } from './types.js';

export function normalizeTranscript(extraction: ExtractionResult): NormalizedTranscript {
  const segments: SourceSegment[] = [];
  const segmentMap: Record<string, SourceSegment> = {};

  let segIndex = 1;
  for (const rawSeg of extraction.segments) {
    const rawText = rawSeg.text.trim();
    if (!rawText) continue;

    // Detect speaker and timestamp patterns
    // Pattern 1: Speaker [HH:MM]: ... or Speaker [HH:MM:SS]: ...
    const timestampMatch = rawText.match(/^([A-Za-z0-9_\s]{1,40})\s*\[([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\]:\s*(.*)$/s);
    // Pattern 2: Speaker: ...
    const speakerMatch = rawText.match(/^([A-Za-z0-9_\s]{1,40}):\s*(.*)$/s);

    let speaker: string | undefined;
    let timestamp: string | undefined;
    let cleanContent = rawText;

    if (timestampMatch) {
      speaker = timestampMatch[1].trim();
      timestamp = timestampMatch[2].trim();
      cleanContent = timestampMatch[3].trim();
    } else if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      cleanContent = speakerMatch[2].trim();
    }

    const segId = `seg_${segIndex++}`;
    const segment: SourceSegment = {
      id: segId,
      text: rawText, // keep verbatim source text for evidence matching
      page: rawSeg.page,
      paragraphIndex: rawSeg.paragraphIndex,
      speaker,
      timestamp,
    };

    segments.push(segment);
    segmentMap[segId] = segment;
  }

  const fullText = segments.map((s) => s.text).join('\n\n');
  const totalTokens = encode(fullText).length;

  return {
    segments,
    segmentMap,
    fullText,
    totalTokens,
  };
}
