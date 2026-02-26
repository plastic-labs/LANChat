import type { ChatSocketClient } from "./socket-client.js";
import type { Message } from "../types.js";

export interface Command {
  value: string;
  label: string;
  description: string;
}

export const commands: Command[] = [
  { value: '/help', label: '/help', description: 'Show available commands' },
  { value: '/users', label: '/users', description: 'List connected users and agents' },
  { value: '/dialectic', label: '/dialectic <user> <query>', description: 'Query participant psychology' },
  { value: '/observe', label: '/observe', description: 'Toggle your observation status in the session' },
  { value: '/quit', label: '/quit', description: 'Exit the chat' },
];

export interface CommandHandlerOptions {
  client: ChatSocketClient;
  onMessage: (message: Message) => void;
  onExit: () => void;
}

export class CommandHandler {
  private client: ChatSocketClient;
  private onMessage: (message: Message) => void;
  private onExit: () => void;

  constructor(options: CommandHandlerOptions) {
    this.client = options.client;
    this.onMessage = options.onMessage;
    this.onExit = options.onExit;
  }

  handleCommand(command: string): void {
    const parts = command.split(" ");
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case "/help":
        this.addSystemMessage('Available commands:\n' + commands.map(c => `${c.label} - ${c.description}`).join('\n'));
        break;
      case "/quit":
        this.onExit();
        break;
      case "/users":
        this.client.getUsers((response) => {
          if (response.error) {
            this.addSystemMessage(`Error: ${response.error}`);
          } else {
            const usersList = response.users.map(u => `  ${u.username} (${u.type}) ${u.observeMe ? '(being observed)' : '(not being observed)'}`).join('\n');
            const agentsList = response.agents.map(a => `  ${a.username} (${a.type}) [${a.capabilities.join(', ')}]`).join('\n');
            this.addSystemMessage(`Connected Users:\n${usersList}\n\nConnected Agents:\n${agentsList}`);
          }
        });
        break;
      case "/dialectic":
        const user = parts[1];
        const query = parts.slice(2).join(" ");
        if (!user || !query) {
          this.addSystemMessage('Usage: /dialectic <user> <query>');
          return;
        }
        this.client.getDialectic(user, query, (response) => {
          this.addSystemMessage(response, 'Dialectic');
        });
        break;
      case "/observe":
        this.client.toggleObserve((response) => {
          if (response.error) {
            this.addSystemMessage(`Error: ${response.error}`);
          }
        });
        break;
      default:
        this.addSystemMessage(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  getAutocompleteOptions(input: string): Command[] {
    if (!input.startsWith('/')) return [];
    if (input === '/') return commands;
    return commands.filter(cmd =>
      cmd.value.toLowerCase().startsWith(input.toLowerCase())
    );
  }

  private addSystemMessage(content: string, username: string = 'System'): void {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      username,
      content,
      metadata: { timestamp: new Date().toISOString() }
    };
    this.onMessage(message);
  }
}