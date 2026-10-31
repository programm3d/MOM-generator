import { describe, it, expect } from 'vitest';
import { normalizeTranscript } from '../src/services/transcript/normalizer.js';
import { chunkTranscript } from '../src/services/transcript/chunker.js';
import { ExtractionResult } from '../src/services/ingestion/extractor.interface.js';

describe('Milestone 3: Normalization, Chunking & Source Mapping', () => {
  const sampleExtraction: ExtractionResult = {
    fullText: '',
    segments: [
      { text: 'Chair [10:00]: Welcome everyone to the quarterly sync.', paragraphIndex: 1 },
      { text: 'Alice [10:02]: The database migration plan is completed.', paragraphIndex: 2 },
      { text: 'Bob: I reviewed the security audits yesterday.', paragraphIndex: 3 },
      { text: 'Chair: Great, let us approve the migration timeline for November 15th.', paragraphIndex: 4 },
    ],
  };

  it('Normalizes transcript and assigns stable IDs and metadata', () => {
    const normalized = normalizeTranscript(sampleExtraction);

    expect(normalized.segments.length).toBe(4);
    expect(normalized.segments[0].id).toBe('seg_1');
    expect(normalized.segments[0].speaker).toBe('Chair');
    expect(normalized.segments[0].timestamp).toBe('10:00');

    expect(normalized.segments[1].id).toBe('seg_2');
    expect(normalized.segments[1].speaker).toBe('Alice');
    expect(normalized.segments[1].timestamp).toBe('10:02');

    expect(normalized.segments[2].id).toBe('seg_3');
    expect(normalized.segments[2].speaker).toBe('Bob');
    expect(normalized.segments[2].timestamp).toBeUndefined();

    expect(normalized.segmentMap['seg_1']).toBeDefined();
    expect(normalized.segmentMap['seg_1'].text).toBe('Chair [10:00]: Welcome everyone to the quarterly sync.');
    expect(normalized.totalTokens).toBeGreaterThan(0);
  });

  it('Produces a single chunk for short transcripts', () => {
    const normalized = normalizeTranscript(sampleExtraction);
    const chunks = chunkTranscript(normalized, { maxTokens: 1000, overlapTokens: 100 });

    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkIndex).toBe(1);
    expect(chunks[0].segmentIds).toEqual(['seg_1', 'seg_2', 'seg_3', 'seg_4']);
    expect(chunks[0].text).toContain('[Segment seg_1]');
    expect(chunks[0].text).toContain('[Segment seg_4]');
  });

  it('Splits long transcripts into multiple chunks with overlap', () => {
    // Generate 30 segments to trigger chunking with a small maxTokens
    const longSegments = [];
    for (let i = 1; i <= 30; i++) {
      longSegments.push({
        text: `Speaker_${i} [10:${i.toString().padStart(2, '0')}]: This is discussion item number ${i} regarding project milestones, deliverables, and resource allocation.`,
        paragraphIndex: i,
      });
    }

    const extraction: ExtractionResult = {
      fullText: '',
      segments: longSegments,
    };

    const normalized = normalizeTranscript(extraction);
    // Setting small maxTokens to force multi-chunk division
    const chunks = chunkTranscript(normalized, { maxTokens: 120, overlapTokens: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    
    // Check that every chunk has valid metadata
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx + 1);
      expect(chunk.segmentIds.length).toBeGreaterThan(0);
      expect(chunk.tokenCount).toBeLessThanOrEqual(180); // within tolerance
    });

    // Check overlap: chunk 2 should contain the tail of chunk 1
    const chunk1LastSeg = chunks[0].segmentIds[chunks[0].segmentIds.length - 1];
    expect(chunks[1].segmentIds).toContain(chunk1LastSeg);
  });
});
