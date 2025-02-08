import { Evaluator, IAgentRuntime, Memory } from '@elizaos/core';
import { createHash } from 'crypto';

export class PhotoEvaluator implements Evaluator {
  name = 'PHOTO';
  description = 'Evaluates photo quality and content';
  similes = ['ANALYZE_PHOTO_QUALITY', 'CHECK_PHOTO_CONTENT'];
  examples = [];

  async handler(runtime: IAgentRuntime, message: Memory): Promise<{
    quality: number;
    confidence: number;
    issues: string[];
    contentTags: string[];
  }> {
    const photoData = message.content as unknown as { buffer: Buffer; metadata: any; analysis: any };
    const issues: string[] = [];
    const contentTags: string[] = [];

    try {
      // Basic quality checks
      const imageSize = photoData.buffer.length;
      if (imageSize < 50000) { // Less than 50KB
        issues.push('Image resolution too low');
      }

      // Check metadata quality
      if (!photoData.metadata?.Make || !photoData.metadata?.Model) {
        issues.push('Missing camera information');
      }

      if (!photoData.metadata?.DateTimeOriginal) {
        issues.push('Missing timestamp');
      }

      // Calculate quality score (0-1)
      const quality = Math.max(0, Math.min(1, 1 - (issues.length * 0.2)));

      // Generate content hash for verification
      const hash = createHash('sha256')
        .update(new Uint8Array(photoData.buffer))
        .digest('hex');

      // Add basic content tags
      if (photoData.metadata?.ImageWidth && photoData.metadata?.ImageHeight) {
        const aspectRatio = photoData.metadata.ImageWidth / photoData.metadata.ImageHeight;
        contentTags.push(aspectRatio > 1 ? 'landscape' : 'portrait');
      }

      if (photoData.metadata?.Make) {
        contentTags.push(`camera:${photoData.metadata.Make}`);
      }

      return {
        quality,
        confidence: 0.8,
        issues,
        contentTags,
      };
    } catch (error) {
      console.error('Error evaluating photo:', error);
      return {
        quality: 0,
        confidence: 0,
        issues: ['Evaluation failed: ' + error.message],
        contentTags: [],
      };
    }
  }

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as unknown as { buffer: Buffer; metadata: any };
    return !!(content?.buffer && content?.metadata);
  }
} 