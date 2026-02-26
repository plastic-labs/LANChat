import { io, Socket } from "socket.io-client";
import type { Message, UsersResponse, HistoryResponse, User, Agent } from "../types.js";

export interface ChatClientEvents {
  onConnect: () => void;
  onDisconnect: () => void;
  onMessage: (message: Message) => void;
  onConnectionError: (error: Error) => void;
  onUsersUpdate: (users: User[], agents: Agent[]) => void;
}

export class ChatSocketClient {
  private socket: Socket | null = null;
  private events: ChatClientEvents;
  private serverUrl: string;
  private username: string;

  constructor(serverUrl: string, username: string, events: ChatClientEvents) {
    this.serverUrl = serverUrl;
    this.username = username;
    this.events = events;
  }

  connect(): void {
    this.socket = io(this.serverUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on("connect", () => {
      this.events.onConnect();
      this.socket!.emit("register", {
        username: this.username,
        type: "human",
      });
      setTimeout(() => {
        this.updateUsersList();
      }, 1000);
    });

    this.socket.on("disconnect", () => {
      this.events.onDisconnect();
    });

    this.socket.on("message", (message: Message) => {
      this.events.onMessage(message);
      // Update users list when someone joins or leaves
      if (message.type === 'join' || message.type === 'leave') {
        this.updateUsersList();
      }
    });

    this.socket.on("connect_error", (error: Error) => {
      this.events.onConnectionError(error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(content: string): void {
    if (!this.socket) return;

    this.socket.emit("chat", {
      content,
      metadata: {
        clientType: "terminal",
      },
    });
  }

  getUsers(callback: (response: UsersResponse) => void): void {
    if (!this.socket) return;
    this.socket.emit("get_users", callback);
  }

  getHistory(limit: number, callback: (response: HistoryResponse) => void): void {
    if (!this.socket) return;
    this.socket.emit("get_history", { limit }, callback);
  }

  getDialectic(user: string, query: string, callback: (response: string) => void): void {
    if (!this.socket) return;
    this.socket.emit("dialectic", { user, query }, callback);
  }

  toggleObserve(callback: (response: { success?: boolean; observeMe?: boolean; message?: string; error?: string }) => void): void {
    if (!this.socket) return;
    this.socket.emit("toggle_observe", callback);
  }

  private updateUsersList(): void {
    this.getUsers((response: UsersResponse) => {
      if (!response.error) {
        this.events.onUsersUpdate(response.users as User[], response.agents as Agent[]);
      }
    });
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}