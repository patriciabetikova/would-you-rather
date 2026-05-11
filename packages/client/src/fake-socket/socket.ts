// FakeSocket — drop-in replacement for socket.io-client's Socket.
// Talks to fakeServer instead of a real backend. Same shape as the real one,
// so swapping it out later is a one-line change.

import type { ClientToServerEvents, ServerToClientEvents } from "@wyr/shared";
import { fakeServer } from "./server";

let nextId = 0;
function nextSocketId(): string {
  return `fake_${++nextId}_${Math.random().toString(36).slice(2, 6)}`;
}

type Listener = (...args: unknown[]) => void;

export class FakeSocket {
  readonly id: string;
  private listeners: Map<string, Set<Listener>> = new Map();
  private _connected = true;

  constructor() {
    this.id = nextSocketId();
    fakeServer.register({
      id: this.id,
      emit: (event, ...args) => this.dispatch(event, args),
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  emit<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): this {
    if (!this._connected) return this;
    fakeServer.handleEvent(this.id, event as string, args);
    return this;
  }

  on<E extends keyof ServerToClientEvents>(
    event: E,
    listener: ServerToClientEvents[E],
  ): this {
    const key = event as string;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener as Listener);
    return this;
  }

  off<E extends keyof ServerToClientEvents>(
    event: E,
    listener?: ServerToClientEvents[E],
  ): this {
    const key = event as string;
    if (!listener) {
      this.listeners.delete(key);
    } else {
      this.listeners.get(key)?.delete(listener as Listener);
    }
    return this;
  }

  disconnect(): this {
    this._connected = false;
    fakeServer.unregister(this.id);
    return this;
  }

  private dispatch(event: string, args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    [...fns].forEach((fn) => fn(...args));
  }
}
