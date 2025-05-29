import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebaseConfig';

// Import the logger initialization
import { initializeLogger, setupGlobalErrorHandlers } from './utils/initializeLogger';
import { logger } from './utils/logger';

// Initialize Firebase
initializeApp(firebaseConfig);

// Initialize the logging system
initializeLogger();
setupGlobalErrorHandlers();

logger.info('Mounting React application');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

logger.debug('React application rendered');
