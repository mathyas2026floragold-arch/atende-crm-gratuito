import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const backend = (process.env.CRM_BACKEND_URL || "http://api:8000").replace(/\/$/, "");
const token = process.env.CRM_BACKEND_TOKEN || "";

app.use(express.json({ limit: "4mb" }));

app.use("/api/crm", async (req, res) => {
  try {
    const target = `${backend}/api${req.url}`;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const init = { method: req.method, headers };
    if (!["GET", "HEAD"].includes(req.method)) init.body = JSON.stringify(req.body ?? {});
    const response = await fetch(target, init);
    const text = await response.text();
    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(502).json({ detail: "Backend indisponível", error: String(error) });
  }
});

const here = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here, "dist")));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(here, "dist", "index.html")));
app.listen(port, "0.0.0.0", () => console.log(`Atende CRM disponível na porta ${port}`));
