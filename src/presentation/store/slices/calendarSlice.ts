import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { CalendarEventProps } from '../../../domain/calendar/entities/CalendarEvent';
import { container } from '../../../config/container';
import { CreateEventUseCase } from '../../../application/calendar/use-cases/CreateEventUseCase';
import { UpdateEventUseCase } from '../../../application/calendar/use-cases/UpdateEventUseCase';
import { DeleteEventUseCase } from '../../../application/calendar/use-cases/DeleteEvent';

interface CalendarState {
  events: CalendarEventProps[];
  currentDate: string;
  selectedEvent: CalendarEventProps | null;
  showEventModal: boolean;
  showImportModal: boolean;
  importText: string;
  originalEventForOptimisticUpdate: CalendarEventProps | null;
}

const initialState: CalendarState = {
  events: [],
  currentDate: new Date().toISOString(),
  selectedEvent: null,
  showEventModal: false,
  showImportModal: false,
  importText: '',
  originalEventForOptimisticUpdate: null,
};

// Async thunks
export const createEventAsync = createAsyncThunk(
  'calendar/createEvent',
  async (event: CalendarEventProps) => {
    const createEventUseCase = container.get<CreateEventUseCase>('createEventUseCase');
    const newEvent = await createEventUseCase.execute({
      id: event.id,
      start: new Date(event.start),
      end: new Date(event.end),
      type: event.type,
      title: event.title,
    });
    return newEvent.toJSON();
  }
);

export const updateEventAsync = createAsyncThunk(
  'calendar/updateEvent',
  async (event: CalendarEventProps) => {
    const updateEventUseCase = container.get<UpdateEventUseCase>('updateEventUseCase');
    
    const updatedEvent: CalendarEventProps = {
      id: event.id,
      start: new Date(event.start),
      end: new Date(event.end),
      type: event.type,
      title: event.title,
    };
    
    const returnedEventProps = await updateEventUseCase.execute(updatedEvent);
    return returnedEventProps;
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
      if (!state.events.find(event => event.id === action.payload.id)) {
        state.events.push(action.payload);
      }
    },
    finalizeOptimisticEvent: (state, action: PayloadAction<{ tempId: string; finalEvent: CalendarEventProps }>) => {
      const index = state.events.findIndex(event => event.id === action.payload.tempId);
      if (index !== -1) {
        state.events[index] = action.payload.finalEvent;
      }
    },
    optimisticallyUpdateEvent: (state, action: PayloadAction<CalendarEventProps>) => {
      const index = state.events.findIndex(event => event.id === action.payload.id);
      if (index !== -1) {
        state.originalEventForOptimisticUpdate = JSON.parse(JSON.stringify(state.events[index]));
        state.events[index] = action.payload;
      }
    },
    finalizeOptimisticUpdate: (state) => {
      state.originalEventForOptimisticUpdate = null;
    },
    revertOptimisticUpdate: (state) => {
      if (state.originalEventForOptimisticUpdate) {
        const index = state.events.findIndex(event => event.id === state.originalEventForOptimisticUpdate!.id);
        if (index !== -1) {
          state.events[index] = state.originalEventForOptimisticUpdate;
        }
        state.originalEventForOptimisticUpdate = null;
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
    revertOptimisticAdd: (state, action: PayloadAction<string>) => {
      state.events = state.events.filter(event => event.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createEventAsync.fulfilled, (state, action) => {
        // Assuming finalizeOptimisticEvent is called from the component after success
      })
      .addCase(createEventAsync.rejected, (state, action) => {
        // Revert logic is handled in the component that dispatched optimistically
      })
      .addCase(updateEventAsync.fulfilled, (state, action) => {
        const index = state.events.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.events[index] = action.payload;
        }
        state.originalEventForOptimisticUpdate = null; // Clear backup on successful update
      })
      .addCase(updateEventAsync.rejected, (state, action) => {
        // Revert logic is handled in the component that dispatched optimistically
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
  optimisticallyAddEvent,
  finalizeOptimisticEvent,
  revertOptimisticAdd,
  optimisticallyUpdateEvent,
  finalizeOptimisticUpdate,
  revertOptimisticUpdate,
} = calendarSlice.actions;

export default calendarSlice.reducer; 