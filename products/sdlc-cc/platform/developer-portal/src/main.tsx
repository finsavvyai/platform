import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider, ToastViewport } from '@/components/ui/Toast'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
        <ToastViewport />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
