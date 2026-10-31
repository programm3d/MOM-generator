import { app } from './app.js';
import { config } from './config/index.js';
import { jobManager } from './services/jobs/job-manager.js';
import { tempStorage } from './utils/temp-storage.js';

const server = app.listen(config.port, () => {
  console.log(`=========================================`);
  console.log(` AI MoM Generator Server running on port ${config.port}`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` Provider: ${config.llmProvider} (${config.llmProvider === 'gemini' ? config.llmModel : config.groqModel})`);
  console.log(` Max Upload: ${config.uploadMaxMb} MB`);
  console.log(` Temp Dir: ${config.tempDir}`);
  console.log(`=========================================`);
});

// Periodic cleanup of expired temporary files and memory jobs (every 15 mins)
const cleanupInterval = setInterval(() => {
  const purgedJobs = jobManager.purgeExpiredJobs(config.jobRetentionMinutes);
  const purgedFiles = tempStorage.cleanExpiredFiles(config.jobRetentionMinutes);
  if (purgedJobs > 0 || purgedFiles > 0) {
    console.log(`[Cleanup] Purged ${purgedJobs} expired jobs and ${purgedFiles} temporary files.`);
  }
}, 15 * 60 * 1000);

const shutdown = () => {
  console.log('Shutting down server gracefully...');
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
