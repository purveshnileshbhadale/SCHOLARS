"use strict";
/* Round-trip backend tests: static files, health, REAL Groq chat. */
const BASE = process.env.BASE || "http://127.0.0.1:3456";
let pass = 0, fail = 0;
function ok(cond, label, extra){
  if (cond){ pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label + (extra !== undefined ? " → " + JSON.stringify(extra) : "")); }
}

async function main(){
  console.log("--- Static + health ---");
  const home = await fetch(BASE + "/");
  const html = await home.text();
  ok(home.status === 200, "GET / → 200", home.status);
  ok(html.includes("Scholars Abroad"), "index.html served");
  ok(html.includes("chat-panel"), "chat UI served");

  const health = await (await fetch(BASE + "/api/health")).json();
  ok(health.ok === true, "health ok");
  ok(health.chat === true, "health reports chat configured", health);

  const trav = await fetch(BASE + "/../../../Windows/win.ini");
  ok(trav.status !== 200, "path traversal blocked", trav.status);

  const other = await fetch(BASE + "/api/health", { method: "POST" });
  ok(other.status === 405, "POST /api/health → 405", other.status);

  console.log("--- Chat validation ---");
  const noMsg = await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
  });
  ok(noMsg.status === 400, "missing message → 400", noMsg.status);

  const badJson = await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "not json"
  });
  ok(badJson.status === 400, "bad JSON → 400", badJson.status);

  const tooLong = await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "x".repeat(3000) })
  });
  ok(tooLong.status === 400, "oversized message → 400", tooLong.status);

  console.log("--- Real Groq round trip ---");
  const t0 = Date.now();
  const chat = await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Reply with exactly the word PONG and nothing else.",
      context: { name: "Aarav", grade: "Grade 10", major: "Computer Science" }
    })
  });
  const data = await chat.json();
  const ms = Date.now() - t0;
  ok(chat.status === 200, "chat → 200", { s: chat.status, d: data });
  ok(typeof data.reply === "string" && data.reply.length > 0, "got a reply: " + JSON.stringify((data.reply || "").slice(0, 60)));
  ok(/pong/i.test(data.reply || ""), "model obeyed a trivial instruction", data.reply);
  ok(ms < 30000, "replied in under 30s: " + ms + "ms");

  console.log("--- Real Groq personalisation ---");
  const chat2 = await fetch(BASE + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What grade am I in? Answer with just the grade.",
      context: { name: "Aarav", grade: "Grade 10", major: "Computer Science" }
    })
  });
  const d2 = await chat2.json();
  ok(chat2.status === 200 && /10/.test(d2.reply || ""), "context reaches the model: " + JSON.stringify((d2.reply || "").slice(0, 80)));

  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
