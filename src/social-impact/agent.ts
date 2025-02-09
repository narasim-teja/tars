import { AgentRuntime, elizaLogger, type Character, stringToUuid, Memory } from '@elizaos/core';
import { ImpactEvaluator } from './evaluators/impact.evaluator.js';
import { MediaAnalysis, VerificationResult, ImpactAssessment, AgentResponse } from './types';
import { createProposalAction, CreateProposalResult } from './actions/create-proposal.action.js';

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
      actions: [createProposalAction],
      services: [],
      managers: [],
      cacheManager: config.cacheManager
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
    elizaLogger.info('Social Impact Agent initialized');
  }

  async handleMessage(message: Memory): Promise<any> {
    const content = message.content as any;
    const text = (content?.text || '').toLowerCase().trim();

    elizaLogger.info('Handling message:', { text });

    // Find the create proposal action
    const createAction = this.actions.find(action => action.name === 'CREATE_PROPOSAL');
    if (!createAction) {
      elizaLogger.error('CREATE_PROPOSAL action not found in available actions:', 
        this.actions.map(a => a.name));
      return {
        text: 'Sorry, the proposal creation functionality is not available.',
        type: 'text'
      };
    }

    elizaLogger.info('Found CREATE_PROPOSAL action, validating...');
    
    // Validate if this is a proposal creation request
    const isValidProposalRequest = await createAction.validate(this, message);
    elizaLogger.info('Validation result:', { isValidProposalRequest });
    
    if (isValidProposalRequest) {
      elizaLogger.info('Handling proposal creation request...');
      const result = await createAction.handler(this, message) as CreateProposalResult;
      elizaLogger.info('Proposal creation result:', { success: result.success, proposalId: result.proposalId });
      
      if (result.success && result.proposalId) {
        return {
          text: result.message || `✅ Proposal created!\n\nProposal ID: ${result.proposalId}\n\nMembers can now vote on this proposal through the DAO interface.`,
          type: 'text'
        };
      } else {
        return {
          text: result.error || 'Failed to create proposal. Please ensure all required data is available.',
          type: 'text'
        };
      }
    }

    // If not a proposal creation request, check for media analysis
    if (content?.mediaAnalysis || content?.verificationResult) {
      elizaLogger.info('Processing media analysis request...');
      return this.assessImpact({
        mediaAnalysis: content.mediaAnalysis,
        verificationResult: content.verificationResult
      });
    }

    // If no specific command matched, provide guidance
    elizaLogger.info('No specific command matched, providing guidance');
    return {
      text: `I can help you create proposals for social impact initiatives. Here's what I can do:

1. Analyze media content (images/videos) of social initiatives
2. Verify the authenticity of the content
3. Create on-chain proposals for verified initiatives

To get started:
- Share media content for analysis
- Request content verification
- Create a proposal once verified

How can I assist you today?`,
      type: 'text'
    };
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