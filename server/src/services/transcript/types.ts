export interface SourceSegment {
  id: string;
  text: string;
  page?: number;
  paragraphIndex: number;
  speaker?: string;
  timestamp?: string;
}

export interface TranscriptChunk {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  segmentIds: string[];
  segments: SourceSegment[];
}

export interface NormalizedTranscript {
  segments: SourceSegment[];
  segmentMap: Record<string, SourceSegment>;
  fullText: string;
  totalTokens: number;
}
