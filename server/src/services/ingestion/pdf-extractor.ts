import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { IExtractor, ExtractionResult, ExtractedSegmentRaw } from './extractor.interface.js';

export class PdfExtractor implements IExtractor {
  public async extract(filePath: string): Promise<ExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = await fs.promises.readFile(filePath);
    if (buffer.length === 0) {
      throw new Error('The uploaded PDF file is empty.');
    }

    const uint8Array = new Uint8Array(buffer);
    let pdfDocument;

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        isEvalSupported: false,
      });
      pdfDocument = await loadingTask.promise;
    } catch (err: any) {
      if (err.name === 'PasswordException') {
        throw new Error('The PDF is password protected. Please provide an unencrypted PDF.');
      }
      throw new Error(`Failed to read PDF document: ${err.message || 'Corrupt or unreadable PDF file.'}`);
    }

    const numPages = pdfDocument.numPages;
    const segments: ExtractedSegmentRaw[] = [];
    let fullText = '';
    let totalTextChars = 0;
    let globalParagraphIndex = 1;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageStrings: string[] = [];
      let currentLine = '';

      for (const item of textContent.items as any[]) {
        if ('str' in item) {
          const str = item.str;
          if (item.hasEOL) {
            currentLine += str;
            pageStrings.push(currentLine.trim());
            currentLine = '';
          } else {
            currentLine += str + ' ';
          }
        }
      }
      if (currentLine.trim()) {
        pageStrings.push(currentLine.trim());
      }

      // Group into paragraphs
      const pageParagraphs: string[] = [];
      let currentPara = '';

      for (const line of pageStrings) {
        if (!line) {
          if (currentPara.trim()) {
            pageParagraphs.push(currentPara.trim());
            currentPara = '';
          }
        } else {
          currentPara = currentPara ? `${currentPara} ${line}` : line;
        }
      }
      if (currentPara.trim()) {
        pageParagraphs.push(currentPara.trim());
      }

      for (const para of pageParagraphs) {
        if (para.trim()) {
          totalTextChars += para.length;
          segments.push({
            text: para.trim(),
            page: pageNum,
            paragraphIndex: globalParagraphIndex++,
          });
        }
      }

      fullText += pageParagraphs.join('\n\n') + '\n\n';
    }

    // Check for scanned / image-only PDFs
    if (totalTextChars < 25 * numPages) {
      throw new Error(
        'The uploaded PDF appears to be a scanned image or contains no selectable text. OCR is not supported in this MVP. Please provide a text-based PDF, DOCX, or TXT transcript.'
      );
    }

    return {
      fullText: fullText.trim(),
      segments,
      pageCount: numPages,
    };
  }
}
