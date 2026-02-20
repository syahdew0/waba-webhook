require("./utils/loadEnv")();
const express = require("express");
const rawBody = require("./middleware/rawBody");
const webhookRoutes = require("./routes/webhook");
const apiRoutes = require("./routes/api");
const { startDedupeCleanupJob, getDbHealthSnapshot } = require("./services/eventStore");

const app = express();

// Keep raw body for signature verification.
app.use(rawBody());

app.use("/webhook", webhookRoutes);
app.use("/api", apiRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/health/db", async (req, res) => {
  try {
    const snapshot = await getDbHealthSnapshot();
    return res.status(200).json({ ok: true, ...snapshot });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      db: "down",
      checked_at: new Date().toISOString(),
      error: String(err?.message || err || "unknown database error"),
    });
  }
});

startDedupeCleanupJob();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
