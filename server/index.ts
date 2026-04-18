import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const DATA_DIR =
  process.env.BUDGET_DATA_DIR ?? path.join(projectRoot, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const defaultState = {
  meta: {
    currency: "EUR",
    openingBank: 0,
    openingCash: 0,
  },
  transfers: [] as unknown[],
  movements: [] as unknown[],
  groceryCycles: [] as unknown[],
  tasks: [] as unknown[],
  ledgerOrder: [] as unknown[],
  scenarios: [
    {
      id: "default-scenario-1",
      name: "Scenario 1",
      amount: 0,
      method: "bank",
      category: "food",
    },
  ],
};

const app = express();
app.use(express.json({ limit: "4mb" }));

const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

api.get("/state", async (_req, res) => {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    res.type("json").send(raw);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      res.json(defaultState);
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Failed to read state" });
  }
});

api.put("/state", async (req, res) => {
  try {
    const body = req.body;
    const serialized = `${JSON.stringify(body, null, 2)}\n`;
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${STATE_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, serialized, "utf-8");
    await fs.rename(tmp, STATE_FILE);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to save state" });
  }
});

api.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use("/api", api);

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const dist = path.join(projectRoot, "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[budget-manager] API http://127.0.0.1:${PORT}`);
  if (isProd) {
    console.log(`[budget-manager] Serving SPA from ${path.join(projectRoot, "dist")}`);
  }
});
