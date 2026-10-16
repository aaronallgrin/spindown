import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './index.css';
import { StoreProvider } from './store';
import { startAutoSync } from './sync';
import Home from './pages/Home';
import Play from './pages/Play';
import History from './pages/History';
import GameDetail from './pages/GameDetail';
import Judge, { RuleView } from './pages/Judge';
import Stats from './pages/Stats';
import Query from './pages/Query';
import Sync from './pages/Sync';
import Join from './pages/Join';

startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<GameDetail />} />
          <Route path="/judge" element={<Judge />} />
          <Route path="/judge/rule/:n" element={<RuleView />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/query" element={<Query />} />
          <Route path="/sync" element={<Sync />} />
          <Route path="/join/:code" element={<Join />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
