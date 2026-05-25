import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppElectron } from './App-Electron';
import './styles/global.css';

// Initialize the app
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppElectron />
  </React.StrictMode>
);

// Hide loading screen when app is ready
const loadingScreen = document.getElementById('loading-screen');
if (loadingScreen) {
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
  }, 1000);
}

// Handle Electron-specific setup
if (window.electronAPI) {
  console.log('Electron API available');

  // Listen for menu events
  window.electronAPI.on('menu:new-connection', () => {
    console.log('New connection requested from menu');
    // Handle in AppElectron component
  });

  window.electronAPI.on('menu:execute-query', () => {
    console.log('Execute query requested from menu');
    // Handle in AppElectron component
  });

  window.electronAPI.on('menu:preferences', () => {
    console.log('Preferences requested from menu');
    // Handle in AppElectron component
  });

  // Listen for tray actions
  window.electronAPI.on('tray:action', (event, { action }) => {
    console.log('Tray action:', action);
    // Handle in AppElectron component
  });

  // Listen for update status
  window.electronAPI.on('update-status', (event, status) => {
    console.log('Update status:', status);
    // Handle in AppElectron component
  });

  // Listen for database events
  window.electronAPI.on('database:connected', (event, data) => {
    console.log('Database connected:', data);
    // Handle in AppElectron component
  });

  window.electronAPI.on('database:disconnected', (event, data) => {
    console.log('Database disconnected:', data);
    // Handle in AppElectron component
  });

  window.electronAPI.on('query:started', (event, data) => {
    console.log('Query started:', data);
    // Handle in AppElectron component
  });

  window.electronAPI.on('query:completed', (event, data) => {
    console.log('Query completed:', data);
    // Handle in AppElectron component
  });

  window.electronAPI.on('query:error', (event, data) => {
    console.log('Query error:', data);
    // Handle in AppElectron component
  });

} else {
  console.warn('Electron API not available - running in browser mode');
}