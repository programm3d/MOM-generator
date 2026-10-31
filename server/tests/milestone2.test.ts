import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { TxtExtractor, DocxExtractor, PdfExtractor, getExtractor } from '../src/services/ingestion/index.js';

describe('Milestone 2: File Ingestion & Text Extraction', () => {
  const testDir = path.resolve(process.cwd(), './tmp-ingest-test');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('Extracts text and segments correctly from a TXT transcript', async () => {
    const txtPath = path.join(testDir, 'sample_transcript.txt');
    const content = [
      'Meeting Title: Q3 Product Planning',
      'Date: 2026-10-15',
      '',
      'Sarah [09:00]: Good morning everyone. Let us review the sprint goals.',
      'David [09:02]: The authentication module is ready for review.',
      'Sarah [09:05]: Great. David, please deploy to staging by Friday.',
      'David [09:06]: Confirmed, I will have it deployed by Friday 5 PM.',
    ].join('\n');

    fs.writeFileSync(txtPath, content, 'utf8');

    const extractor = new TxtExtractor();
    const result = await extractor.extract(txtPath);

    expect(result.fullText).toContain('Q3 Product Planning');
    expect(result.fullText).toContain('David [09:06]: Confirmed');
    expect(result.segments.length).toBeGreaterThanOrEqual(4);
    expect(result.segments[0].paragraphIndex).toBe(1);
  });

  it('Rejects empty TXT files with clear actionable error', async () => {
    const emptyTxt = path.join(testDir, 'empty.txt');
    fs.writeFileSync(emptyTxt, '');

    const extractor = new TxtExtractor();
    await expect(extractor.extract(emptyTxt)).rejects.toThrow(/empty/i);
  });

  it('Extracts text from a real DOCX file generated with docx package', async () => {
    const docxPath = path.join(testDir, 'test_meeting.docx');
    
    // Create a real .docx document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Executive Committee Meeting Minutes', bold: true }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Alice: We have decided to migrate our infrastructure to GCP.' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Bob: I will prepare the cloud architecture proposal by end of month.' }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);

    const extractor = new DocxExtractor();
    const result = await extractor.extract(docxPath);

    expect(result.fullText).toContain('Executive Committee Meeting Minutes');
    expect(result.fullText).toContain('Alice: We have decided to migrate our infrastructure to GCP.');
    expect(result.fullText).toContain('Bob: I will prepare the cloud architecture proposal');
    expect(result.segments.length).toBe(3);
  });

  it('Rejects corrupt DOCX file with an actionable error', async () => {
    const corruptDocx = path.join(testDir, 'corrupt.docx');
    fs.writeFileSync(corruptDocx, 'This is definitely not a zip or docx binary stream.');

    const extractor = new DocxExtractor();
    await expect(extractor.extract(corruptDocx)).rejects.toThrow(/Failed to parse DOCX/i);
  });

  it('Rejects empty PDF file with actionable error', async () => {
    const emptyPdf = path.join(testDir, 'empty.pdf');
    fs.writeFileSync(emptyPdf, '');

    const extractor = new PdfExtractor();
    await expect(extractor.extract(emptyPdf)).rejects.toThrow(/empty/i);
  });

  it('Unified getExtractor factory returns correct extractor instance', () => {
    expect(getExtractor('file.txt')).toBeInstanceOf(TxtExtractor);
    expect(getExtractor('doc.docx')).toBeInstanceOf(DocxExtractor);
    expect(getExtractor('presentation.pdf')).toBeInstanceOf(PdfExtractor);
    expect(() => getExtractor('image.jpg')).toThrow(/No extractor available/i);
  });
});
