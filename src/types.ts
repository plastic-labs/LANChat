// Shared types for the LAN chat application

// Message types
export enum MessageType {
  CHAT = "chat",
  AGENT_DATA = "agent_data",
  SYSTEM = "system",
  JOIN = "join",
  LEAVE = "leave",
  AGENT_RESPONSE = "agent_response",
}

// Core message interface
export interface Message {
  id: string;
  type:
  | MessageType
  | "chat"
  | "agent_response"
  | "system"
  | "join"
  | "leave"
  | "agent_data";
  username: string;
  content: string;
  metadata: {
    timestamp: string;
    [key: string]: any;
  };
}

// User and agent types
export interface User {
  id: string;
  username: string;
  type: "human";
  socket?: any;
  observeMe?: boolean;
}

export interface Agent {
  id: string;
  username: string;
  type: "agent";
  capabilities: string[];
  socket: any;
}

// Network interface type
export interface NetworkInterface {
  interface: string;
  address: string;
  primary: boolean;
}

// API response types
export interface UsersResponse {
  users: Array<{ id: string; username: string; type: string; observeMe: boolean }>;
  agents: Array<{
    id: string;
    username: string;
    type: string;
    capabilities: string[];
  }>;
  error?: string;
}

export interface HistoryResponse {
  history: Message[];
  total: number;
  error?: string;
}

export interface HonchoMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

// Agent-specific types
export interface ResponseDecision {
  should_respond: boolean;
  reason: string;
  confidence: number;
}

export interface AgentDecision {
  decision: string;
  reason: string;
  confidence: number;
}

export interface PsychologyAnalysis {
  participant: string;
  response: string;
}

export interface Dialectic {
  target: string;
  question: string;
}

export interface Search {
  query: string;
}

