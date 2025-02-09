import Layout from './components/Layout'
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";

function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: "848fbc8b-6287-4ef8-ad0e-558dd40a06f6",
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <Layout>
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-end gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm">
          <DynamicWidget />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">TARS Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Welcome to TARS - Transformative Action Recognition System
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900">Media Analysis</h2>
              <p className="mt-2 text-sm text-gray-600">
                Analyze photos and media content for social impact assessment.
              </p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900">Impact Assessment</h2>
              <p className="mt-2 text-sm text-gray-600">
                Evaluate and track social impact metrics through DAO governance.
              </p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900">DAO Management</h2>
              <p className="mt-2 text-sm text-gray-600">
                Manage community-driven decisions and resource allocation.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </DynamicContextProvider>
  )
}

export default App
