import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class WebErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error occurred.'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Quick Karya Web ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B192C] text-white flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-[#001F3F] border border-[#FFA500]/40 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#FFA500]/20 text-[#FFA500] flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold">Quick Karya Recovery</h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Something went wrong while loading this screen. Your saved data is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-[#FFA500] hover:bg-[#FF8C00] text-[#001F3F] font-extrabold text-xs rounded-xl cursor-pointer"
            >
              Reload Quick Karya
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebErrorBoundary>
      <App />
    </WebErrorBoundary>
  </StrictMode>,
);
