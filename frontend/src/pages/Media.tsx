import { useState } from 'react';
import MediaAnalysis from '../components/MediaAnalysis';

interface AnalysisFilter {
  status: 'all' | 'monitoring' | 'verified' | 'voting';
  timeframe: 'all' | 'today' | 'week' | 'month';
  location: string;
}

export default function Media() {
  const [filters, setFilters] = useState<AnalysisFilter>({
    status: 'all',
    timeframe: 'all',
    location: '',
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Media Analysis</h1>
            <p className="mt-2 text-sm text-gray-700">
              Real-time analysis of media content from various sources, monitored and verified by our AI agent.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as AnalysisFilter['status'] })}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="monitoring">Monitoring</option>
            <option value="verified">Verified</option>
            <option value="voting">Ready for Voting</option>
          </select>

          <select
            value={filters.timeframe}
            onChange={(e) => setFilters({ ...filters, timeframe: e.target.value as AnalysisFilter['timeframe'] })}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <input
            type="text"
            placeholder="Filter by location..."
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        {/* Analysis Grid */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <MediaAnalysis />
          <MediaAnalysis />
          {/* Add more MediaAnalysis components as needed */}
        </div>

        {/* Load More Button */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Load More
          </button>
        </div>
      </div>
    </div>
  );
} 