import { NormalizedTranscript } from '../transcript/types.js';
import { AgendaItem, Evidence } from './schemas.js';

export interface ValidationReport {
  totalEvidenceQuotes: number;
  validQuotes: number;
  invalidQuotes: number;
  unmatchedQuotes: string[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function validateAndEnrichEvidence(
  agendaItems: AgendaItem[],
  transcript: NormalizedTranscript
): { validatedItems: AgendaItem[]; report: ValidationReport } {
  let totalEvidenceQuotes = 0;
  let validQuotes = 0;
  let invalidQuotes = 0;
  const unmatchedQuotes: string[] = [];

  const validatedItems: AgendaItem[] = agendaItems.map((item) => {
    const verifiedEvidence: Evidence[] = [];

    for (const ev of item.evidence) {
      totalEvidenceQuotes++;
      const sourceSegment = transcript.segmentMap[ev.sourceSegmentId];

      if (!sourceSegment) {
        invalidQuotes++;
        unmatchedQuotes.push(`[Segment not found: ${ev.sourceSegmentId}] "${ev.quote}"`);
        continue;
      }

      const normalizedSource = normalizeWhitespace(sourceSegment.text);
      const normalizedQuote = normalizeWhitespace(ev.quote);

      // Verbatim substring check with normalized whitespace
      if (normalizedSource.includes(normalizedQuote) || normalizedQuote.includes(normalizedSource)) {
        validQuotes++;
        verifiedEvidence.push({
          ...ev,
          sourcePage: sourceSegment.page ?? ev.sourcePage,
          sourceParagraph: sourceSegment.paragraphIndex ?? ev.sourceParagraph,
        });
      } else {
        invalidQuotes++;
        unmatchedQuotes.push(`[Unmatched quote in ${ev.sourceSegmentId}] "${ev.quote}"`);
      }
    }

    return {
      ...item,
      evidence: verifiedEvidence,
    };
  });

  return {
    validatedItems,
    report: {
      totalEvidenceQuotes,
      validQuotes,
      invalidQuotes,
      unmatchedQuotes,
    },
  };
}
