/**
 * A one-event channel from the API client to the auth provider.
 *
 * WHY THIS EXISTS. The client has to be constructed before React renders, because the
 * provider takes it as a prop, but the thing that reacts to a lost session is the provider.
 * Passing `onSessionLost` a function that closes over a `setState` is therefore impossible:
 * the state does not exist yet. A bus inverts it. The app creates the channel, hands
 * `emit` to the client and `subscribe` to the provider, and neither has to know about the
 * other's lifetime.
 *
 * The alternative, a module-level mutable callback, is the same thing with a hidden
 * global and no way to run two clients in one test file.
 */

export type SessionBus = {
  /** Called by the client when a session is gone and cannot be recovered. */
  readonly emit: () => void;
  /** Called by the provider. Returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
};

export const createSessionBus = (): SessionBus => {
  const listeners = new Set<() => void>();

  return {
    emit: () => {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
