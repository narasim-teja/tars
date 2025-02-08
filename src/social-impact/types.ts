export interface MediaAnalysis {
  imageUrl: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  timestamp: number;
  detectedObjects: string[];
  scenarioDescription: string;
  confidenceScore: number;
}

export interface VerificationResult {
  isVerified: boolean;
  verificationMethod: string;
  verificationTimestamp: number;
  verifierAddress: string;
  transactionHash?: string;
}

export interface ImpactAssessment {
  totalScore: number;
  categories: {
    urgency: number;
    scope: number;
    sustainability: number;
    feasibility: number;
    communityBenefit: number;
  };
  issue: {
    title: string;
    description: string;
    category: string;
    affectedPopulation: number;
    estimatedTimeframe: string;
  };
  strategy: {
    mechanism: 'DAO' | 'HYBRID' | 'TRADITIONAL';
    targetAmount: string;
    timeline: string;
    milestones: string[];
    stakeholders: string[];
  };
  onChainRequirements: {
    contractType: string;
    estimatedGas: string;
    requiredTokens: string[];
    governance: {
      votingPeriod: number;
      quorum: number;
      proposalThreshold: string;
    };
  };
}

export interface AgentResponse {
  assessment: ImpactAssessment;
  recommendation: string;
  nextSteps: string[];
} 