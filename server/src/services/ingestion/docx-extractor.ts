import fs from 'fs';
import mammoth from 'mammoth';
import { IExtractor, ExtractionResult, ExtractedSegmentRaw } from './extractor.interface.js';

export class DocxExtractor implements IExtractor {
  public async extract(filePath: string): Promise<ExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = await fs.promises.readFile(filePath);
    if (buffer.length === 0) {
      throw new Error('The uploaded DOCX file is empty.');
    }

    let result;
    try {
      result = await mammoth.extractRawText({ buffer });
    } catch (err: any) {
      throw new Error(`Failed to parse DOCX file: ${err.message || 'Corrupt or invalid Word document.'}`);
    }

    const rawText = result.value || '';
    const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    if (!normalizedText) {
      throw new Error('The DOCX document contains no readable text.');
    }

    // Split paragraphs
    const paragraphs = normalizedText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const segments: ExtractedSegmentRaw[] = paragraphs.map((text, idx) => ({
      text,
      paragraphIndex: idx + 1,
    }));

    return {
      fullText: normalizedText,
      segments,
    };
  }
}
