import React, { Component, ReactNode, ErrorInfo, ReactElement } from 'react';
import { getLogger } from '../../utils/logger';
import { handleError } from '../../utils/errorHandler';

// Get a dedicated logger for the error boundary
const logger = getLogger('error-boundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  renderFallback?: (error: Error, errorInfo: ErrorInfo) => ReactElement;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches errors in its child component tree,
 * logs them, and displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;
    
    // Log the error through our error handling system
    logger.error('Error caught by boundary:', error);
    
    // Call our centralized error handler
    handleError(error, { 
      componentStack: errorInfo.componentStack,
      boundary: true
    });
    
    // Update state with error details for rendering
    this.setState({
      errorInfo
    });
    
    // Call the optional error handler prop
    if (onError) {
      onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, renderFallback } = this.props;
    
    if (hasError && error) {
      // If a render function is provided, use it
      if (renderFallback && errorInfo) {
        return renderFallback(error, errorInfo);
      }
      
      // If a fallback component is provided, render it
      if (fallback) {
        return fallback;
      }
      
      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error Details</summary>
            <p>{error.toString()}</p>
            <p>{errorInfo?.componentStack}</p>
          </details>
          <button
            onClick={() => {
              logger.info('User attempted to reset ErrorBoundary');
              this.setState({ hasError: false, error: null, errorInfo: null });
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    
    // When there's no error, render children normally
    return children;
  }
}

/**
 * Higher-order component that wraps components with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = Component.displayName || Component.name || 'Component';
  
  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return ComponentWithErrorBoundary;
}

export default ErrorBoundary; 