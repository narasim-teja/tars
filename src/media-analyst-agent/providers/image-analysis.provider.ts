import { Provider, elizaLogger, IAgentRuntime, Memory, State } from '@elizaos/core';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

export interface ImageAnalysisResult {
  description: string;
  tags: string[];
  objects: string[];
  landmarks: string[];
  categories: string[];
  confidence: number;
}

export class ImageAnalysisProvider implements Provider {
  private anthropic: Anthropic;
  name = 'IMAGE_ANALYSIS';
  description = 'Analyzes images using Claude Vision';
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  private readonly BASE64_OVERHEAD = 1.37; // base64 encoding increases size by ~37%
  private readonly TARGET_SIZE = Math.floor(this.MAX_IMAGE_SIZE / this.BASE64_OVERHEAD); // Target binary size to account for base64 overhead

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  private async resizeImageIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
    elizaLogger.info(`Original image size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    elizaLogger.info(`Base64 estimated size: ${(imageBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB`);
    
    if (imageBuffer.length <= this.TARGET_SIZE) {
      elizaLogger.info('Image is already under target size limit, no resizing needed');
      return imageBuffer;
    }

    try {
      // Get original image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      elizaLogger.info(`Original dimensions: ${metadata.width}x${metadata.height}`);

      // Start with more aggressive resizing
      const maxDimension = 1200;
      let quality = 60;
      
      let resizedBuffer = await sharp(imageBuffer)
        .resize(maxDimension, maxDimension, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality })
        .toBuffer();

      elizaLogger.info(`First resize attempt: ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${(resizedBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB as base64)`);

      // If still too large, reduce quality and dimensions further
      while (resizedBuffer.length > this.TARGET_SIZE && quality > 15) {
        quality -= 15;
        const dimension = quality < 30 ? 800 : maxDimension;
        
        resizedBuffer = await sharp(imageBuffer)
          .resize(dimension, dimension, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality })
          .toBuffer();

        elizaLogger.info(`Resize attempt: ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${(resizedBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB as base64) with quality ${quality}%, dimension ${dimension}px`);
      }

      if (resizedBuffer.length > this.TARGET_SIZE) {
        // Final attempt with most aggressive settings
        resizedBuffer = await sharp(imageBuffer)
          .resize(600, 600, { fit: 'inside' })
          .jpeg({ quality: 10 })
          .toBuffer();
        
        elizaLogger.info(`Final resize attempt: ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${(resizedBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB as base64)`);
      }

      // If still too large after all attempts, throw error
      if (resizedBuffer.length > this.TARGET_SIZE) {
        throw new Error(`Unable to resize image below target size. Final size: ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${(resizedBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB as base64)`);
      }

      elizaLogger.info(`Image resized successfully. Final size: ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB (${(resizedBuffer.length * this.BASE64_OVERHEAD / 1024 / 1024).toFixed(2)}MB as base64)`);
      return resizedBuffer;
    } catch (error) {
      elizaLogger.error('Error resizing image:', error);
      throw error;
    }
  }

  // Implement the Provider interface method
  async get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<any> {
    try {
      const content = message.content as any;
      if (!content?.imageUrl) {
        elizaLogger.warn('No image URL provided for analysis');
        return null;
      }
   
      elizaLogger.info('Analyzing image with Claude...');
      return await this.analyzeImage(content.imageUrl);
    } catch (error) {
      elizaLogger.error('Error in image analysis provider:', error);
      return null;
    }
  }

  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    try {
      elizaLogger.info('Starting image analysis...');

      // Handle data URLs directly, otherwise fetch from URL
      let imageBuffer: Buffer;
      if (imageUrl.startsWith('data:image')) {
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        elizaLogger.info('Using provided base64 image data');
      } else {
        elizaLogger.info('Fetching image from URL:', imageUrl);
        const imageResponse = await fetch(imageUrl);
        const arrayBuffer = await imageResponse.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }

      // Always resize the image to ensure it's under 5MB
      elizaLogger.info('Processing image...');
      const processedBuffer = await this.resizeImageIfNeeded(imageBuffer);
      const base64Image = processedBuffer.toString('base64');
      elizaLogger.info(`Base64 string length: ${base64Image.length} characters`);

      elizaLogger.info('Sending image to Claude for analysis...');
      const message = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image in detail and provide the following in a structured format:\n1. Description: A detailed description of the scene\n2. Objects: List of key objects present\n3. Landmarks: Any identifiable locations or landmarks\n4. Categories: Relevant categories for news search\n5. Confidence: Your confidence level in the analysis (0-100)'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }]
      });

      const content = message.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('No analysis result received from Claude');
      }

      elizaLogger.info('Received analysis from Claude, parsing response...');
      
      // Parse the response into structured data
      const sections = content.text.split('\n\n');
      const result: ImageAnalysisResult = {
        description: '',
        tags: [],
        objects: [],
        landmarks: [],
        categories: [],
        confidence: 0
      };

      sections.forEach(section => {
        if (section.includes('Description:')) {
          result.description = section.replace('Description:', '').trim();
          elizaLogger.debug('Parsed description:', result.description);
        } else if (section.includes('Objects:')) {
          result.objects = section
            .replace('Objects:', '')
            .trim()
            .split(',')
            .map(obj => obj.trim());
          elizaLogger.debug('Parsed objects:', result.objects);
        } else if (section.includes('Landmarks:')) {
          result.landmarks = section
            .replace('Landmarks:', '')
            .trim()
            .split(',')
            .map(landmark => landmark.trim());
          elizaLogger.debug('Parsed landmarks:', result.landmarks);
        } else if (section.includes('Categories:')) {
          result.categories = section
            .replace('Categories:', '')
            .trim()
            .split(',')
            .map(category => category.trim());
          elizaLogger.debug('Parsed categories:', result.categories);
        } else if (section.includes('Confidence:')) {
          result.confidence = parseInt(
            section.replace('Confidence:', '').trim().replace('%', '')
          );
          elizaLogger.debug('Parsed confidence:', result.confidence);
        }
      });

      // Generate tags from all identified elements
      result.tags = [
        ...new Set([
          ...result.objects,
          ...result.landmarks,
          ...result.categories
        ])
      ].filter(Boolean);

      elizaLogger.info('Image analysis completed successfully');
      elizaLogger.debug('Analysis result:', result);
      return result;
    } catch (error) {
      elizaLogger.error('Error analyzing image:', error);
      throw new Error(`Image analysis failed: ${error.message}`);
    }
  }
} 