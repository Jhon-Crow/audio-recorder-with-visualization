/**
 * Simple typed event emitter
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  private listeners: Map<keyof Events, Set<(data: unknown) => void>> = new Map();

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<E extends keyof Events>(event: E, handler: (data: Events[E]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);

    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event for one-time execution
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once<E extends keyof Events>(event: E, handler: (data: Events[E]) => void): () => void {
    const wrappedHandler = (data: Events[E]): void => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<E extends keyof Events>(event: E, handler: (data: Events[E]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(handler as (data: unknown) => void);
    }
  }

  /**
   * Emit an event
   * @param event - Event name
   * @param data - Event data
   */
  protected emit<E extends keyof Events>(event: E, data: Events[E]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for "${String(event)}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event or all events
   * @param event - Optional event name
   */
  removeAllListeners(event?: keyof Events): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
