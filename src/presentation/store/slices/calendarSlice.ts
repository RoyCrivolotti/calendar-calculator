import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { CalendarEvent, CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { container } from '../../../config/container';
import { CreateEventUseCase } from '../../../application/calendar/use-cases/CreateEvent';
import { UpdateEventUseCase } from '../../../application/calendar/use-cases/UpdateEvent';
import { DeleteEventUseCase } from '../../../application/calendar/use-cases/DeleteEvent';

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

// Async thunks
export const createEventAsync = createAsyncThunk(
  'calendar/createEvent',
  async (event: CalendarEventProps) => {
    const createEventUseCase = container.get<CreateEventUseCase>('createEventUseCase');
    const newEvent = await createEventUseCase.execute({
      start: new Date(event.start),
      end: new Date(event.end),
      type: event.type
    });
    return newEvent.toJSON();
  }
);

export const updateEventAsync = createAsyncThunk(
  'calendar/updateEvent',
  async (event: CalendarEventProps) => {
    const updateEventUseCase = container.get<UpdateEventUseCase>('updateEventUseCase');
    const updatedEvent = await updateEventUseCase.execute({
      id: event.id,
      start: new Date(event.start),
      end: new Date(event.end),
      type: event.type
    });
    return updatedEvent.toJSON();
  }
);

export const deleteEventAsync = createAsyncThunk(
  'calendar/deleteEvent',
  async (id: string) => {
    const deleteEventUseCase = container.get<DeleteEventUseCase>('deleteEventUseCase');
    await deleteEventUseCase.execute(id);
    return id;
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setEvents: (state, action: PayloadAction<CalendarEventProps[]>) => {
      state.events = action.payload;
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
  extraReducers: (builder) => {
    builder
      .addCase(createEventAsync.fulfilled, (state, action) => {
        state.events.push(action.payload);
      })
      .addCase(updateEventAsync.fulfilled, (state, action) => {
        const index = state.events.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.events[index] = action.payload;
        }
      })
      .addCase(deleteEventAsync.fulfilled, (state, action) => {
        state.events = state.events.filter(event => event.id !== action.payload);
      });
  }
});

export const {
  setEvents,
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setShowImportModal,
  setImportText,
} = calendarSlice.actions;

export default calendarSlice.reducer; 