import { Action, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

export interface CreateProposalResult {
  success: boolean;
  proposalId?: string;
  message?: string;
  error?: string;
  txHash?: string;
  ipfsCID?: string;
}

interface IPFSAnalysis {
  metadata: {
    timestamp: string;
    location: {
      coordinates: {
        lat: number;
        lng: number;
      };
      address?: string;
      city?: string;
      state?: string;
      country?: string;
    };
  };
  analysis: {
    description: string;
    categories: string[];
    confidence: number;
  };
  context: {
    weather?: {
      temperature?: number;
      conditions?: string;
    };
    news?: {
      relevantArticles?: Array<{
        title: string;
        url: string;
      }>;
    };
  };
  impactAssessment: {
    score: number;
    category: string;
    urgency: string;
    estimatedImpact: string;
    recommendedActions: string[];
  };
}

// Contract ABI for proposal creation
const CONTRACT_ABI = [
  "function createProposal(string calldata description) external returns (bytes32)",
  "event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline)"
];

interface ProcessedCID {
  cid: string;
  proposalId: string;
  timestamp: string;
  status: 'success' | 'failed';
  txHash?: string;
}

// Track processed CIDs
const PROCESSED_CIDS_FILE = 'processed-cids.json';

async function loadProcessedCIDs(): Promise<ProcessedCID[]> {
  try {
    const data = await fs.readFile(PROCESSED_CIDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    await fs.writeFile(PROCESSED_CIDS_FILE, '[]', 'utf8');
    return [];
  }
}

async function isAlreadyProcessed(cid: string): Promise<boolean> {
  const processed = await loadProcessedCIDs();
  return processed.some(p => p.cid === cid);
}

async function saveProcessedCID(cid: ProcessedCID) {
  const processed = await loadProcessedCIDs();
  processed.push(cid);
  await fs.writeFile(PROCESSED_CIDS_FILE, JSON.stringify(processed, null, 2));
}

async function listPinataFiles(): Promise<string[]> {
  try {
    const response = await axios.get('https://api.pinata.cloud/data/pinList', {
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
      }
    });

    // Filter for analysis JSON files
    return response.data.rows
      .filter((row: any) => row.metadata.name.startsWith('analysis-'))
      .map((row: any) => row.ipfs_pin_hash);
  } catch (error) {
    elizaLogger.error('Error fetching Pinata files:', error);
    throw error;
  }
}

async function processNewAnalyses(): Promise<CreateProposalResult[]> {
  try {
    // Load already processed CIDs
    const processedCIDs = await loadProcessedCIDs();
    const processedHashes = new Set(processedCIDs.map(p => p.cid));

    // Get list of all analysis files from Pinata
    const allCIDs = await listPinataFiles();
    
    // Filter for unprocessed CIDs
    const newCIDs = allCIDs.filter(cid => !processedHashes.has(cid));
    
    if (newCIDs.length === 0) {
      return [{
        success: false,
        message: 'No new analyses found to process'
      }];
    }

    const results: CreateProposalResult[] = [];

    // Process each new CID
    for (const cid of newCIDs) {
      try {
        // Double check if CID is already processed (in case of concurrent operations)
        if (await isAlreadyProcessed(cid)) {
          results.push({
            success: false,
            message: `CID ${cid} has already been processed into a proposal`,
            ipfsCID: cid
          });
          continue;
        }

        // Fetch and validate IPFS data
        const ipfsData = await fetchIPFSData(cid);
        
        // Create proposal
        const result = await createProposal(ipfsData, cid);
        
        // Record the processed CID
        await saveProcessedCID({
          cid,
          proposalId: result.proposalId!,
          timestamp: new Date().toISOString(),
          status: result.success ? 'success' : 'failed',
          txHash: result.txHash
        });

        results.push(result);
      } catch (error) {
        elizaLogger.error(`Error processing CID ${cid}:`, error);
        results.push({
          success: false,
          error: `Failed to process CID ${cid}: ${error.message}`,
          ipfsCID: cid
        });
      }
    }

    return results;
  } catch (error) {
    elizaLogger.error('Error processing new analyses:', error);
    throw error;
  }
}

async function createProposal(ipfsData: IPFSAnalysis, cid: string): Promise<CreateProposalResult> {
  // Validate environment variables
  if (!process.env.ARB_SEPOLIA_RPC_URL) {
    throw new Error('ARB_SEPOLIA_RPC_URL not configured in environment');
  }
  if (!process.env.CREATE_PROPOSAL_PRIVATE_KEY) {
    throw new Error('CREATE_PROPOSAL_PRIVATE_KEY not configured in environment');
  }
  if (!process.env.DAO_CONTRACT_ADDRESS) {
    throw new Error('DAO_CONTRACT_ADDRESS not configured in environment');
  }

  // Format the location string
  const location = [
    ipfsData.metadata.location.city,
    ipfsData.metadata.location.state,
    ipfsData.metadata.location.country
  ].filter(Boolean).join(", ");

  // Format the proposal description
  const description = `
Impact Initiative Proposal

Location: ${location}
Coordinates: ${ipfsData.metadata.location.coordinates.lat}, ${ipfsData.metadata.location.coordinates.lng}
Impact Score: ${ipfsData.impactAssessment.score}
Urgency: ${ipfsData.impactAssessment.urgency}
Category: ${ipfsData.impactAssessment.category}
Verification Status: Verified via IPFS (CID: ${cid})

Description:
${ipfsData.analysis.description}

Current Conditions:
- Weather: ${ipfsData.context.weather?.conditions || 'N/A'} (${ipfsData.context.weather?.temperature || 'N/A'}°C)
${ipfsData.context.news?.relevantArticles ? `
Recent Related News:
${ipfsData.context.news.relevantArticles.slice(0, 2).map(article => `- ${article.title}`).join('\n')}` : ''}

Estimated Impact:
${ipfsData.impactAssessment.estimatedImpact}

Recommended Actions:
${ipfsData.impactAssessment.recommendedActions.map(action => `- ${action}`).join('\n')}

Evidence:
- Full Analysis: https://gateway.pinata.cloud/ipfs/${cid}
- Confidence Score: ${ipfsData.analysis.confidence}%

Verification Details:
This proposal has been automatically generated from verified IPFS data. 
All information has been cryptographically secured and can be independently verified.
  `.trim();

  // Connect to Arbitrum Sepolia
  const provider = new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.CREATE_PROPOSAL_PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(process.env.DAO_CONTRACT_ADDRESS!, CONTRACT_ABI, wallet);

  // Create the proposal
  const tx = await contract.createProposal(description);
  const receipt = await tx.wait();

  // Get the proposal ID from the event
  const event = receipt.logs.find(
    (log: any) => log.topics[0] === contract.interface.getEvent('ProposalCreated').topicHash
  )!;

  if (!event) {
    throw new Error('Proposal creation event not found');
  }

  const parsedEvent = contract.interface.parseLog({
    topics: event.topics,
    data: event.data
  });

  const proposalId = parsedEvent?.args?.[0];

  return {
    success: true,
    proposalId,
    txHash: tx.hash,
    ipfsCID: cid,
    message: `Proposal created successfully\nID: ${proposalId}\nTransaction: ${tx.hash}\nIPFS CID: ${cid}`
  };
}

async function validateIPFSData(data: any): Promise<IPFSAnalysis> {
  if (!data) {
    throw new Error('No data received from IPFS');
  }

  const errors: string[] = [];

  // Validate required fields with detailed error messages
  if (!data.metadata?.timestamp) {
    errors.push('Missing required field: metadata.timestamp');
  }

  // Check if location coordinates exist
  if (!data.metadata?.location?.coordinates) {
    errors.push('Missing required field: metadata.location.coordinates');
  } else {
    // Validate coordinates are numbers (even if 0)
    const { lat, lng } = data.metadata.location.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('Invalid coordinates: lat and lng must be numbers');
    }
  }

  if (!data.analysis?.description) {
    errors.push('Missing required field: analysis.description');
  }

  if (!data.impactAssessment?.score) {
    errors.push('Missing required field: impactAssessment.score');
  }

  // If there are any validation errors, throw them all at once
  if (errors.length > 0) {
    throw new Error(`IPFS data validation failed:\n${errors.join('\n')}`);
  }

  return data as IPFSAnalysis;
}

async function fetchIPFSData(cid: string): Promise<IPFSAnalysis> {
  try {
    elizaLogger.info(`Fetching IPFS data for CID: ${cid}`);
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
    const validatedData = await validateIPFSData(response.data);
    elizaLogger.info('Successfully validated IPFS data structure');
    return validatedData;
  } catch (error) {
    if (error instanceof Error) {
      elizaLogger.error('Error fetching/validating IPFS data:', error.message);
      throw new Error(`IPFS data error: ${error.message}`);
    }
    throw error;
  }
}

export const createProposalAction: Action = {
  name: 'CREATE_PROPOSAL',
  description: 'Create a new proposal in the TARS DAO for a verified social impact initiative',
  similes: ['CREATE_PROPOSAL', 'SUBMIT_PROPOSAL', 'PROPOSE', 'create proposal', 'submit proposal'],
  examples: [
    [{
      user: 'user',
      content: { 
        text: 'Create proposal',
        type: 'text'
      }
    }]
  ],

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as any;
    const text = content?.text?.toLowerCase() || '';
    return text.includes('create proposal') || 
           text.includes('submit proposal') || 
           text.includes('propose');
  },

  async handler(runtime: IAgentRuntime, message: Memory): Promise<CreateProposalResult | CreateProposalResult[]> {
    try {
      elizaLogger.info('Starting proposal creation process...');
      
      // Process all new analyses
      const results = await processNewAnalyses();
      
      if (results.length === 0) {
        return {
          success: false,
          message: 'No new analyses found to process into proposals'
        };
      }

      // Count different types of results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const duplicateCount = results.filter(r => r.message?.includes('already been processed')).length;
      
      const summaryMessage = `Processed ${results.length} analyses:
- ${successCount} proposals created successfully
- ${duplicateCount} were already processed
- ${failureCount - duplicateCount} failed to process

Details:
${results.map(r => {
  if (r.success) {
    return `✅ Created proposal ${r.proposalId} for CID ${r.ipfsCID}`;
  } else if (r.message?.includes('already been processed')) {
    return `ℹ️ Skipped CID ${r.ipfsCID} - already processed`;
  } else {
    return `❌ Failed to process CID ${r.ipfsCID}: ${r.error}`;
  }
}).join('\n')}`;

      return {
        success: successCount > 0 || duplicateCount > 0,
        message: summaryMessage,
        error: (failureCount - duplicateCount) > 0 ? 'Some proposals failed to create' : undefined
      };

    } catch (error) {
      elizaLogger.error('Error in proposal creation process:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}; 