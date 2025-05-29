import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from '@emotion/styled';
import { firebaseAuthService } from '../../../infrastructure/auth/FirebaseAuthService';
import {
  selectCurrentUser,
  selectIsAuthLoading,
  selectAuthError,
  setAuthLoading,
  setAuthError,
} from '../../store/slices/authSlice';
import { RootState } from '../../store/store';

const AuthContainer = styled.div`
  padding: 20px;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin: 20px auto;
  max-width: 400px;
`;

const UserInfo = styled.div`
  margin-bottom: 15px;
  color: #333;
`;

const AuthButton = styled.button`
  background-color: #4285F4;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 1rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px auto;

  &:hover {
    background-color: #357ae8;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  margin-top: 10px;
`;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.20455C17.64 8.56636 17.5832 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.9705 13.0014 12.9232 12.045 13.5218V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.045 13.5218C11.2418 14.0823 10.2109 14.4205 9 14.4205C6.96182 14.4205 5.27318 13.0059 4.63818 11.1377H1.62V13.4977C3.08182 16.1468 5.84682 18 9 18Z" fill="#34A853"/>
    <path d="M4.63818 11.1377C4.47591 10.635 4.38545 10.0995 4.38545 9.54545C4.38545 9.00045 4.47591 8.45545 4.63818 7.96227V5.60227H1.62C0.953182 6.86909 0.523636 8.20045 0.523636 9.54545C0.523636 10.8995 0.953182 12.2218 1.62 13.4977L4.63818 11.1377Z" fill="#FBBC05"/>
    <path d="M9 4.67045C10.3177 4.67045 11.3573 5.17682 11.8482 5.63773L14.0182 3.49773C12.5814 2.09955 10.6655 1.27273 9 1.27273C5.84682 1.27273 3.08182 3.30045 1.62 5.60227L4.63818 7.96227C5.27318 6.09409 6.96182 4.67045 9 4.67045Z" fill="#EA4335"/>
  </svg>
);

const LoginComponent: React.FC = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => selectCurrentUser(state));
  const isLoading = useSelector((state: RootState) => selectIsAuthLoading(state));
  const authError = useSelector((state: RootState) => selectAuthError(state));

  const handleSignIn = async () => {
    dispatch(setAuthLoading(true));
    try {
      await firebaseAuthService.signInWithGooglePopup();
    } catch (error: any) {
      dispatch(setAuthError(error.message || 'Failed to sign in with Google.'));
    }
  };

  const handleSignOut = async () => {
    dispatch(setAuthLoading(true));
    try {
      await firebaseAuthService.signOutUser();
    } catch (error: any) {
      dispatch(setAuthError(error.message || 'Failed to sign out.'));
    }
  };

  if (isLoading && !currentUser) {
    return <AuthContainer><p>Loading authentication...</p></AuthContainer>;
  }

  return (
    <AuthContainer>
      {currentUser ? (
        <>
          <UserInfo>
            <p>Welcome, {currentUser.displayName || currentUser.email}!</p>
            <p><small>({currentUser.uid})</small></p>
          </UserInfo>
          <AuthButton onClick={handleSignOut} disabled={isLoading}>
            Sign Out
          </AuthButton>
        </>
      ) : (
        <>
          <p>Please sign in to use the calendar.</p>
          <AuthButton onClick={handleSignIn} disabled={isLoading}>
            <GoogleIcon />
            Sign In with Google
          </AuthButton>
        </>
      )}
      {authError && <ErrorMessage>{authError}</ErrorMessage>}
    </AuthContainer>
  );
};

export default LoginComponent; 