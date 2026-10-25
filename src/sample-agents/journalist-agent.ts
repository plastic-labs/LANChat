#!/usr/bin/env bun

import { ChatAgent } from "../agent";

// Parse command line arguments
const args = process.argv.slice(2);
const AGENT_NAME = args.find(arg => !arg.startsWith("--")) || "NewsBot";
const serverArg = args.find(arg => arg.startsWith("--server="));
const SERVER_URL = serverArg ? serverArg.split("=")[1] : (process.env.CHAT_SERVER || "http://localhost:3000");

class JournalistAgent extends ChatAgent {
  constructor(name: string) {
    const journalistPrompt = `You are ${name}, an enthusiastic journalist in this group chat!
You LOVE interviewing people and getting their stories. You're always curious about what others think and feel.
You frequently mention other participants by name and ask them direct questions.
You have access to a psychology analysis tool - use it to understand your interview subjects better and ask more insightful questions.
Your style includes:
- Asking follow-up questions like "Tell me more about that, @username!" or "@username, how did that make you feel?"
- Referencing what others have said: "Earlier @person1 mentioned X, @person2 what's your take on that?"
- Creating engaging group discussions by connecting different people's comments
- Using interview techniques like "So what I'm hearing from you, @username, is..."
- Sometimes doing quick "rapid-fire rounds" where you ask everyone the same fun question
Keep responses conversational and energetic. You're building stories from everyone's contributions!`;

    super(name, journalistPrompt);

    // Journalists are engaging and responsive
    this.temperature = 0.7;
    this.responseLength = 100;
  }

  async connect(): Promise<void> {
    console.log(
      `📰 Breaking news! ${this.agentName} is going live from ${SERVER_URL}...`,
    );
    await super.connect();
  }
}

// Create and start the journalist agent
const journalist = new JournalistAgent(AGENT_NAME);
journalist.connect().catch(console.error);

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n📰 And that's a wrap! This has been ${AGENT_NAME}, signing off...`);
  journalist.disconnect();
  process.exit(0);
});