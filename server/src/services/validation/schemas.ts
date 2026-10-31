import { z } from 'zod';

export const EvidenceSchema = z.object({
  quote: z.preprocess((val: any) => (val ? String(val).trim() : ''), z.string().default('')),
  sourceSegmentId: z.preprocess((val: any) => (val ? String(val).trim() : 'seg_1'), z.string().default('seg_1')),
  sourcePage: z.number().int().positive().optional(),
  sourceParagraph: z.number().int().positive().optional(),
  supportsField: z.preprocess((val: any) => {
    const s = String(val || '').toLowerCase().trim();
    if (s === 'wayforward' || s === 'way_forward' || s === 'plan' || s === 'action') return 'wayForward';
    if (s === 'owner' || s === 'person' || s === 'responsibleperson') return 'responsiblePerson';
    if (s === 'date' || s === 'deadline' || s === 'timeline') return 'timeline';
    if (s === 'decision' || s === 'decisions') return 'decision';
    return 'discussion';
  }, z.enum([
    'discussion',
    'decision',
    'wayForward',
    'responsiblePerson',
    'timeline',
  ])),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

const sanitizeEvidenceArray = (val: any): any[] => {
  if (!Array.isArray(val)) return [];
  const results: any[] = [];
  for (const item of val) {
    if (!item || typeof item !== 'object') continue;
    const quote = String(item.quote || item.text || item.evidence || '').trim();
    if (!quote) continue;
    const sourceSegmentId = String(
      item.sourceSegmentId ||
      item.segmentId ||
      item.source_segment_id ||
      item.segment ||
      item.sourceId ||
      'seg_1'
    ).trim();
    let supportsField = String(item.supportsField || item.field || 'discussion').trim();
    const lower = supportsField.toLowerCase();
    if (lower === 'wayforward' || lower === 'way_forward' || lower === 'plan' || lower === 'action') {
      supportsField = 'wayForward';
    } else if (lower === 'responsibleperson' || lower === 'owner' || lower === 'person') {
      supportsField = 'responsiblePerson';
    } else if (lower === 'decision' || lower === 'decisions') {
      supportsField = 'decision';
    } else if (lower === 'timeline' || lower === 'date' || lower === 'deadline') {
      supportsField = 'timeline';
    } else {
      supportsField = 'discussion';
    }
    results.push({
      quote,
      sourceSegmentId: sourceSegmentId || 'seg_1',
      sourcePage: typeof item.sourcePage === 'number' ? item.sourcePage : undefined,
      sourceParagraph: typeof item.sourceParagraph === 'number' ? item.sourceParagraph : undefined,
      supportsField,
    });
  }
  return results;
};

export const AgendaItemSchema = z.object({
  slNo: z.number().int().positive().optional(),
  agendaNo: z.number().int().positive().optional(),
  agendaPoint: z.preprocess((val: any) => (val ? String(val).trim() : '1.1'), z.string().default('1.1')),
  agenda: z.preprocess((val: any) => (val ? String(val) : 'General'), z.string().min(1)),
  discussionPoints: z.preprocess((val: any) => {
    if (Array.isArray(val) && val.length > 0) return val.map((v) => (typeof v === 'object' && v?.point ? String(v.point) : String(v)));
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return ['Discussion held'];
  }, z.array(z.string()).default(['Discussion held'])),
  wayForward: z.preprocess((val: any) => {
    if (Array.isArray(val) && val.length > 0) return val.map((v) => (typeof v === 'object' && v?.plan ? String(v.plan) : String(v)));
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  }, z.array(z.string()).default([])),
  decisionMade: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  responsiblePerson: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  timeline: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  evidence: z.preprocess(sanitizeEvidenceArray, z.array(EvidenceSchema).default([])),
  uncertaintyNotes: z.preprocess((val: any) => (Array.isArray(val) ? val : []), z.array(z.string()).default([])),
});

export type AgendaItem = z.infer<typeof AgendaItemSchema>;

export const MeetingMinutesSchema = z.object({
  meetingTitle: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  meetingDate: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  meetingTime: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  meetingMode: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  attendees: z.preprocess((val: any) => {
    if (Array.isArray(val)) return val.map(String).join(', ');
    return val ? String(val) : null;
  }, z.string().nullable().default(null)),
  notes: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  minutes: z.array(AgendaItemSchema),
});

export type MeetingMinutes = z.infer<typeof MeetingMinutesSchema>;

// Intermediate chunk extraction schema
export const RawChunkAgendaItemSchema = z.object({
  agendaPoint: z.preprocess((val: any) => (val ? String(val).trim() : '1.1'), z.string().default('1.1')),
  agenda: z.preprocess((val: any) => (val ? String(val) : 'General'), z.string().min(1)),
  discussionPoints: z.preprocess((val: any) => {
    if (Array.isArray(val) && val.length > 0) return val.map((v) => (typeof v === 'object' && v?.point ? String(v.point) : String(v)));
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return ['Discussion held'];
  }, z.array(z.string()).default(['Discussion held'])),
  wayForward: z.preprocess((val: any) => {
    if (Array.isArray(val) && val.length > 0) return val.map((v) => (typeof v === 'object' && v?.plan ? String(v.plan) : String(v)));
    if (typeof val === 'string' && val.trim()) return [val.trim()];
    return [];
  }, z.array(z.string()).default([])),
  decisionMade: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  responsiblePerson: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  timeline: z.preprocess((val: any) => (val ? String(val) : 'Not specified'), z.string().default('Not specified')),
  evidence: z.preprocess(sanitizeEvidenceArray, z.array(EvidenceSchema).default([])),
  uncertaintyNotes: z.preprocess((val: any) => (Array.isArray(val) ? val : []), z.array(z.string()).default([])),
});

export const ChunkExtractionResultSchema = z.object({
  candidateMeetingTitle: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  candidateMeetingDate: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  candidateMeetingTime: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  candidateMeetingMode: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  candidateAttendees: z.preprocess((val: any) => {
    if (Array.isArray(val)) return val.map(String).join(', ');
    return val ? String(val) : null;
  }, z.string().nullable().default(null)),
  candidateNotes: z.preprocess((val: any) => (val ? String(val) : null), z.string().nullable().default(null)),
  agendas: z.preprocess((val: any) => (Array.isArray(val) ? val : []), z.array(RawChunkAgendaItemSchema).default([])),
});

export type ChunkExtractionResult = z.infer<typeof ChunkExtractionResultSchema>;

// Native Gemini/OpenAPI compatible JSON schemas
export const CHUNK_EXTRACTION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    candidateMeetingTitle: { type: 'STRING' },
    candidateMeetingDate: { type: 'STRING' },
    candidateMeetingTime: { type: 'STRING' },
    candidateMeetingMode: { type: 'STRING' },
    candidateAttendees: { type: 'STRING' },
    candidateNotes: { type: 'STRING' },
    agendas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          agendaPoint: { type: 'STRING' },
          agenda: { type: 'STRING' },
          discussionPoints: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          wayForward: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          decisionMade: { type: 'STRING' },
          responsiblePerson: { type: 'STRING' },
          timeline: { type: 'STRING' },
          evidence: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                quote: { type: 'STRING' },
                sourceSegmentId: { type: 'STRING' },
                supportsField: {
                  type: 'STRING',
                  enum: ['discussion', 'decision', 'wayForward', 'responsiblePerson', 'timeline'],
                },
              },
              required: ['quote'],
            },
          },
          uncertaintyNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: ['agenda', 'discussionPoints', 'wayForward', 'responsiblePerson'],
      },
    },
  },
  required: ['agendas'],
};

export const CONSOLIDATION_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meetingTitle: { type: 'STRING' },
    meetingDate: { type: 'STRING' },
    meetingTime: { type: 'STRING' },
    meetingMode: { type: 'STRING' },
    attendees: { type: 'STRING' },
    notes: { type: 'STRING' },
    minutes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          slNo: { type: 'INTEGER' },
          agendaPoint: { type: 'STRING' },
          agenda: { type: 'STRING' },
          discussionPoints: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          wayForward: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          decisionMade: { type: 'STRING' },
          responsiblePerson: { type: 'STRING' },
          timeline: { type: 'STRING' },
          evidence: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                quote: { type: 'STRING' },
                sourceSegmentId: { type: 'STRING' },
                supportsField: {
                  type: 'STRING',
                  enum: ['discussion', 'decision', 'wayForward', 'responsiblePerson', 'timeline'],
                },
              },
              required: ['quote'],
            },
          },
          uncertaintyNotes: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: ['slNo', 'agendaPoint', 'agenda', 'discussionPoints', 'wayForward', 'responsiblePerson'],
      },
    },
  },
  required: ['minutes'],
};
