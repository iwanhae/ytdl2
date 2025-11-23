import React from 'react';
import Layout from './components/Layout';
import DownloadForm from './components/DownloadForm';
import VideoList from './components/VideoList';
import CommandList from './components/CommandList';
import { PlayerProvider } from './contexts/PlayerContext';

function App() {
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleCommandComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <PlayerProvider>
      <Layout>
        <DownloadForm />
        <CommandList onCommandComplete={handleCommandComplete} />
        <VideoList refreshKey={refreshKey} />
      </Layout>
    </PlayerProvider>
  );
}

export default App;
