import React, { useEffect } from 'react';
import { Provider, useSelector } from 'react-redux';
import { store } from './presentation/store/store';
import Calendar from './presentation/components/calendar/Calendar';
import { Global, css } from '@emotion/react';
import ErrorBoundary from './presentation/components/ErrorBoundary';
import { getLogger } from './utils/logger';

import { firebaseAuthService } from './infrastructure/auth/FirebaseAuthService';
import { 
  setCurrentUser, 
  setAuthLoading,
  selectCurrentUser,
  selectIsAuthLoading
} from './presentation/store/slices/authSlice';
import { User as FirebaseUser } from 'firebase/auth';

import LoginComponent from './presentation/components/auth/LoginComponent';
import { RootState } from './presentation/store/store';

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

const AppContent: React.FC = () => {
  const currentUser = useSelector((state: RootState) => selectCurrentUser(state));
  const isAuthLoading = useSelector((state: RootState) => selectIsAuthLoading(state));

  useEffect(() => {
    store.dispatch(setAuthLoading(true));
    const unsubscribe = firebaseAuthService.onAuthStateChangedListener((firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        store.dispatch(setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        }));
      } else {
        store.dispatch(setCurrentUser(null));
      }
      store.dispatch(setAuthLoading(false));
    });
    return () => unsubscribe();
  }, []);

  if (isAuthLoading) {
    return <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em' }}>Loading Application...</div>;
  }

  return (
    <>
      <Global styles={globalStyles} />
      <LoginComponent />
      {currentUser ? (
        <Calendar />
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: '#555' }}>
        </div>
      )}
    </>
  );
};

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
        <AppContent />
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
