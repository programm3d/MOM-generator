export interface ExtractedSegmentRaw {
  text: string;
  page?: number;
  paragraphIndex: number;
}

export interface ExtractionResult {
  fullText: string;
  segments: ExtractedSegmentRaw[];
  pageCount?: number;
}

export interface IExtractor {
  extract(filePath: string): Promise<ExtractionResult>;
}
