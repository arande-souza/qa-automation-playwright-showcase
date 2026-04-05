const { spawnSync } = require("child_process");

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const playwrightResult = run("npx", ["playwright", "test"]);
const reportResult = run("node", ["scripts/generate-playwright-dashboard.js"]);

if (reportResult.error) {
  throw reportResult.error;
}

if (playwrightResult.error) {
  throw playwrightResult.error;
}

process.exit(playwrightResult.status ?? 1);
