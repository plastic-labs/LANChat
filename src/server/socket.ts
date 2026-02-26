import { Server as SocketIOServer } from "socket.io";
import { Honcho, Session } from "@honcho-ai/sdk";
import type { Message, User, Agent } from "../types.js";
import { MessageType } from "../types.js";
import { generateId, print } from "./utils.js";

export function setupSocketIO(
  io: SocketIOServer,
  connectedUsers: Map<string, User>,
  agents: Map<string, Agent>,
  chatHistory: Message[],
  honcho: Honcho,
  session: Session
) {
  io.on("connection", (socket) => {
    print(`new connection: ${socket.id}`, "cyan");

    socket.on("register", async (data: { username: string; type?: string; capabilities?: string[] }) => {
      const { username, type = "human" } = data;

      if (type === "agent") {
        const agent: Agent = {
          id: socket.id,
          username,
          type: "agent",
          capabilities: data.capabilities || [],
          socket,
        };
        agents.set(socket.id, agent);
        const agent_peer = await honcho.peer(username, { configuration: { observeMe: false } });
        await session.addPeers([[agent_peer, { observeMe: false, observeOthers: true }]]);
        print(`agent registered: ${username}`, "green");
      } else {
        const user_peer = await honcho.peer(username);
        // get the user's existing config if it exists
        const config = await user_peer.getConfiguration() as Record<string, boolean>;
        const user: User = {
          id: socket.id,
          username,
          type: "human",
          socket,
          observeMe: config.observeMe || true,
        };
        await session.addPeers([user_peer]);
        print(`user registered: ${username}`, "green");
        connectedUsers.set(socket.id, user);
      }

      socket.emit("history", chatHistory.slice(-50));
      socket.emit("session_id", session.id);

      const joinMessage = createMessage({
        type: MessageType.JOIN,
        username: "system",
        content: `${username} (${type}) joined the chat`,
        metadata: { joinedUser: username, userType: type },
      });

      socket.broadcast.emit("message", joinMessage);
      addToHistory(joinMessage, chatHistory);
    });

    socket.on("chat", async (data: { content: string; metadata?: any }) => {
      const user = connectedUsers.get(socket.id) || agents.get(socket.id);
      if (!user) return;

      const message = createMessage({
        type: MessageType.CHAT,
        username: user.username,
        content: data.content,
        metadata: {
          userId: socket.id,
          userType: user.type,
          ...data.metadata,
        },
      });

      print(`${user.username}: ${data.content}`);
      await broadcastMessage(message, io, honcho, session);
      addToHistory(message, chatHistory);
      notifyAgents(message, "chat_message", agents, connectedUsers, chatHistory);
    });

    socket.on("agent_data", async (data: any) => {
      const agent = agents.get(socket.id);
      if (!agent) return;

      const message = createMessage({
        type: MessageType.AGENT_DATA,
        username: agent.username,
        content: data.content || "",
        metadata: {
          agentId: socket.id,
          dataType: data.dataType,
          processedData: data.processedData,
          ...data.metadata,
        },
      });

      if (data.broadcast) {
        await broadcastMessage(message, io, honcho, session);
        addToHistory(message, chatHistory);
      } else if (data.targets) {
        data.targets.forEach((targetId: string) => {
          const targetSocket = connectedUsers.get(targetId) || agents.get(targetId);
          if (targetSocket?.socket) {
            targetSocket.socket.emit("message", message);
          }
        });
      }

      notifyAgents(message, "agent_data", agents, connectedUsers, chatHistory, [socket.id]);
    });

    socket.on("agent_response", async (data: any) => {
      const agent = agents.get(socket.id);
      if (!agent) return;

      const message = createMessage({
        type: MessageType.AGENT_RESPONSE,
        username: agent.username,
        content: data.response,
        metadata: {
          agentId: socket.id,
          responseType: data.responseType || "general",
          confidence: data.confidence,
          referencedMessage: data.referencedMessage,
        },
      });

      print(`${agent.username}: ${data.response}`);
      await broadcastMessage(message, io, honcho, session);
      addToHistory(message, chatHistory);
    });

    socket.on("disconnect", async () => {
      const user = connectedUsers.get(socket.id) || agents.get(socket.id);
      if (user) {
        const leaveMessage = createMessage({
          type: MessageType.LEAVE,
          username: "system",
          content: `${user.username} (${user.type}) left the chat`,
          metadata: { leftUser: user.username, userType: user.type },
        });

        socket.broadcast.emit("message", leaveMessage);
        addToHistory(leaveMessage, chatHistory);

        connectedUsers.delete(socket.id);
        agents.delete(socket.id);

        const peer = await honcho.peer(user.username);
        await session.removePeers([peer]);
        print(`${user.type} disconnected: ${user.username}`, "yellow");
      }
    });

    // API endpoints for clients
    socket.on("get_history", (data: any, callback: Function) => {
      const limit = data.limit || 100;
      const messageType = data.messageType;
      const since = data.since ? new Date(data.since) : null;

      let filteredHistory = chatHistory.filter(msg => msg.type !== MessageType.JOIN && msg.type !== MessageType.LEAVE && msg.type !== MessageType.SYSTEM);

      if (messageType) {
        filteredHistory = filteredHistory.filter((msg) => msg.type === messageType);
      }

      if (since) {
        filteredHistory = filteredHistory.filter((msg) => new Date(msg.metadata.timestamp) > since);
      }

      callback({
        history: filteredHistory.slice(-limit),
        total: filteredHistory.length,
      });
    });

    socket.on("get_users", (callback: Function) => {
      const users = Array.from(connectedUsers.values()).map((user) => ({
        id: user.id,
        username: user.username,
        type: user.type,
        observeMe: user.observeMe,
      }));

      const agentList = Array.from(agents.values()).map((agent) => ({
        id: agent.id,
        username: agent.username,
        type: agent.type,
        capabilities: agent.capabilities,
      }));

      callback({ users, agents: agentList });
    });

    socket.on("dialectic", async (data: { user: string; query: string }, callback: Function) => {
      const peer = await honcho.peer(data.user);
      const response = await peer.chat(data.query, { session: session.id });
      callback(response || "No response from agent");
    });

    socket.on("toggle_observe", async (callback: Function) => {
      const user = connectedUsers.get(socket.id);
      if (!user) {
        callback({ error: "User not found" });
        return;
      }

      const newObserveStatus = !user.observeMe;
      user.observeMe = newObserveStatus;
      connectedUsers.set(socket.id, user);

      try {
        const user_peer = await honcho.peer(user.username);
        await user_peer.setConfiguration({ observeMe: newObserveStatus });

        const statusMessage = createMessage({
          type: MessageType.SYSTEM,
          username: "system",
          content: `${user.username} ${newObserveStatus ? 'enabled' : 'disabled'} observation`,
          metadata: { userId: socket.id, observeStatus: newObserveStatus },
        });

        socket.emit("message", statusMessage);
        addToHistory(statusMessage, chatHistory);

        callback({
          success: true,
          observeMe: newObserveStatus,
          message: `Observation ${newObserveStatus ? 'enabled' : 'disabled'}`
        });

        print(`${user.username} ${newObserveStatus ? 'enabled' : 'disabled'} observation`, "blue");
      } catch (error) {
        callback({ error: `Failed to update observation status: ${error}` });
      }
    });
  });
}

// Helper functions
async function broadcastMessage(message: Message, io: SocketIOServer, honcho: Honcho, session: any): Promise<void> {
  io.emit("message", message);
  
  // Only add messages to Honcho for chat messages from real users/agents
  if (message.type === MessageType.CHAT && message.content) {
    try {
      const peer = await honcho.peer(message.username);
      await session.addMessages([peer.message(message.content)]);
    } catch (error) {
      console.error(`Failed to add message to Honcho session: ${error}`);
      // Continue even if Honcho fails - don't break the chat
    }
  }
}

function createMessage({
  type,
  username,
  content,
  metadata = {},
}: {
  type: MessageType;
  username: string;
  content: string;
  metadata?: any;
}): Message {
  return {
    id: generateId(),
    type,
    username,
    content,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };
}

function addToHistory(message: Message, chatHistory: Message[]): void {
  chatHistory.push(message);
  if (chatHistory.length > 1000) {
    chatHistory.shift();
  }
}

function notifyAgents(
  message: Message,
  eventType: string,
  agents: Map<string, Agent>,
  connectedUsers: Map<string, User>,
  chatHistory: Message[],
  excludeIds: string[] = []
): void {
  agents.forEach((agent, agentId) => {
    if (!excludeIds.includes(agentId)) {
      agent.socket.emit("agent_event", {
        eventType,
        message,
        context: {
          totalUsers: connectedUsers.size,
          totalAgents: agents.size,
          recentHistory: chatHistory.slice(-10),
        },
      });
    }
  });
}