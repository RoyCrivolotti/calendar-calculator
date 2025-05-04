import React from 'react';
import { Provider } from 'react-redux';
import { store } from './presentation/store/store';
import Calendar from './presentation/components/calendar/Calendar';
import { Global, css } from '@emotion/react';
import ErrorBoundary from './presentation/components/ErrorBoundary';
import { getLogger } from './utils/logger';

const logger = getLogger('app');

const globalStyles = css`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
    overflow: auto;
    width: 100%;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f0f2f5;
    width: 100%;
  }

  #root {
    height: 100%;
    overflow: auto;
    width: 100%;
  }
  
  .error-boundary-fallback {
    padding: 20px;
    text-align: center;
    max-width: 800px;
    margin: 40px auto;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .error-boundary-fallback h2 {
    color: #d32f2f;
    margin-bottom: 16px;
  }
  
  .error-boundary-fallback details {
    margin: 20px 0;
    text-align: left;
    background-color: #f5f5f5;
    padding: 10px;
    border-radius: 4px;
  }
  
  .error-boundary-fallback button {
    background-color: #2196f3;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .error-boundary-fallback button:hover {
    background-color: #1976d2;
  }
`;

const App: React.FC = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('Application error caught by root ErrorBoundary:', error, {
          componentStack: errorInfo.componentStack
        });
      }}
    >
      <Provider store={store}>
        <Global styles={globalStyles} />
        <Calendar />
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
