import fs from 'fs';
import { IExtractor, ExtractionResult, ExtractedSegmentRaw } from './extractor.interface.js';

export class TxtExtractor implements IExtractor {
  public async extract(filePath: string): Promise<ExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = await fs.promises.readFile(filePath);
    if (buffer.length === 0) {
      throw new Error('The uploaded TXT file is empty.');
    }

    // Decode: check for UTF-8 or BOM
    let text = '';
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      text = buffer.toString('utf16le');
    } else {
      text = buffer.toString('utf8');
    }

    // Normalize Windows line endings to \n
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split into paragraphs by double newlines or single newlines with speaker turns
    const lines = normalizedText.split('\n');
    const segments: ExtractedSegmentRaw[] = [];
    let currentParagraph = '';
    let paraIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentParagraph.trim()) {
          segments.push({
            text: currentParagraph.trim(),
            paragraphIndex: paraIndex++,
          });
          currentParagraph = '';
        }
      } else {
        // If the line looks like a speaker turn (e.g. "John Doe:", "Alice [10:02]:")
        const isSpeakerTurn = /^[A-Z][a-zA-Z0-9_\s]{1,30}(\[[0-9:]+\])?:\s*/.test(line);
        if (isSpeakerTurn && currentParagraph.trim()) {
          segments.push({
            text: currentParagraph.trim(),
            paragraphIndex: paraIndex++,
          });
          currentParagraph = line;
        } else {
          currentParagraph = currentParagraph ? `${currentParagraph} ${line}` : line;
        }
      }
    }

    if (currentParagraph.trim()) {
      segments.push({
        text: currentParagraph.trim(),
        paragraphIndex: paraIndex++,
      });
    }

    if (segments.length === 0 || !normalizedText.trim()) {
      throw new Error('The TXT transcript contains no readable text.');
    }

    return {
      fullText: segments.map((s) => s.text).join('\n\n'),
      segments,
    };
  }
}
