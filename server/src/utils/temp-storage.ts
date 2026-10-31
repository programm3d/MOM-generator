import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { config } from '../config/index.js';

export class TempStorage {
  private tempDir: string;

  constructor(tempDir = config.tempDir) {
    this.tempDir = tempDir;
    this.ensureDirectory();
  }

  public ensureDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  public generateFilePath(extension: string): { id: string; filePath: string } {
    this.ensureDirectory();
    const id = nanoid(16);
    const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
    const safeName = `mom_${Date.now()}_${id}${cleanExt}`;
    const filePath = path.join(this.tempDir, safeName);
    return { id, filePath };
  }

  public async deleteFile(filePath: string): Promise<boolean> {
    try {
      // Validate path is strictly inside tempDir to prevent path traversal
      const normalizedTarget = path.normalize(filePath);
      const normalizedBase = path.normalize(this.tempDir);

      if (!normalizedTarget.startsWith(normalizedBase)) {
        console.warn(`[Security] Prevented deletion outside temp dir: ${filePath}`);
        return false;
      }

      if (fs.existsSync(normalizedTarget)) {
        await fs.promises.unlink(normalizedTarget);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to delete temporary file ${filePath}:`, err);
      return false;
    }
  }

  public cleanExpiredFiles(maxAgeMinutes = config.jobRetentionMinutes): number {
    try {
      this.ensureDirectory();
      const now = Date.now();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;
      let count = 0;

      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const fullPath = path.join(this.tempDir, file);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile() && now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            count++;
          }
        } catch {
          // ignore individual file stat/unlink errors
        }
      }
      return count;
    } catch (err) {
      console.error('Error during expired files cleanup:', err);
      return 0;
    }
  }
}

export const tempStorage = new TempStorage();
