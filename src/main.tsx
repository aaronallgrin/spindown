import { StrictMode, Suspense } from 'react';
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
import NewGame from './pages/NewGame';
import Play from './pages/Play';
import { lazyPage } from './lazyPage';

// Home, New game and the table load with the app; everything else loads on first visit
const History = lazyPage(() => import('./pages/History'));
const GameDetail = lazyPage(() => import('./pages/GameDetail'));
const Judge = lazyPage(() => import('./pages/Judge'));
const RuleView = lazyPage(() => import('./pages/Judge').then((m) => ({ default: m.RuleView })));
const Stats = lazyPage(() => import('./pages/Stats'));
const Query = lazyPage(() => import('./pages/Query'));
const Sync = lazyPage(() => import('./pages/Sync'));
const Join = lazyPage(() => import('./pages/Join'));
const FindGame = lazyPage(() => import('./pages/FindGame'));
const NewPoll = lazyPage(() => import('./pages/FindGame').then((m) => ({ default: m.NewPoll })));
const Poll = lazyPage(() => import('./pages/Poll'));

startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewGame />} />
          <Route path="/play" element={<Play />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<GameDetail />} />
          <Route path="/judge" element={<Judge />} />
          <Route path="/judge/rule/:n" element={<RuleView />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/query" element={<Query />} />
          <Route path="/sync" element={<Sync />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/find" element={<FindGame />} />
          <Route path="/find/new" element={<NewPoll />} />
          <Route path="/poll/:id" element={<Poll />} />
        </Routes>
        </Suspense>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
