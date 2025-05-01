import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CalendarEvent } from '../../types/calendar';

interface CalendarState {
  events: CalendarEvent[];
  currentDate: Date;
  selectedEvent: CalendarEvent | null;
  showEventModal: boolean;
  showImportModal: boolean;
  importText: string;
}

const initialState: CalendarState = {
  events: [],
  currentDate: new Date(),
  selectedEvent: null,
  showEventModal: false,
  showImportModal: false,
  importText: '',
};

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<CalendarEvent[]>) => {
      state.events = action.payload;
    },
    addEvent: (state, action: PayloadAction<CalendarEvent>) => {
      state.events.push(action.payload);
    },
    updateEvent: (state, action: PayloadAction<CalendarEvent>) => {
      const index = state.events.findIndex(event => event.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
      }
    },
    deleteEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(event => event.id !== action.payload);
    },
    setCurrentDate: (state, action: PayloadAction<Date>) => {
      state.currentDate = action.payload;
    },
    setSelectedEvent: (state, action: PayloadAction<CalendarEvent | null>) => {
      state.selectedEvent = action.payload;
    },
    setShowEventModal: (state, action: PayloadAction<boolean>) => {
      state.showEventModal = action.payload;
    },
    setShowImportModal: (state, action: PayloadAction<boolean>) => {
      state.showImportModal = action.payload;
    },
    setImportText: (state, action: PayloadAction<string>) => {
      state.importText = action.payload;
    },
  },
});

export const {
  setEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setShowImportModal,
  setImportText,
} = calendarSlice.actions;

export default calendarSlice.reducer; 