import { Router } from 'express';
import { GenerationController } from '../controllers/generation.controller.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = Router();

// Health check
router.get('/health', GenerationController.health);

// Upload transcript & start generation
router.post(
  '/generations',
  uploadMiddleware.single('transcript'),
  GenerationController.uploadAndStart
);

// Get status
router.get('/generations/:id', GenerationController.getStatus);

// Download result
router.get('/generations/:id/download', GenerationController.downloadResult);

// Delete/Cancel job
router.delete('/generations/:id', GenerationController.cancelOrDelete);

export default router;
