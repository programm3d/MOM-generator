import { jobManager } from './jobs/job-manager.js';
import { getExtractor } from './ingestion/index.js';
import { normalizeTranscript, chunkTranscript } from './transcript/index.js';
import { getLLMProvider, extractChunkFacts, consolidateMinutes } from './ai/index.js';
import { validateAndEnrichEvidence } from './validation/index.js';
import { renderMinutesToDocx } from './docx/index.js';
import { ChunkExtractionResult } from './validation/schemas.js';

export async function processGenerationJob(
  jobId: string,
  customProvider?: any
): Promise<void> {
  const job = jobManager.getJob(jobId);
  if (!job) return;

  try {
    // 1. Text Extraction
    jobManager.updateJob(jobId, {
      stage: 'extracting',
      message: 'Extracting text and structure from uploaded file...',
    });

    const extractor = getExtractor(job.sourceFilePath);
    const extractionResult = await extractor.extract(job.sourceFilePath);

    // 2. Normalization & Chunking
    jobManager.updateJob(jobId, {
      stage: 'chunking',
      message: 'Segmenting transcript and mapping source IDs...',
    });

    const normalizedTranscript = normalizeTranscript(extractionResult);
    const chunks = chunkTranscript(normalizedTranscript);

    if (chunks.length === 0) {
      throw new Error('Transcript does not contain enough text to extract meeting minutes.');
    }

    jobManager.updateJob(jobId, {
      totalChunks: chunks.length,
      completedChunks: 0,
      stage: 'extracting_facts',
      message: `Extracting meeting details from transcript (${chunks.length} chunk${chunks.length > 1 ? 's' : ''})...`,
    });

    // 3. AI Provider & Fact Extraction
    const provider = customProvider || getLLMProvider();
    const chunkResults: ChunkExtractionResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (i > 0 && provider.name === 'groq') {
        // Pace chunk requests for Groq free-tier rolling TPM limit
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      const facts = await extractChunkFacts(chunk, chunks.length, provider);
      chunkResults.push(facts);

      jobManager.updateJob(jobId, {
        completedChunks: i + 1,
        message: `Extracted facts from chunk ${i + 1} of ${chunks.length}...`,
      });
    }

    // 4. Consolidation
    jobManager.updateJob(jobId, {
      stage: 'consolidating',
      message: 'Consolidating minutes and merging agenda topics...',
    });

    const consolidated = await consolidateMinutes(chunkResults, provider);

    // 5. Schema & Evidence Validation
    jobManager.updateJob(jobId, {
      stage: 'validating',
      message: 'Verifying evidence quotes and schema rules...',
    });

    const { validatedItems, report } = validateAndEnrichEvidence(
      consolidated.minutes,
      normalizedTranscript
    );

    console.log(
      `[Validation Report - Job ${jobId}] Total quotes: ${report.totalEvidenceQuotes}, Valid: ${report.validQuotes}, Invalid: ${report.invalidQuotes}`
    );

    const finalMinutes = {
      ...consolidated,
      minutes: validatedItems,
    };

    // 6. DOCX Generation
    jobManager.updateJob(jobId, {
      stage: 'rendering_docx',
      message: 'Rendering Microsoft Word document...',
    });

    const renderResult = await renderMinutesToDocx(finalMinutes, job.originalFileName);

    // 7. Completion & Source Cleanup
    jobManager.updateJob(jobId, {
      status: 'completed',
      stage: 'ready',
      message: 'Minutes of Meeting generated successfully!',
      outputFilePath: renderResult.filePath,
      resultFileName: renderResult.fileName,
      agendaCount: finalMinutes.minutes.length,
      meetingTitle: finalMinutes.meetingTitle,
      meetingDate: finalMinutes.meetingDate,
      meetingTime: finalMinutes.meetingTime,
      meetingMode: finalMinutes.meetingMode,
      attendees: finalMinutes.attendees,
    });

    // Clean up temporary uploaded source file now that processing is done
    await jobManager.cleanupJobFiles(jobId);
    console.log(`[Job Complete] ${jobId} -> ${renderResult.fileName}`);
  } catch (err: any) {
    console.error(`[Job Error - ${jobId}]:`, err.message || err);
    jobManager.updateJob(jobId, {
      status: 'failed',
      message: err.message || 'An error occurred during meeting minutes generation.',
      error: err.message || String(err),
    });
  }
}
