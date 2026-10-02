"use strict";
/* ============================================================
   Scholars Abroad — backend server (zero dependencies)
   - Serves the single-file frontend (index.html) + assets
   - POST /api/chat  → Groq chat completions proxy (ScholarAI)
   - GET  /api/health → liveness + config status
   The Groq API key lives ONLY here, never in the browser.
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

/* ---------- tiny .env loader (no dependencies) ---------- */
(function loadEnv(){
  try {
    const file = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    file.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        let v = m[2];
        if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    });
  } catch (_) { /* .env optional — platform env vars work fine */ }
})();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const ROOT = __dirname;

const SYSTEM_PROMPT = (() => {
  try {
    return fs.readFileSync(path.join(ROOT, "scholar-prompt.txt"), "utf8").trim();
  } catch (e) {
    return "You are ScholarAI, a helpful study-abroad mentor.";
  }
})();

/* ---------- static files ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function serveStatic(req, res, pathname){
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/landing.html";
  const abs = path.normalize(path.join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return send(res, 403, { error: "forbidden" });
  }
  fs.readFile(abs, (err, buf) => {
    if (err) return send(res, 404, { error: "not found" });
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

function send(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

/* ---------- naive per-IP rate limit for /api/chat ---------- */
const hits = new Map();
function rateLimited(ip){
  const now = Date.now();
  const win = 60 * 1000;
  const rec = hits.get(ip);
  if (!rec || now - rec.start > win){ hits.set(ip, { start: now, n: 1 }); return false; }
  rec.n++;
  if (hits.size > 5000) hits.clear();
  return rec.n > 30;
}

/* ---------- profile context sanitiser ----------
   The browser may send a small snapshot of the student's profile
   so ScholarAI can personalise. Only scalars are accepted. */
function cleanContext(raw){
  if (!raw || typeof raw !== "object") return null;
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
  const out = {};
  const name = str(raw.name, 40);       if (name) out.name = name;
  const grade = str(raw.grade, 10);     if (grade) out.grade = grade;
  const major = str(raw.major, 60);     if (major) out.major = major;
  const board = str(raw.board, 40);     if (board) out.board = board;
  const score = Number(raw.score);      if (Number.isFinite(score)) out.profileStrength = Math.round(score);
  const label = str(raw.label, 40);     if (label) out.strengthLabel = label;
  const pillars = str(raw.pillars, 300); if (pillars) out.pillars = pillars;
  const targets = str(raw.topTargets, 200); if (targets) out.topTargets = targets;
  const move = str(raw.nextMove, 120);  if (move) out.nextBestMove = move;
  return Object.keys(out).length ? out : null;
}

function buildMessages(body){
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { error: "message is required" };
  if (message.length > 2000) return { error: "message too long (max 2000 characters)" };

  let system = SYSTEM_PROMPT;
  const ctx = cleanContext(body.context);
  if (ctx){
    system += "\n\n---\n# LIVE STUDENT CONTEXT (from the Scholars Abroad app)\n" +
      "Personalise your answer using this profile. Do not invent additional details:\n" +
      JSON.stringify(ctx, null, 2);
  }

  const messages = [{ role: "system", content: system }];
  if (Array.isArray(body.history)){
    body.history.slice(-10).forEach(h => {
      if (!h || typeof h.content !== "string") return;
      if (h.role !== "user" && h.role !== "assistant") return;
      const c = h.content.trim().slice(0, 1500);
      if (c) messages.push({ role: h.role, content: c });
    });
  }
  messages.push({ role: "user", content: message });
  return { messages };
}

/* ---------- /api/chat ---------- */
async function handleChat(req, res){
  const ip = req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) return send(res, 429, { error: "Too many messages — wait a minute and try again." });
  if (!GROQ_KEY) return send(res, 503, { error: "Chat is not configured on this server (GROQ_API_KEY missing)." });

  let raw = "";
  let aborted = false;
  req.on("data", c => {
    raw += c;
    if (raw.length > 64 * 1024){ aborted = true; req.destroy(); }
  });
  req.on("end", async () => {
    if (aborted) return;
    let body;
    try { body = JSON.parse(raw || "{}"); }
    catch (e){ return send(res, 400, { error: "invalid JSON" }); }

    const built = buildMessages(body);
    if (built.error) return send(res, 400, { error: built.error });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const upstream = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + GROQ_KEY },
        body: JSON.stringify({
          model: MODEL,
          messages: built.messages,
          temperature: 0.4,
          max_tokens: 1200
        }),
        signal: ctrl.signal
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok){
        const msg = (data && data.error && data.error.message) || ("Groq HTTP " + upstream.status);
        console.error("[chat] upstream error:", upstream.status, msg);
        return send(res, 502, { error: "AI service error: " + msg });
      }
      const reply = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
      if (!reply) return send(res, 502, { error: "Empty response from AI service." });
      return send(res, 200, { reply: reply, model: data.model || MODEL });
    } catch (err){
      const why = err && err.name === "AbortError" ? "AI service timed out." : "Could not reach the AI service.";
      console.error("[chat] fetch failed:", err && err.message);
      return send(res, 502, { error: why });
    } finally { clearTimeout(timer); }
  });
}

/* ---------- router ---------- */
const server = http.createServer((req, res) => {
  let u;
  try { u = new URL(req.url, "http://localhost"); }
  catch (e){ return send(res, 400, { error: "bad request" }); }
  const p = u.pathname;

  if (p === "/api/health"){
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "GET only" });
    return send(res, 200, { ok: true, chat: !!GROQ_KEY, model: MODEL, uptime: Math.round(process.uptime()) });
  }
  if (p === "/api/chat"){
    if (req.method !== "POST") return send(res, 405, { error: "POST only" });
    return handleChat(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method not allowed" });
  if (p === "/app"){
    res.writeHead(302, { Location: "/index.html" });
    return res.end();
  }
  return serveStatic(req, res, p);
});

server.listen(PORT, HOST, () => {
  console.log("Scholars Abroad server → http://localhost:" + PORT);
  console.log("  chat: " + (GROQ_KEY ? "configured (model " + MODEL + ")" : "DISABLED — set GROQ_API_KEY"));
});
