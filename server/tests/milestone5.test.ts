import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { renderMinutesToDocx } from '../src/services/docx/renderer.js';
import { DocxExtractor } from '../src/services/ingestion/docx-extractor.js';
import { MeetingMinutes } from '../src/services/validation/schemas.js';

describe('Milestone 5: DOCX Generation & Integrity', () => {
  const generatedFiles: string[] = [];

  afterEach(async () => {
    for (const f of generatedFiles) {
      if (fs.existsSync(f)) {
        await fs.promises.unlink(f);
      }
    }
    generatedFiles.length = 0;
  });

  it('Renders valid DOCX file with all 6 columns and metadata', async () => {
    const minutes: MeetingMinutes = {
      meetingTitle: 'Annual Strategy Planning',
      meetingDate: '2026-10-30',
      minutes: [
        {
          agendaNo: 1,
          agenda: 'Expansion into EMEA',
          discussionPoints: [
            'Market analysis indicated strong enterprise demand in Germany and UK.',
            'Target launch set for early Q2.',
          ],
          decisionMade: 'Approved EMEA expansion budget of $500k',
          responsiblePerson: 'Marcus Vance',
          timeline: 'Q2 2027',
          evidence: [],
          uncertaintyNotes: [],
        },
        {
          agendaNo: 2,
          agenda: 'Hiring Plan',
          discussionPoints: ['Need 3 senior backend engineers'],
          decisionMade: 'Not specified',
          responsiblePerson: 'Not specified',
          timeline: 'Not specified',
          evidence: [],
          uncertaintyNotes: [],
        },
      ],
    };

    const result = await renderMinutesToDocx(minutes);
    generatedFiles.push(result.filePath);

    expect(fs.existsSync(result.filePath)).toBe(true);
    const stats = fs.statSync(result.filePath);
    expect(stats.size).toBeGreaterThan(1000); // Valid zip archive size

    // Safe filename check
    expect(result.fileName).toMatch(/^MoM_\d{4}-\d{2}-\d{2}_Annual_Strategy_Planning\.docx$/);

    // Verify document can be read back by DOCX parser
    const extractor = new DocxExtractor();
    const readBack = await extractor.extract(result.filePath);

    expect(readBack.fullText).toMatch(/Minutes of .*Meeting/i);
    expect(readBack.fullText).toContain('Annual Strategy Planning');
    expect(readBack.fullText).toContain('Expansion into EMEA');
    expect(readBack.fullText).toContain('Approved EMEA expansion budget of $500k');
    expect(readBack.fullText).toContain('Marcus Vance');
    expect(readBack.fullText).toContain('Q2 2027');
    expect(readBack.fullText).toContain('Not specified');
  });

  it('Handles missing optional metadata safely', async () => {
    const minimalMinutes: MeetingMinutes = {
      meetingTitle: null,
      meetingDate: null,
      minutes: [
        {
          agendaNo: 1,
          agenda: 'General Updates',
          discussionPoints: ['Reviewed team tasks'],
          decisionMade: 'Not specified',
          responsiblePerson: 'Not specified',
          timeline: 'Not specified',
          evidence: [],
          uncertaintyNotes: [],
        },
      ],
    };

    const result = await renderMinutesToDocx(minimalMinutes);
    generatedFiles.push(result.filePath);

    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.fileName).toMatch(/^MoM_\d{4}-\d{2}-\d{2}_Meeting_Minutes\.docx$/);
  });
});
