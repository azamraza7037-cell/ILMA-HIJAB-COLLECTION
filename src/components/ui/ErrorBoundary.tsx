'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 text-center bg-ivory text-black rounded-xl my-4">
            <h2 className="font-playfair text-xl mb-2 text-[#C9A96E]">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">We are currently refreshing this section.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-[#C9A96E] text-black text-xs font-semibold uppercase tracking-wider rounded"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
