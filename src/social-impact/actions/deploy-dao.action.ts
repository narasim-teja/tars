import { Action, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { exec } from 'child_process';
import { ethers } from 'ethers';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DeployDAOResult {
  success: boolean;
  contractAddress?: string;
  message?: string;
  error?: string;
}

export const deployDAOAction: Action = {
  name: 'DEPLOY_DAO',
  description: 'Deploy the TarsDAO smart contract to Arbitrum Sepolia testnet',
  similes: ['DEPLOY_CONTRACT', 'CREATE_DAO', 'SETUP_DAO', 'deploy', 'create dao', 'setup dao'],
  examples: [
    [{
      user: 'user',
      content: { 
        text: 'Deploy the DAO contract',
        type: 'text'
      }
    }],
    [{
      user: 'user',
      content: {
        text: 'Setup new DAO',
        type: 'text'
      }
    }]
  ],

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as any;
    const text = content?.text?.toLowerCase() || '';
    return text.includes('deploy') || text.includes('create dao') || text.includes('setup dao');
  },

  async handler(runtime: IAgentRuntime, message: Memory): Promise<DeployDAOResult> {
    try {
      elizaLogger.info('Starting DAO deployment process on Arbitrum Sepolia...');
      
      // Get the path to the dao directory
      const daoPath = path.join(process.cwd(), 'src', 'dao');

      // Check if we can connect to Arbitrum Sepolia
      try {
        const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
        await provider.getBlockNumber();
        elizaLogger.info('Successfully connected to Arbitrum Sepolia');
      } catch (error) {
        elizaLogger.error('Arbitrum Sepolia connection error:', error);
        return {
          success: false,
          error: 'Could not connect to Arbitrum Sepolia. Please check your network connection and RPC URL.'
        };
      }

      elizaLogger.info('Deploying DAO contract to Arbitrum Sepolia...');
      // Deploy contract
      const { stdout: deployOutput, stderr: deployError } = await execAsync(
        'npx hardhat run scripts/deploy.ts --network arbitrumSepolia',
        { 
          cwd: daoPath,
          maxBuffer: 1024 * 1024 * 10 
        }
      );

      elizaLogger.info('Deploy output:', deployOutput);
      if (deployError) {
        elizaLogger.error('Deploy error:', deployError);
        throw new Error(`Deploy error: ${deployError}`);
      }

      // Parse contract address from deploy output
      const addressMatch = deployOutput.match(/TarsDAO deployed to:\s*(0x[a-fA-F0-9]{40})/);
      const contractAddress = addressMatch ? addressMatch[1] : null;

      if (!contractAddress) {
        elizaLogger.error('Could not parse contract address from output:', deployOutput);
        throw new Error('Could not find deployed contract address in output');
      }

      elizaLogger.info('Contract deployed successfully to Arbitrum Sepolia at:', contractAddress);

      return {
        success: true,
        contractAddress,
        message: `TarsDAO contract deployed successfully to Arbitrum Sepolia\nVerify at: https://sepolia.arbiscan.io/address/${contractAddress}`
      };

    } catch (error) {
      elizaLogger.error('Error deploying DAO contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}; 