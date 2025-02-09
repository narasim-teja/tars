import { AgentRuntime, elizaLogger, type Character, stringToUuid, Memory } from '@elizaos/core';
import { AnalyzePhotoAction } from './actions/analyze-photo.action.js';
import { PhotoEvaluator } from './evaluators/photo.evaluator.js';
import { AuthenticityEvaluator } from './evaluators/authenticity.evaluator.js';
import { EigenLayerAVSEvaluator } from './evaluators/eigenlayer-avs.evaluator.js';
import { MetadataProvider } from './providers/metadata.provider.js';
import { LocationProvider } from './providers/location.provider.js';
import { WeatherProvider } from './providers/weather.provider.js';
import { NewsProvider } from './providers/news.provider.js';
import { ImageAnalysisProvider } from './providers/image-analysis.provider.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MediaAnalystAgent extends AgentRuntime {
  analyzePhoto(arg0: { buffer: Buffer<ArrayBufferLike>; metadata: any; timestamp: any; location: any; }) {
    throw new Error('Method not implemented.');
  }
  private readonly LOCAL_USER_ID = stringToUuid('local-user');
  private readonly LOCAL_ROOM_ID = stringToUuid('local-analysis-room');
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(config: {
    character: Character;
    databaseAdapter: any;
    token: string;
    cacheManager: any;
  }) {
    super({
      ...config,
      modelProvider: config.character.modelProvider,
      evaluators: [
        new PhotoEvaluator(),
        new AuthenticityEvaluator(),
        new EigenLayerAVSEvaluator(),
      ],
      providers: [
        new MetadataProvider(),
        new LocationProvider(),
        new WeatherProvider(),
        new NewsProvider(),
        new ImageAnalysisProvider(),
      ],
      actions: [new AnalyzePhotoAction()],
      services: [],
      managers: [],
      cacheManager: config.cacheManager
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    elizaLogger.info('Media Analyst Agent initialized');
  }

  async startDataCollection(): Promise<void> {
    elizaLogger.info('Media analysis service started');
    
    const testPhotoDir = path.join(__dirname, '../../../test/photos');
    
    try {
      // Ensure the photos directory exists
      await fs.mkdir(testPhotoDir, { recursive: true });
      
      // Initial scan of existing photos
      await this.processPhotosInDirectory(testPhotoDir);
      
      // Set up watching for new photos
      this.watchInterval = setInterval(async () => {
        try {
          await this.processPhotosInDirectory(testPhotoDir);
        } catch (error) {
          elizaLogger.error('Error processing photos:', error);
        }
      }, 5000); // Check every 5 seconds
      
    } catch (error) {
      elizaLogger.error('Error starting data collection:', error);
      throw error;
    }
  }

  private async processPhotosInDirectory(dirPath: string) {
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.heic'];
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          const filePath = path.join(dirPath, file);
          
          try {
            elizaLogger.info(`Processing photo: ${file}`);
            const buffer = await fs.readFile(filePath);
            
            // Use the action system to process the photo
            const action = this.actions.find(a => a instanceof AnalyzePhotoAction);
            if (action) {
              const result = await action.handler(this, {
                userId: this.LOCAL_USER_ID,
                roomId: this.LOCAL_ROOM_ID,
                agentId: this.agentId,
                content: {
                  text: 'process photo',
                  buffer,
                  filePath
                }
              });
              elizaLogger.info(`Analysis complete for ${file}:`, result);
            }
          } catch (error) {
            elizaLogger.error(`Error analyzing ${file}:`, error);
          }
        }
      }
    } catch (error) {
      elizaLogger.error('Error reading directory:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
    elizaLogger.info('Media Analyst Agent cleaned up');
  }
} 
