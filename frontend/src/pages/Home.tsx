import { ChartBarIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import { PhotoIcon } from "@heroicons/react/24/outline";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero section */}
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-4xl py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              TARS - Transformative Action Recognition System
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              A decentralized platform that empowers communities to identify, verify, and act on social and environmental issues through AI-powered media analysis and democratic decision-making.
            </p>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">How It Works</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            From Detection to Action
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <PhotoIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Media Analysis
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Our AI agent continuously monitors and analyzes media content from various sources for 2-3 days to identify potential social and environmental issues.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <ChartBarIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Impact Assessment
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Each issue is assigned an impact score based on its urgency, scope, and potential for positive change through community action.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <UserGroupIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                Community Voting
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  High-impact issues are moved to the DAO voting system, where community members can propose and vote on solutions.
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* CTA section */}
      <div className="mt-32 bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to make an impact?
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Join our community of change-makers and help drive positive transformation in your area.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            <a
              href="/media"
              className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              View Media Analysis
            </a>
            <a href="/voting" className="text-sm font-semibold leading-6 text-white">
              Participate in Voting <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 