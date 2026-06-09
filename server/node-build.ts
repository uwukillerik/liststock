import path from "node:path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";

const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
  console.log(`API: http://${host}:${port}/api`);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

process.on("SIGINT", () => {
  process.exit(0);
});
