import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User as FirebaseUser } from 'firebase/auth'; // Firebase User type

// Define a serializable User type for the Redux store if needed
// For simplicity, we can store the relevant parts or the whole FirebaseUser if serializable
// Or define your own simpler User interface
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  // Add other relevant fields: photoURL, etc.
}

interface AuthState {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  currentUser: null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.error = null; // Clear error when loading starts
      }
    },
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    // We can add specific actions for login/logout success/failure later if needed
    // e.g., loginSuccess, loginFailure, logoutSuccess
  },
});

export const {
  setCurrentUser,
  setAuthLoading,
  setAuthError,
  clearAuthError,
} = authSlice.actions;

// Selector to get the current user
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.currentUser;
export const selectIsAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;

export default authSlice.reducer; 