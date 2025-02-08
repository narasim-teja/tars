# TARS - AI Agent for Social Impact & Commerce

TARS is an AI agent that works with Meta Ray-Ban smart glasses to capture and analyze real-world experiences, create social impact initiatives, and facilitate commerce through crypto payments. The agent processes photos and videos from the glasses to identify social causes, create fundraising DAOs, and handle e-commerce transactions.

## Core Features

### Social Impact Analysis & DAO Creation
- Real-time photo/video analysis from Meta Ray-Ban glasses
- Location-based social issue identification
- Automated DAO/fundraiser creation for local causes
- Before/after documentation of improvements
- Social media campaign management
- Smart contract-based treasury management

### Crypto-Commerce Integration
- Amazon purchase automation via crypto payments
- Bitrefill gift card integration
- USDC payment processing
- Automated checkout process

### Media Processing
- Photo/video analysis using Twelve Labs
- Location and weather context integration
- Social media content optimization
- Automated video editing and effects
- Content monetization preparation

## Technical Stack

### Hardware
- Meta Ray-Ban Smart Glasses
  - Photo/video capture
  - GPS location tracking
  - Environmental data collection

### Blockchain & Smart Contracts
- EigenLayer AVS for data verification
- DAO smart contracts for fundraising
- Treasury management contracts
- USDC payment integration

### AI & Analysis
- Twelve Labs video analysis
- Location-based context analysis
- Weather data integration
- Social media optimization

## Use Cases

### 1. Social Cause Identification & Fundraising
Example: Water Conservation in Brookline
```
Input: Photo/video of water-related issues
↓
Analysis: Location + context + social media research
↓
Output: DAO creation + fundraising campaign + social media awareness
```

### 2. Crypto-Commerce Automation
Example: Amazon Purchase via Crypto
```
Input: Photo/video of desired product
↓
Process: Bitrefill USDC → Gift Card → Amazon checkout
↓
Output: Automated product purchase
```

## Setup

1. Hardware Requirements:
   - Meta Ray-Ban Smart Glasses
   - Internet connectivity
   - Mobile device for glasses pairing

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env
```

Required API Keys:
```
ANTHROPIC_API_KEY=your_key
OPEN_WEATHER_API_KEY=your_key
NEWS_API_KEY=your_key
TWELVE_LABS_API_KEY=your_key
BITREFILL_API_KEY=your_key
EIGENLAYER_RPC_URL=http://localhost:8545
EIGENLAYER_PRIVATE_KEY=your_key
```

## Smart Contract Deployment

1. Deploy DAO & Treasury contracts:
```bash
pnpm run deploy:dao
```

2. Deploy verification system:
```bash
pnpm run deploy:avs
```

## Running the Agent

1. Start the main service:
```bash
pnpm run start
```

2. Start the media processing service:
```bash
pnpm run start:media
```

3. Start the social analysis service:
```bash
pnpm run start:social
```

## Development

### Testing
```bash
pnpm test
```

### Local Development
```bash
pnpm run dev
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Meta for Ray-Ban smart glasses integration
- EigenLayer for blockchain verification
- Twelve Labs for video analysis
- Bitrefill for crypto-commerce integration
- OpenWeather for environmental data
- Local communities for social cause identification