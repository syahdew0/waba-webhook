const fs = require("fs");
const path = require("path");

const logPath = process.env.LOG_PATH || "./logs/webhook.ndjson";

async function logEvent(payload) {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const line =
    JSON.stringify({
      ts: new Date().toISOString(),
      payload,
    }) + "\n";

  fs.appendFileSync(logPath, line, "utf8");
}

module.exports = { logEvent };
