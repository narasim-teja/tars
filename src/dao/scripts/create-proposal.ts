import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

// Contract ABI for proposal creation
const CONTRACT_ABI = [
  "function createProposal(string calldata description) external returns (bytes32)",
  "event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline)"
];

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

async function fetchIPFSData(cid: string): Promise<IPFSAnalysis> {
  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching IPFS data:", error);
    throw error;
  }
}

export async function createProposalFromIPFS(ipfsCID: string) {
  console.log("Creating proposal from IPFS data...");

  // Get the private key and check if it exists
  const privateKey = process.env.CREATE_PROPOSAL_PRIVATE_KEY;
  const contractAddress = process.env.DAO_CONTRACT_ADDRESS;
  if (!privateKey) {
    throw new Error("CREATE_PROPOSAL_PRIVATE_KEY not found in environment variables");
  }
  if (!contractAddress) {
    throw new Error("DAO_CONTRACT_ADDRESS not found in environment variables");
  }

  try {
    // Fetch data from IPFS
    console.log("Fetching data from IPFS...");
    const ipfsData = await fetchIPFSData(ipfsCID);
    
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
Verification Status: Verified via IPFS (CID: ${ipfsCID})

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
- Full Analysis: https://gateway.pinata.cloud/ipfs/${ipfsCID}
- Confidence Score: ${ipfsData.analysis.confidence}%

Verification Details:
This proposal has been automatically generated from verified IPFS data. 
All information has been cryptographically secured and can be independently verified.
    `.trim();

    // Connect to Arbitrum Sepolia
    const provider = new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Get the contract instance
    const dao = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

    try {
      // Create the proposal
      console.log("Submitting proposal transaction...");
      const tx = await dao.createProposal(description);
      console.log("Transaction hash:", tx.hash);

      // Wait for the transaction to be mined
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      // Get the proposal ID from the event
      const event = receipt.logs.find(
        (log: any) => log.topics[0] === dao.interface.getEvent('ProposalCreated')!.topicHash
      )!;

      if (!event) {
        throw new Error('Proposal creation event not found');
      }

      const parsedEvent = dao.interface.parseLog({
        topics: event.topics,
        data: event.data
      });

      const proposalId = parsedEvent?.args?.[0];
      
      return {
        success: true,
        proposalId,
        description,
        txHash: tx.hash,
        ipfsCID
      };

    } catch (error) {
      console.error("Error creating proposal:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error processing IPFS data:", error);
    throw error;
  }
}

// Allow running directly from command line
if (require.main === module) {
  const ipfsCID = process.argv[2] || 'bafkreibs6jwrngekdadfqunyj2xuwd3oejicygzztfm25jhonzkocutcwm';

  createProposalFromIPFS(ipfsCID)
    .then(result => {
      console.log("Proposal created successfully!");
      console.log("Proposal ID:", result.proposalId);
      console.log("Transaction Hash:", result.txHash);
      console.log("IPFS CID:", result.ipfsCID);
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
