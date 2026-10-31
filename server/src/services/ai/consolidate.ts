import { ILLMProvider } from './provider.interface.js';
import {
  ChunkExtractionResult,
  MeetingMinutes,
  MeetingMinutesSchema,
  AgendaItem,
  CONSOLIDATION_JSON_SCHEMA,
} from '../validation/schemas.js';
import {
  CONSOLIDATION_SYSTEM_PROMPT,
  buildConsolidationPrompt,
} from './prompts/consolidation.js';

export async function consolidateMinutes(
  chunkResults: ChunkExtractionResult[],
  provider: ILLMProvider
): Promise<MeetingMinutes> {
  if (chunkResults.length === 0) {
    return {
      meetingTitle: null,
      meetingDate: null,
      meetingTime: null,
      meetingMode: null,
      attendees: null,
      notes: null,
      minutes: [],
    };
  }

  // Optimize for single chunk (common case): deterministic consolidation
  if (chunkResults.length === 1) {
    const single = chunkResults[0];
    const minutes: AgendaItem[] = single.agendas.map((item, idx) => ({
      slNo: idx + 1,
      agendaNo: idx + 1,
      agendaPoint: item.agendaPoint || `1.${idx + 1}`,
      agenda: item.agenda,
      discussionPoints: item.discussionPoints,
      wayForward: item.wayForward || [],
      decisionMade: item.decisionMade || 'Not specified',
      responsiblePerson: item.responsiblePerson || 'Not specified',
      timeline: item.timeline || 'Not specified',
      evidence: item.evidence || [],
      uncertaintyNotes: item.uncertaintyNotes || [],
    }));

    return {
      meetingTitle: single.candidateMeetingTitle || null,
      meetingDate: single.candidateMeetingDate || null,
      meetingTime: single.candidateMeetingTime || null,
      meetingMode: single.candidateMeetingMode || null,
      attendees: single.candidateAttendees || null,
      notes: single.candidateNotes || null,
      minutes,
    };
  }

  // Multi-chunk consolidation via LLM
  const prompt = buildConsolidationPrompt(JSON.stringify(chunkResults, null, 2));

  let rawOutput: any;
  try {
    rawOutput = await provider.generateStructured<any>(prompt, {
      systemInstruction: CONSOLIDATION_SYSTEM_PROMPT,
      temperature: 0.1,
      jsonSchema: CONSOLIDATION_JSON_SCHEMA,
    });
  } catch (err: any) {
    throw new Error(`Failed to consolidate multi-chunk minutes: ${err.message}`);
  }

  const parsed = MeetingMinutesSchema.safeParse(rawOutput);
  if (parsed.success) {
    // Ensure agenda numbers and slNo are clean 1..N
    const finalMinutes = parsed.data.minutes.map((m, idx) => ({
      ...m,
      slNo: idx + 1,
      agendaNo: idx + 1,
      agendaPoint: m.agendaPoint || `${Math.floor(idx / 3) + 1}.${(idx % 3) + 1}`,
    }));
    return {
      ...parsed.data,
      minutes: finalMinutes,
    };
  }

  // Bounded repair attempt
  console.warn(
    `[Validation Warning] Consolidation failed initial schema: ${parsed.error.message}. Repairing...`
  );

  const repairPrompt = `The previous JSON response did not match the MeetingMinutes schema:
Errors:
${JSON.stringify(parsed.error.errors, null, 2)}

Please fix and return the valid JSON.`;

  const repaired = await provider.generateStructured<any>(repairPrompt, {
    systemInstruction: CONSOLIDATION_SYSTEM_PROMPT,
    temperature: 0.0,
  });

  const repairedParsed = MeetingMinutesSchema.parse(repaired);
  return {
    ...repairedParsed,
    minutes: repairedParsed.minutes.map((m, idx) => ({
      ...m,
      slNo: idx + 1,
      agendaNo: idx + 1,
      agendaPoint: m.agendaPoint || `${Math.floor(idx / 3) + 1}.${(idx % 3) + 1}`,
    })),
  };
}
