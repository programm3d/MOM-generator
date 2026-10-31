import { describe, it, expect } from 'vitest';
import {
  MeetingMinutesSchema,
  ChunkExtractionResultSchema,
  validateAndEnrichEvidence,
} from '../src/services/validation/index.js';
import { NormalizedTranscript } from '../src/services/transcript/types.js';
import { ILLMProvider } from '../src/services/ai/provider.interface.js';
import { extractChunkFacts } from '../src/services/ai/extract-chunk.js';
import { consolidateMinutes } from '../src/services/ai/consolidate.js';

describe('Milestone 4: LLM Extraction, Consolidation & Evidence Validation', () => {
  const dummyTranscript: NormalizedTranscript = {
    fullText: 'Alice: We have chosen AWS.\nBob: I will configure the VPC by Friday.',
    totalTokens: 25,
    segments: [
      {
        id: 'seg_1',
        text: 'Alice: We have chosen AWS.',
        paragraphIndex: 1,
        speaker: 'Alice',
      },
      {
        id: 'seg_2',
        text: 'Bob: I will configure the VPC by Friday.',
        paragraphIndex: 2,
        speaker: 'Bob',
      },
    ],
    segmentMap: {
      seg_1: {
        id: 'seg_1',
        text: 'Alice: We have chosen AWS.',
        paragraphIndex: 1,
        speaker: 'Alice',
      },
      seg_2: {
        id: 'seg_2',
        text: 'Bob: I will configure the VPC by Friday.',
        paragraphIndex: 2,
        speaker: 'Bob',
      },
    },
  };

  it('Validates schema for correct meeting minutes output', () => {
    const validData = {
      meetingTitle: 'Cloud Migration Sync',
      meetingDate: '2026-10-20',
      minutes: [
        {
          agendaNo: 1,
          agenda: 'Cloud Provider Selection',
          discussionPoints: ['Evaluated AWS vs GCP', 'AWS chosen due to existing tooling'],
          decisionMade: 'Selected AWS as primary provider',
          responsiblePerson: 'Bob',
          timeline: 'By Friday',
          evidence: [
            {
              quote: 'We have chosen AWS.',
              sourceSegmentId: 'seg_1',
              supportsField: 'decision',
            },
          ],
          uncertaintyNotes: [],
        },
      ],
    };

    const parsed = MeetingMinutesSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('Evidence validator accepts verbatim quotes and enriches metadata', () => {
    const minutes = [
      {
        agendaNo: 1,
        agenda: 'Cloud Setup',
        discussionPoints: ['Discussed VPC setup'],
        decisionMade: 'Setup VPC',
        responsiblePerson: 'Bob',
        timeline: 'By Friday',
        evidence: [
          {
            quote: 'We have chosen AWS.',
            sourceSegmentId: 'seg_1',
            supportsField: 'decision' as const,
          },
          {
            quote: 'I will configure the VPC by Friday.',
            sourceSegmentId: 'seg_2',
            supportsField: 'timeline' as const,
          },
        ],
        uncertaintyNotes: [],
      },
    ];

    const { validatedItems, report } = validateAndEnrichEvidence(minutes, dummyTranscript);
    expect(report.totalEvidenceQuotes).toBe(2);
    expect(report.validQuotes).toBe(2);
    expect(report.invalidQuotes).toBe(0);
    expect(validatedItems[0].evidence[0].sourceParagraph).toBe(1);
    expect(validatedItems[0].evidence[1].sourceParagraph).toBe(2);
  });

  it('Evidence validator filters out hallucinated or mismatched quotes', () => {
    const minutes = [
      {
        agendaNo: 1,
        agenda: 'Cloud Setup',
        discussionPoints: ['Discussed setup'],
        decisionMade: 'Azure migration',
        responsiblePerson: 'Not specified',
        timeline: 'Not specified',
        evidence: [
          {
            quote: 'This sentence never existed in the source transcript.',
            sourceSegmentId: 'seg_1',
            supportsField: 'decision' as const,
          },
          {
            quote: 'Real quote',
            sourceSegmentId: 'seg_999_non_existent',
            supportsField: 'decision' as const,
          },
        ],
        uncertaintyNotes: [],
      },
    ];

    const { validatedItems, report } = validateAndEnrichEvidence(minutes, dummyTranscript);
    expect(report.invalidQuotes).toBe(2);
    expect(report.validQuotes).toBe(0);
    expect(validatedItems[0].evidence.length).toBe(0);
  });

  it('ExtractChunkFacts parses structured output through provider', async () => {
    const mockProvider: ILLMProvider = {
      name: 'mock',
      model: 'mock-model',
      generateStructured: async () => ({
        candidateMeetingTitle: 'Tech Sync',
        candidateMeetingDate: '2026-10-22',
        agendas: [
          {
            agenda: 'Architecture',
            discussionPoints: ['Review system diagrams'],
            decisionMade: 'Approved diagrams',
            responsiblePerson: 'Alice',
            timeline: 'Next sprint',
            evidence: [],
            uncertaintyNotes: [],
          },
        ],
      }),
    };

    const chunk = {
      chunkIndex: 1,
      text: '[Segment seg_1] Alice: Diagrams approved.',
      tokenCount: 15,
      segmentIds: ['seg_1'],
      segments: [],
    };

    const result = await extractChunkFacts(chunk, 1, mockProvider);
    expect(result.candidateMeetingTitle).toBe('Tech Sync');
    expect(result.agendas.length).toBe(1);
    expect(result.agendas[0].agenda).toBe('Architecture');
  });

  it('Consolidates single chunk deterministically into 6-column minutes', async () => {
    const mockProvider: ILLMProvider = {
      name: 'mock',
      model: 'mock-model',
      generateStructured: async () => ({}),
    };

    const chunkResults = [
      {
        candidateMeetingTitle: 'Marketing Review',
        candidateMeetingDate: '2026-11-01',
        agendas: [
          {
            agenda: 'Campaign Launch',
            discussionPoints: ['Review creative assets', 'Ad budget agreed'],
            decisionMade: 'Launch campaign on Nov 15',
            responsiblePerson: 'Sarah',
            timeline: 'Nov 15',
            evidence: [],
            uncertaintyNotes: [],
          },
        ],
      },
    ];

    const finalMinutes = await consolidateMinutes(chunkResults, mockProvider);
    expect(finalMinutes.meetingTitle).toBe('Marketing Review');
    expect(finalMinutes.minutes.length).toBe(1);
    expect(finalMinutes.minutes[0].agendaNo).toBe(1);
    expect(finalMinutes.minutes[0].decisionMade).toBe('Launch campaign on Nov 15');
    expect(finalMinutes.minutes[0].responsiblePerson).toBe('Sarah');
  });
});
