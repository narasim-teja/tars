import Layout from './components/Layout'
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Media from './pages/Media';
import Voting from './pages/Voting';

function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: "848fbc8b-6287-4ef8-ad0e-558dd40a06f6",
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <Router>
        <Layout>
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-end gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm">
            <DynamicWidget />
          </div>

          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/media" element={<Media />} />
            <Route path="/voting" element={<Voting />} />
          </Routes>
        </Layout>
      </Router>
    </DynamicContextProvider>
  )
}

export default App
