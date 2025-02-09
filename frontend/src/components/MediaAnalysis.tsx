import { useState } from 'react';

interface AnalysisResult {
  imageUrl: string;
  location: string;
  timestamp: string;
  impactScore: number;
  analysis: string;
  relatedArticles: {
    title: string;
    url: string;
    source: string;
    summary: string;
  }[];
}

export default function MediaAnalysis() {
  // This would come from your backend/agent
  const [analysisResult] = useState<AnalysisResult>({
    imageUrl: "https://example.com/sample-image.jpg", // Replace with actual image
    location: "New York, USA",
    timestamp: "2024-02-09T12:00:00Z",
    impactScore: 85,
    analysis: "The image shows significant environmental impact with clear evidence of community engagement in local cleanup efforts. Multiple volunteers are visible participating in beach cleanup activities.",
    relatedArticles: [
      {
        title: "Local Community Leads Environmental Cleanup Initiative",
        url: "https://example.com/article1",
        source: "Local News",
        summary: "Community members gathered this weekend for a major beach cleanup effort, removing over 500 pounds of plastic waste."
      },
      {
        title: "Impact of Community-Led Environmental Projects",
        url: "https://example.com/article2",
        source: "Environmental Journal",
        summary: "Research shows that community-led environmental projects have 3x more lasting impact than government initiatives."
      }
    ]
  });

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {/* Image Section */}
      <div className="aspect-w-16 aspect-h-9 bg-gray-200">
        <img
          src={analysisResult.imageUrl}
          alt="Analysis subject"
          className="object-cover"
        />
      </div>

      {/* Analysis Details */}
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Media Analysis Results</h2>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(analysisResult.timestamp).toLocaleDateString()} • {analysisResult.location}
              </p>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-500">Impact Score:</span>
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${analysisResult.impactScore >= 80 ? 'bg-green-100 text-green-800' :
                  analysisResult.impactScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'}`}>
                {analysisResult.impactScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Analysis Text */}
        <div>
          <h3 className="text-lg font-medium text-gray-900">Analysis</h3>
          <p className="mt-2 text-gray-600">
            {analysisResult.analysis}
          </p>
        </div>

        {/* Related Articles */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Related News Articles</h3>
          <div className="space-y-4">
            {analysisResult.relatedArticles.map((article, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-base font-semibold text-gray-900">
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
                    {article.title}
                  </a>
                </h4>
                <p className="mt-1 text-sm text-gray-500">{article.source}</p>
                <p className="mt-2 text-sm text-gray-600">{article.summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Proposal
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Share Analysis
          </button>
        </div>
      </div>
    </div>
  );
} 