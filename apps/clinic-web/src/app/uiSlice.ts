import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Client state that outlives a screen, and nothing else.
 *
 * WHAT DOES NOT GO HERE, because the rule is easier to keep than to recover:
 *
 * - SERVER DATA. Appointments, patients and calls live in the RTK Query cache. A copy in a
 *   slice is a second source of truth with no invalidation, which is the bug D-015 exists
 *   to prevent.
 * - PER-SCREEN FILTERS. A status filter or a page number belongs in the URL, so a link to
 *   a filtered list is a link to a filtered list and the back button works.
 * - PATIENT DATA, ever. A name or a number in the store ends up in a dev-tools snapshot.
 *
 * What is left is the state two screens genuinely share. The selected day is the whole of
 * it today: the overview, the calendar and the appointments list all answer "which day", and
 * moving between them must not silently reset it back to today.
 */

export type AgendaView = 'month' | 'day';

export type UiState = {
  /**
   * The day the agenda screens are looking at, as `yyyy-MM-dd` in the CLINIC's timezone.
   *
   * A date string rather than a `Date`, because a `Date` in the store is a non-serializable
   * value that also carries a time and a zone nobody asked for. The clinic's day is the unit
   * every one of these screens works in, and the conversion to UTC happens at the edge where
   * the request is built.
   */
  readonly selectedDate: string | undefined;
  readonly agendaView: AgendaView;
};

const initialState: UiState = {
  // Undefined rather than today's date: "today" depends on the clinic timezone, which is
  // read from the organisation and is not available at module load.
  selectedDate: undefined,
  agendaView: 'month',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectedDateChanged: (state, action: PayloadAction<string | undefined>) => {
      state.selectedDate = action.payload;
    },
    agendaViewChanged: (state, action: PayloadAction<AgendaView>) => {
      state.agendaView = action.payload;
    },
  },
});

export const { selectedDateChanged, agendaViewChanged } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
