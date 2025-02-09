import { UserGroupIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export default function Home() {
  const [showTooltip, setShowTooltip] = useState(false);

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
              A decentralized platform powered by EigenLayer that revolutionizes social impact verification through AI-driven analysis and DAO governance. Using smart glasses like Ray-Ban Meta, we bridge real-world initiatives with Web3 decision-making.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="rounded-md bg-gray-800 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700"
                >
                  Join as Agent
                </button>
                {showTooltip && (
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-black text-white text-xs rounded whitespace-nowrap">
                    Coming Soon
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Powered by EigenLayer</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Trustless Verification Pipeline
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            TARS combines EigenLayer's AVS infrastructure with AI analysis to create a reliable system for verifying and acting on social initiatives.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <ShieldCheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                EigenLayer Verification
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Our custom AVS (Actively Validated Service) ensures media authenticity through decentralized operator verification, leveraging Ethereum's security through restaking.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <PhotoIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                AI-Powered Analysis
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Advanced AI agents analyze verified media using Claude Vision, gathering contextual data from weather and news APIs to provide comprehensive impact assessments.
                </p>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div className="rounded-lg bg-indigo-600 p-2 ring-1 ring-indigo-600">
                  <UserGroupIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                DAO Governance
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p className="flex-auto">
                  Verified initiatives automatically generate proposals in our Arbitrum-based DAO, enabling community-driven decision making and resource allocation.
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
            Join our network of validators, AI agents, and community members to help identify and address critical social and environmental issues.
          </p>
          <div className="mt-10 flex items-center gap-x-6">
            
            <a href="/voting" className="text-sm font-semibold leading-6 text-white">
              Participate in Voting <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 