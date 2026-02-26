import { Honcho } from "@honcho-ai/sdk";
import chalk from "chalk";

interface PeerRepInfo {
  peerId: string;
  repSize: number;
  lastUpdated: Date;
}

async function startVisualization() {
  // Initialize Honcho with local SDK
  const honcho = new Honcho({
    baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
    workspaceId: process.env.HONCHO_WORKSPACE_ID || "default",
  });

  // Clear screen and hide cursor
  process.stdout.write("\x1b[2J\x1b[?25l");

  // Cleanup on exit
  process.on("SIGINT", () => {
    process.stdout.write("\x1b[?25h"); // Show cursor
    console.log("\n\nVisualization stopped.");
    process.exit(0);
  });

  async function updateDisplay() {
    try {
      // Get all sessions (should be only one)
      const sessionsPage = await honcho.sessions();
      const sessions = sessionsPage.items;

      if (sessions.length === 0) {
        // Move cursor to top
        process.stdout.write("\x1b[H");
        console.log(chalk.bold.red("No sessions found in workspace"));
        console.log(
          chalk.gray("\nWaiting for session... Press Ctrl+C to exit"),
        );
        return;
      }

      const session = sessions[0];

      if (!session) {
        // Move cursor to top
        process.stdout.write("\x1b[H");
        console.log(chalk.bold.red("No session found in workspace"));
        console.log(
          chalk.gray("\nWaiting for session... Press Ctrl+C to exit"),
        );
        return;
      }

      // Get all peers in the workspace
      const peersPage = await honcho.peers();
      const peers = peersPage.items;

      if (peers.length === 0) {
        // Move cursor to top
        process.stdout.write("\x1b[H");
        console.log(chalk.bold.yellow("No peers found in workspace"));
        console.log(chalk.gray("\nWaiting for peers... Press Ctrl+C to exit"));
        return;
      }

      // Fetch representations for each peer
      const peerReps: PeerRepInfo[] = [];

      for (const peer of peers) {
        try {
          const context = await session.context({
            peerTarget: peer.id,
            summary: false,
          });

          const repSize = context.peerRepresentation?.length || 0;
          peerReps.push({
            peerId: peer.id,
            repSize,
            lastUpdated: new Date(),
          });
        } catch (error) {
          // If we can't get the representation, skip this peer
          console.error(chalk.gray(`Could not fetch rep for ${peer.id}`));
        }
      }

      // Move cursor to top and clear screen
      process.stdout.write("\x1b[H");

      // Sort by size descending
      peerReps.sort((a, b) => b.repSize - a.repSize);

      // Display each peer with a cool visualization
      for (const peerRep of peerReps) {
        displayPeerVisualization(peerRep);
      }

      console.log(
        chalk.gray(
          `Last updated: ${new Date().toLocaleTimeString()}... Press Ctrl+C to exit`,
        ),
      );

      // Clear any remaining lines from previous render
      process.stdout.write("\x1b[J");
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
    }
  }

  // Initial update
  await updateDisplay();

  // Poll every 10 seconds
  setInterval(updateDisplay, 10000);
}

function displayPeerVisualization(peerRep: PeerRepInfo) {
  const { peerId, repSize } = peerRep;

  // Calculate visualization parameters
  const maxSize = 10000; // Assume max rep size for scaling
  const normalizedSize = Math.min(repSize / maxSize, 1);
  const barWidth = Math.floor(normalizedSize * 40);

  // Create a funky shape based on size
  const shape = createFunkyShape(repSize);
  const sizeColor = getSizeColor(normalizedSize);

  // Display peer name
  console.log(chalk.bold.gray(`  ${peerId}`));

  // Display the funky shape
  console.log(`  ${sizeColor(shape)}`);

  // Display size info
  const sizeLabel = formatTokens(repSize);
  console.log(`  ${chalk.gray("├")} Size: ${sizeColor(sizeLabel)}`);

  // Display a bar
  const bar = "█".repeat(barWidth) + "░".repeat(40 - barWidth);
  console.log(`  ${chalk.gray("└")} ${sizeColor(bar)}`);
  console.log();
}

function createFunkyShape(size: number): string {
  // Create different ASCII art based on size ranges
  if (size === 0) {
    return "○ (empty)";
  } else if (size < 100) {
    return "◉";
  } else if (size < 500) {
    return "◉◉";
  } else if (size < 1000) {
    return "◉◉◉";
  } else if (size < 2000) {
    return "◉◉◉◉";
  } else if (size < 3000) {
    return "⬢⬢⬢⬢⬢";
  } else if (size < 5000) {
    return "⬢⬢⬢⬢⬢⬢⬢";
  } else if (size < 8000) {
    return "◆◆◆◆◆◆◆◆◆";
  } else if (size < 12000) {
    return "◆◆◆◆◆◆◆◆◆◆◆◆";
  } else {
    return "★★★★★★★★★★★★★★★";
  }
}

function getSizeColor(normalizedSize: number): (text: string) => string {
  // Color gradient based on size
  if (normalizedSize < 0.2) {
    return chalk.gray;
  } else if (normalizedSize < 0.4) {
    return chalk.blue;
  } else if (normalizedSize < 0.6) {
    return chalk.cyan;
  } else if (normalizedSize < 0.8) {
    return chalk.green;
  } else {
    return chalk.yellow;
  }
}

function formatTokens(chars: number): string {
  const tokens = Math.floor(chars / 4);
  if (tokens === 0) return "0 tokens";
  if (tokens < 1000) return `~${tokens} tokens`;
  return `~${(tokens / 1000).toFixed(1)}K tokens`;
}

startVisualization().catch(console.error);
