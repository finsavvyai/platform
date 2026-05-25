import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioBuilder } from './components/StudioBuilder';
import { LandingPage } from './components/LandingPage';
import { DemoCanvas } from './components/DemoCanvas';
import { ProductMap } from './components/ProductMap/ProductMap';

type Route = 'landing' | 'app' | 'demo' | 'map';

function resolveRoute(): Route {
  const hash = window.location.hash;
  if (hash === '#app' || hash === '#login') return 'app';
  if (hash === '#demo') return 'demo';
  if (hash === '#map') return 'map';
  return 'landing';
}

function App() {
  const [route, setRoute] = useState<Route>(resolveRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(resolveRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSignIn = useCallback(() => {
    window.location.hash = '#app';
  }, []);

  if (route === 'map') {
    return <ProductMap />;
  }

  if (route === 'demo') {
    return <DemoCanvas onSignIn={handleSignIn} />;
  }

  if (route === 'app') {
    return <StudioBuilder />;
  }

  return <LandingPage onSignIn={handleSignIn} />;
}

const root = document.getElementById('studio-root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
