import Layout from './components/Layout';
import DownloadForm from './components/DownloadForm';
import VideoList from './components/VideoList';
import CommandList from './components/CommandList';
import { PlayerProvider } from './contexts/PlayerContext';

function App() {
  return (
    <PlayerProvider>
      <Layout>
        <DownloadForm />
        <CommandList />
        <VideoList />
      </Layout>
    </PlayerProvider>
  );
}

export default App;
