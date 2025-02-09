// import { MediaAnalystAgent } from '../agent.js';
// import { PhotoAnalyzer } from './photo-analyzer.js';
// import { TestDatabaseAdapter } from './test-db-adapter.js';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { ModelProviderName } from '@elizaos/core';
// import fs from 'fs/promises';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// async function main() {
//   try {
//     // Load the character configuration
//     const characterPath = path.join(__dirname, '../../../characters/photo_analyst.character.json');
//     const character = JSON.parse(await fs.readFile(characterPath, 'utf-8'));

//     // Create test database adapter
//     const dbAdapter = new TestDatabaseAdapter();
//     await dbAdapter.init();

//     // Create the agent
//     const agent = new MediaAnalystAgent({
//       character: {
//         ...character,
//         modelProvider: ModelProviderName.ANTHROPIC
//       },
//       databaseAdapter: dbAdapter,
//       token: process.env.ANTHROPIC_API_KEY || '',
//       cacheManager: null // For testing only
//     });

//     // Initialize the agent
//     await agent.initialize();

//     // Create the analyzer
//     const analyzer = new PhotoAnalyzer(agent);

//     // Ensure test directory exists
//     const testPhotoDir = path.join(__dirname, '../../../test/photos');
    
//     await fs.mkdir(testPhotoDir, { recursive: true });
    
//     console.log(`Analyzing photos in: ${testPhotoDir}`);
//     const results = await analyzer.analyzeDirectory(testPhotoDir);
//     console.log('Analysis Results:', JSON.stringify(results, null, 2));

//     // Cleanup
//     await agent.cleanup();
//   } catch (error) {
//     console.error('Test failed:', error);
//     process.exit(1);
//   }
// }

// // Run the test if this script is executed directly
// if (process.argv[1] === fileURLToPath(import.meta.url)) {
//   main().catch(console.error);
// } 