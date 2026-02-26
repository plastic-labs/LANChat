import { Honcho } from "@honcho-ai/sdk";
import chalk from "chalk";

async function startMonitor() {
  // Initialize Honcho
  const honcho = new Honcho({
    baseURL: process.env.HONCHO_BASE_URL || "http://localhost:8000",
    workspaceId: process.env.HONCHO_WORKSPACE_ID || "default",
  });

  // Terminal width for the bar
  const BAR_WIDTH = 50;

  // Clear screen and hide cursor
  process.stdout.write("\x1b[2J\x1b[?25l");

  // Cleanup on exit
  process.on("SIGINT", () => {
    process.stdout.write("\x1b[?25h"); // Show cursor
    console.log("\n\nMonitor stopped.");
    process.exit(0);
  });

  async function updateDisplay() {
    try {
      const status = await honcho.queueStatus();

      const {
        totalWorkUnits,
        completedWorkUnits,
        inProgressWorkUnits,
        pendingWorkUnits,
      } = status;

      // Calculate percentages
      const completedPercent =
        totalWorkUnits > 0 ? completedWorkUnits / totalWorkUnits : 0;
      const inProgressPercent =
        totalWorkUnits > 0 ? inProgressWorkUnits / totalWorkUnits : 0;
      const pendingPercent =
        totalWorkUnits > 0 ? pendingWorkUnits / totalWorkUnits : 0;

      // Calculate bar segments
      const completedWidth = Math.round(completedPercent * BAR_WIDTH);
      const inProgressWidth = Math.round(inProgressPercent * BAR_WIDTH);
      const pendingWidth = Math.round(pendingPercent * BAR_WIDTH);
      const emptyWidth =
        BAR_WIDTH - completedWidth - inProgressWidth - pendingWidth;

      // Build the bar
      const bar =
        chalk.green("█".repeat(completedWidth)) +
        chalk.yellow("█".repeat(inProgressWidth)) +
        chalk.blue("█".repeat(pendingWidth)) +
        chalk.gray("░".repeat(Math.max(0, emptyWidth)));

      // Move cursor to top and clear screen
      process.stdout.write("\x1b[H");

      // Display header
      console.log(chalk.bold.cyan("Honcho Queue Monitor\n"));

      // Display the bar
      console.log(`  █${bar}█\n`);

      // Display statistics
      console.log(
        `  ${chalk.green("●")} Completed:   ${chalk.green(completedWorkUnits.toString().padStart(6))} (${(completedPercent * 100).toFixed(1)}%)`,
      );
      console.log(
        `  ${chalk.yellow("●")} In Progress: ${chalk.yellow(inProgressWorkUnits.toString().padStart(6))} (${(inProgressPercent * 100).toFixed(1)}%)`,
      );
      console.log(
        `  ${chalk.blue("●")} Pending:     ${chalk.blue(pendingWorkUnits.toString().padStart(6))} (${(pendingPercent * 100).toFixed(1)}%)`,
      );
      console.log(
        `  ${chalk.gray("●")} Total:       ${chalk.gray(totalWorkUnits.toString().padStart(6))}`,
      );

      console.log(
        chalk.gray(
          `\n  Last updated: ${new Date().toLocaleTimeString()}. Press Ctrl+C to exit`,
        ),
      );
    } catch (error) {
      console.error(chalk.red(`Error fetching deriver status: ${error}`));
    }
  }

  // Initial update
  await updateDisplay();

  // Poll every second
  setInterval(updateDisplay, 1000);
}

startMonitor().catch(console.error);
