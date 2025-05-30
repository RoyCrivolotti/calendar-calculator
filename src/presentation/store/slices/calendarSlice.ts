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
    optimisticallyAddEvent: (state, action: PayloadAction<CalendarEventProps>) => {
      if (!state.events.find(e => e.id === action.payload.id)) {
        state.events.push(action.payload);
      }
    },
    finalizeOptimisticEvent: (state, action: PayloadAction<{ tempId: string; finalEvent: CalendarEventProps }>) => {
      const index = state.events.findIndex(event => event.id === action.payload.tempId);
      if (index !== -1) {
        state.events[index] = action.payload.finalEvent;
      } else {
        if (!state.events.find(e => e.id === action.payload.finalEvent.id)) {
            state.events.push(action.payload.finalEvent);
        }
      }
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
        // Instead of just pushing, we now expect 'finalizeOptimisticEvent' 
        // to be dispatched by the component after this thunk succeeds.
        // The thunk itself just returns the created event data.
        // The calling code in Calendar.tsx will handle dispatching finalizeOptimisticEvent.
        // So, we might not need to do anything directly here if the calling code handles it.
        // However, if the optimistic add didn't happen, we might want to ensure it's added.
        // For now, let's assume the component handles replacement via finalizeOptimisticEvent.
        // Let's remove the direct push to avoid duplicates if finalizeOptimisticEvent is used.
        // state.events.push(action.payload); 
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
  optimisticallyAddEvent,
  finalizeOptimisticEvent,
  setCurrentDate,
  setSelectedEvent,
  setShowEventModal,
  setShowImportModal,
  setImportText,
} = calendarSlice.actions;

export default calendarSlice.reducer; 