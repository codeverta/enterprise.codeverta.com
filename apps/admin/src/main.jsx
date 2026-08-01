import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router";
import { Toaster } from "@/components/ui/sonner"
import * as Sentry from "@sentry/react";
import { ChatProvider } from "@/context/ChatContext"; // sesuaikan path
import { initializeFontPreference } from "@/lib/font-preference";

initializeFontPreference();

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true
});

createRoot(document.getElementById('root')).render(
  // <StrictMode>
    <>
    <ChatProvider>
      <App />
      <Toaster theme="light" richColors position="top-right" />
      </ChatProvider>
    </>
  // </StrictMode>,
)
