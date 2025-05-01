import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { storageService } from '../../services/storage';

interface CalendarState {
  events: CalendarEventProps[];
  currentDate: string;
  selectedEvent: CalendarEventProps | null;
  showEventModal: boolean;
  showImportModal: boolean;
  importText: string;
}

const initialState: CalendarState = {
  events: [],
  currentDate: new Date().toISOString(),
  selectedEvent: null,
  showEventModal: false,
  showImportModal: false,
  importText: '',
};

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<CalendarEventProps[]>) => {
      state.events = action.payload;
      storageService.saveEvents(action.payload.map(event => new CalendarEvent(event)));
    },
    addEvent: (state, action: PayloadAction<CalendarEventProps>) => {
      state.events.push(action.payload);
      storageService.saveEvents(state.events.map(event => new CalendarEvent(event)));
    },
    updateEvent: (state, action: PayloadAction<CalendarEventProps>) => {
      const index = state.events.findIndex(event => event.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = action.payload;
        storageService.saveEvents(state.events.map(event => new CalendarEvent(event)));
      }
    },
    deleteEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(event => event.id !== action.payload);
      storageService.saveEvents(state.events.map(event => new CalendarEvent(event)));
    },
    setCurrentDate: (state, action: PayloadAction<string>) => {
      state.currentDate = action.payload;
    },
    setSelectedEvent: (state, action: PayloadAction<CalendarEventProps | null>) => {
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