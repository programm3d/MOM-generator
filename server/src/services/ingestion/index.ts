import path from 'path';
import { IExtractor } from './extractor.interface.js';
import { TxtExtractor } from './txt-extractor.js';
import { DocxExtractor } from './docx-extractor.js';
import { PdfExtractor } from './pdf-extractor.js';

export * from './extractor.interface.js';
export * from './txt-extractor.js';
export * from './docx-extractor.js';
export * from './pdf-extractor.js';

export function getExtractor(filePath: string): IExtractor {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.txt':
      return new TxtExtractor();
    case '.docx':
      return new DocxExtractor();
    case '.pdf':
      return new PdfExtractor();
    default:
      throw new Error(`No extractor available for file format "${ext}". Supported formats: .docx, .pdf, .txt`);
  }
}
