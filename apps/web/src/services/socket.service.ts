import { io, Socket } from 'socket.io-client';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

class SocketService {
  private socket: Socket | null = null;
  /** Queued listeners — re-registered on every new socket */
  private listeners: { event: string; callback: (...args: any[]) => void }[] = [];

  connect(token: string) {
    if (this.socket?.connected) return;

    // Clean up previous socket before creating a new one
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(`${BASE_URL}/ws`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected via', this.socket?.io?.engine?.transport?.name);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    // Re-attach all registered listeners to the new socket
    for (const { event, callback } of this.listeners) {
      this.socket.on(event, callback);
    }
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, callback: (...args: any[]) => void) {
    // Store listener so it survives reconnects
    this.listeners.push({ event, callback });
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.listeners = callback
      ? this.listeners.filter((l) => !(l.event === event && l.callback === callback))
      : this.listeners.filter((l) => l.event !== event);
    this.socket?.off(event, callback);
  }

  /** Register a callback that fires on every (re)connect */
  onReconnect(callback: () => void) {
    this.on('connect', callback);
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
