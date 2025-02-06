import { AgentRuntime, elizaLogger, type Character, stringToUuid } from '@elizaos/core';
import { AnalyzePhotoAction } from './actions/analyze-photo.action.js';
import { PhotoEvaluator } from './evaluators/photo.evaluator.js';
import { AuthenticityEvaluator } from './evaluators/authenticity.evaluator.js';
import { MetadataProvider } from './providers/metadata.provider.js';
import { LocationProvider } from './providers/location.provider.js';

export class MediaAnalystAgent extends AgentRuntime {
  private readonly LOCAL_USER_ID = stringToUuid('local-user');
  private readonly LOCAL_ROOM_ID = stringToUuid('local-analysis-room');

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
        new AuthenticityEvaluator()
      ],
      providers: [
        new MetadataProvider(),
        new LocationProvider(),
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
    
    // The agent will now handle photo analysis on-demand
    // rather than periodic collection
  }

  async analyzePhoto(photoData: {
    buffer: Buffer;
    metadata: any;
    timestamp: Date;
    location?: { lat: number; lng: number };
  }): Promise<{
    analysis: string;
    authenticity: boolean;
    contextualData: {
      weather?: any;
      news?: any;
      location?: {
        coordinates: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        landmarks?: string[];
      };
    };
  }> {
    try {
      const action = this.actions.find(a => a instanceof AnalyzePhotoAction);
      if (action) {
        return await action.handler(this, {
          userId: this.LOCAL_USER_ID,
          roomId: this.LOCAL_ROOM_ID,
          agentId: this.agentId,
          content: {
            text: '',
            ...photoData
          }
        });
      }
      throw new Error('Photo analysis action not found');
    } catch (error) {
      elizaLogger.error('Error analyzing photo:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    elizaLogger.info('Media Analyst Agent cleaned up');
  }
} 
