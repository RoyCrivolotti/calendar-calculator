import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CalendarEvent } from '../../../domain/calendar/entities/CalendarEvent';
import { storageService } from '../../services/storage';

interface CalendarState {
  events: CalendarEvent[];
  currentDate: string;
  selectedEvent: CalendarEvent | null;
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
    setEvents: (state, action: PayloadAction<CalendarEvent[]>) => {
      state.events = action.payload.map(event => new CalendarEvent(event));
      storageService.saveEvents(state.events);
    },
    addEvent: (state, action: PayloadAction<CalendarEvent>) => {
      const newEvent = new CalendarEvent(action.payload);
      state.events.push(newEvent);
      storageService.saveEvents(state.events);
    },
    updateEvent: (state, action: PayloadAction<CalendarEvent>) => {
      const index = state.events.findIndex(event => event.id === action.payload.id);
      if (index !== -1) {
        state.events[index] = new CalendarEvent(action.payload);
        storageService.saveEvents(state.events);
      }
    },
    deleteEvent: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(event => event.id !== action.payload);
      storageService.saveEvents(state.events);
    },
    setCurrentDate: (state, action: PayloadAction<Date>) => {
      state.currentDate = action.payload.toISOString();
    },
    setSelectedEvent: (state, action: PayloadAction<CalendarEvent | null>) => {
      state.selectedEvent = action.payload ? new CalendarEvent(action.payload) : null;
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