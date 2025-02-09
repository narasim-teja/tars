import { elizaLogger } from '@elizaos/core';

export interface FormattedAnalysis {
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
    camera?: {
      make?: string;
      model?: string;
      resolution?: string;
      settings?: {
        aperture?: number;
        focalLength?: number;
        iso?: number;
        exposureTime?: number;
        flash?: boolean;
      };
    };
    hash?: string;
  };
  analysis: {
    description: string;
    objects: string[];
    landmarks: string[];
    categories: string[];
    tags: string[];
    confidence: number;
  };
  context: {
    weather?: {
      temperature?: number;
      conditions?: string;
      humidity?: number;
      windSpeed?: number;
    };
    news?: {
      relevantArticles?: Array<{
        title: string;
        url: string;
        source: string;
        summary: string;
      }>;
    };
  };
  verification: {
    isVerified: boolean;
    method: string;
    timestamp: string;
    verifier: string;
    signature?: string;
    taskId?: string;
  };
  impactAssessment: {
    score: number;
    category: string;
    urgency: 'low' | 'medium' | 'high';
    estimatedImpact: string;
    recommendedActions: string[];
    stakeholders: string[];
  };
}

export function formatAnalysisForIPFS(
  imageAnalysis: any,
  metadata: any,
  contextualData: any,
  verification: any
): FormattedAnalysis {
  try {
    elizaLogger.info('Formatting analysis data for IPFS...');

    // Clean and format the objects array
    const cleanObjects = (imageAnalysis?.imageAnalysis?.objects || [])
      .map((obj: string) => obj.replace(/^\d+\.\s*-?\s*/, '').trim())
      .filter((obj: string) => obj && !obj.startsWith('While') && obj !== '-');

    // Clean and format the categories array
    const cleanCategories = (imageAnalysis?.imageAnalysis?.categories || [])
      .map((cat: string) => cat.replace(/^\d+\.\s*-?\s*/, '').trim())
      .filter((cat: string) => cat && !cat.startsWith('-'));

    // Clean and format landmarks array
    const cleanLandmarks = (imageAnalysis?.imageAnalysis?.landmarks || [])
      .map((l: string) => l.replace(/^\d+\.\s*-?\s*/, '').trim())
      .filter((l: string) => l && !l.startsWith('While'));

    // Clean and format tags array
    const cleanTags = (imageAnalysis?.imageAnalysis?.tags || [])
      .map((t: string) => t.replace(/^\d+\.\s*-?\s*/, '').trim())
      .filter((t: string) => t && !t.startsWith('While'));

    // Calculate impact score based on analysis
    const calculateImpactScore = () => {
      const baseScore = imageAnalysis?.imageAnalysis?.confidence || 0;
      const objectsScore = cleanObjects.length * 5;
      const categoriesScore = cleanCategories.length * 5;
      return Math.min(Math.round((baseScore + objectsScore + categoriesScore) / 3), 100);
    };

    // Determine urgency based on categories and context
    const determineUrgency = () => {
      const urgentKeywords = ['disaster', 'emergency', 'critical', 'immediate'];
      const hasUrgentContext = cleanCategories.some(cat => 
        urgentKeywords.some(keyword => cat.toLowerCase().includes(keyword))
      );
      return hasUrgentContext ? 'high' : 'medium';
    };

    // Get location coordinates from metadata or contextual data
    const coordinates = {
      lat: metadata?.latitude || metadata?.gps?.latitude || contextualData?.location?.coordinates?.lat || 0,
      lng: metadata?.longitude || metadata?.gps?.longitude || contextualData?.location?.coordinates?.lng || 0
    };

    // Get weather data from metadata or contextual data
    const weatherData = metadata?.weather || contextualData?.weather;

    elizaLogger.debug('Processing coordinates from metadata:', {
      latitude: metadata?.latitude,
      longitude: metadata?.longitude,
      gps: metadata?.gps
    });

    const formattedData: FormattedAnalysis = {
      metadata: {
        timestamp: imageAnalysis?.timestamp || new Date().toISOString(),
        location: {
          coordinates,
          address: contextualData?.location?.address,
          city: contextualData?.location?.city,
          state: contextualData?.location?.state,
          country: contextualData?.location?.country
        },
        camera: {
          make: imageAnalysis?.camera?.split(' ')[0] || metadata?.Make,
          model: imageAnalysis?.camera?.split(' ').slice(1).join(' ') || metadata?.Model,
          resolution: imageAnalysis?.resolution || `${metadata?.ImageWidth}x${metadata?.ImageHeight}`,
          settings: {
            aperture: imageAnalysis?.aperture || metadata?.FNumber,
            focalLength: imageAnalysis?.focalLength || metadata?.FocalLength,
            iso: imageAnalysis?.iso || metadata?.ISO,
            exposureTime: imageAnalysis?.exposureTime || metadata?.ExposureTime,
            flash: typeof imageAnalysis?.flash === 'boolean' ? imageAnalysis.flash : metadata?.Flash
          }
        },
        hash: imageAnalysis?.hash
      },
      analysis: {
        description: imageAnalysis?.imageAnalysis?.description?.replace(/^\d+\.\s*/, '') || '',
        objects: cleanObjects,
        landmarks: cleanLandmarks,
        categories: cleanCategories,
        tags: cleanTags,
        confidence: imageAnalysis?.imageAnalysis?.confidence || 0
      },
      context: {
        weather: weatherData ? {
          temperature: weatherData.temperature,
          conditions: weatherData.conditions,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed
        } : undefined,
        news: contextualData?.news ? {
          relevantArticles: contextualData.news.articles?.map((article: any) => ({
            title: article.title,
            url: article.url,
            source: article.source,
            summary: article.summary
          }))
        } : undefined
      },
      verification: {
        isVerified: verification?.success || false,
        method: 'EigenLayer AVS',
        timestamp: new Date().toISOString(),
        verifier: 'TARS Image Verification Service',
        taskId: verification?.taskId,
        signature: verification?.signature
      },
      impactAssessment: {
        score: calculateImpactScore(),
        category: cleanCategories[0] || 'Uncategorized',
        urgency: determineUrgency(),
        estimatedImpact: 'To be assessed by DAO members',
        recommendedActions: [
          'Document current conditions',
          'Engage local stakeholders',
          'Create DAO proposal for resource allocation',
          'Monitor progress and impact'
        ],
        stakeholders: [
          'Local community members',
          'Environmental agencies',
          'Local government',
          'DAO members'
        ]
      }
    };

    elizaLogger.info('Analysis data formatted successfully');
    elizaLogger.debug('Location coordinates:', coordinates);
    elizaLogger.debug('Weather data:', weatherData);
    
    return formattedData;
  } catch (error) {
    elizaLogger.error('Error formatting analysis data:', error);
    throw error;
  }
} 