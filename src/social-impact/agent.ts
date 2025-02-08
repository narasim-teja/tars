import { AgentRuntime, elizaLogger, type Character, stringToUuid } from '@elizaos/core';
import { ImpactEvaluator } from './evaluators/impact.evaluator';
import { ethers } from 'ethers';
import { MediaAnalysis, VerificationResult, ImpactAssessment, AgentResponse } from './types';

export class SocialImpactAgent extends AgentRuntime {
  private readonly LOCAL_USER_ID = stringToUuid('local-user');
  private readonly LOCAL_ROOM_ID = stringToUuid('local-impact-room');

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
        new ImpactEvaluator(),
      ],
      providers: [],
      actions: [],
      services: [],
      managers: [],
      cacheManager: config.cacheManager
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    elizaLogger.info('Social Impact Agent initialized');
  }

  async assessImpact(data: {
    mediaAnalysis: MediaAnalysis;
    verificationResult: VerificationResult;
  }): Promise<AgentResponse> {
    try {
      const evaluator = this.evaluators.find(e => e instanceof ImpactEvaluator);
      if (!evaluator) {
        throw new Error('Impact evaluator not found');
      }

      // Get impact assessment
      const assessment = await evaluator.handler(this, {
        userId: this.LOCAL_USER_ID,
        roomId: this.LOCAL_ROOM_ID,
        agentId: this.agentId,
        content: {
          text: 'Analyze social impact',
          ...data
        }
      }) as ImpactAssessment;

      // Generate recommendation based on assessment
      const recommendation = this.generateRecommendation(assessment);

      // Generate next steps
      const nextSteps = this.generateNextSteps(assessment);

      return {
        assessment,
        recommendation,
        nextSteps
      };
    } catch (error) {
      elizaLogger.error('Error in impact assessment:', error);
      throw error;
    }
  }

  private generateRecommendation(assessment: ImpactAssessment): string {
    const { totalScore, issue, strategy } = assessment;

    if (totalScore >= 80) {
      return `High-impact issue identified: ${issue.title}. Recommend immediate action through ${strategy.mechanism} with target funding of ${strategy.targetAmount}.`;
    } else if (totalScore >= 60) {
      return `Moderate-impact issue identified: ${issue.title}. Suggest ${strategy.mechanism} approach with initial funding target of ${strategy.targetAmount}.`;
    } else {
      return `Issue identified: ${issue.title}. Consider local fundraising initiative with target of ${strategy.targetAmount}.`;
    }
  }

  private generateNextSteps(assessment: ImpactAssessment): string[] {
    const steps = [
      'Document current conditions with additional photos/videos',
      'Engage with local community members',
      'Research similar initiatives in other areas'
    ];

    if (assessment.strategy.mechanism === 'DAO') {
      steps.push(
        'Draft DAO governance structure',
        'Design token distribution model',
        'Prepare technical documentation'
      );
    } else if (assessment.strategy.mechanism === 'HYBRID') {
      steps.push(
        'Design hybrid governance structure',
        'Prepare fundraising materials',
        'Identify key stakeholders'
      );
    } else {
      steps.push(
        'Create fundraising campaign materials',
        'Set up donation tracking system',
        'Plan community outreach events'
      );
    }

    return steps;
  }

  async cleanup(): Promise<void> {
    elizaLogger.info('Social Impact Agent cleaned up');
  }
} 