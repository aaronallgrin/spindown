import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';
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
import { lazyRoute } from './lazyPage';
import RouteError from './pages/RouteError';

// Home, New game and the table load with the app; everything else loads on first visit
const def = (m: { default: ComponentType }) => m.default;
const router = createHashRouter([
  {
    // a broken page or a mistyped link lands on a friendly screen, not a stack trace
    errorElement: <RouteError />,
    children: [
      { path: '/', Component: Home },
      { path: '/new', Component: NewGame },
      { path: '/play', Component: Play },
      { path: '/history', lazy: lazyRoute(() => import('./pages/History'), def) },
      { path: '/history/:id', lazy: lazyRoute(() => import('./pages/GameDetail'), def) },
      { path: '/judge', lazy: lazyRoute(() => import('./pages/Judge'), def) },
      { path: '/judge/rule/:n', lazy: lazyRoute(() => import('./pages/Judge'), (m) => m.RuleView) },
      { path: '/stats', lazy: lazyRoute(() => import('./pages/Stats'), def) },
      { path: '/query', lazy: lazyRoute(() => import('./pages/Query'), def) },
      { path: '/sync', lazy: lazyRoute(() => import('./pages/Sync'), def) },
      { path: '/join/:code', lazy: lazyRoute(() => import('./pages/Join'), def) },
      { path: '/find', lazy: lazyRoute(() => import('./pages/FindGame'), def) },
      { path: '/find/new', lazy: lazyRoute(() => import('./pages/FindGame'), (m) => m.NewPoll) },
      { path: '/poll/:id', lazy: lazyRoute(() => import('./pages/Poll'), def) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  </StrictMode>,
);
