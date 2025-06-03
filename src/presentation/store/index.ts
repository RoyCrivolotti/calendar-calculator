import { configureStore } from '@reduxjs/toolkit';
import calendarReducer from './slices/calendarSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    calendar: calendarReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 