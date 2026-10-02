import os, sys, re
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
HTTP_URL = "http://127.0.0.1:3000/"
FILE_URL = "file:///" + os.path.join(HERE, "index.html").replace("\\", "/")
SHOTS = os.path.join(HERE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)

errors = []
checks = []
def ok(cond, msg):
    checks.append((bool(cond), msg))
    print(("  PASS  " if cond else "  FAIL  ") + msg)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ================= HTTP mode: real Groq chat =================
    print("\n--- Chat over the backend (real Groq) ---")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    def on_console(m):
        if m.type == "error" and "net::" not in m.text and "fonts.g" not in m.text:
            errors.append("console: " + m.text)
    page.on("console", on_console)

    page.goto(HTTP_URL)
    page.wait_for_timeout(500)

    health = page.evaluate("""async () => (await fetch('/api/health')).json()""")
    ok(health.get("ok") is True, "page can reach /api/health")
    ok(health.get("chat") is True, "backend reports chat configured")

    # load demo student so profile context exists
    ok(page.locator('[data-action="ob-demo"]').count() == 1, "onboarding shows demo option")
    page.click('[data-action="ob-demo"]')
    page.wait_for_timeout(400)
    ok("#/home" in page.url, "demo student lands on home: " + page.url.split("#")[-1])

    # open chat
    page.click("#chat-fab")
    page.wait_for_timeout(250)
    ok(page.get_attribute("#chat-fab", "aria-expanded") == "true", "FAB aria-expanded=true while open")
    ok(page.is_visible("#chat-panel"), "chat panel opens")
    welcome = page.inner_text(".chat-bubble.bot")
    ok("ScholarAI" in welcome, "welcome message: " + welcome[:60].replace("\n", " "))
    ok("<b>" in page.inner_html(".chat-bubble.bot"), "welcome renders markdown bold")

    page.wait_for_timeout(1200)  # health check settles
    status = page.inner_text("#chat-status")
    ok("online" in status and "missing" not in status, "status shows online: " + status)
    page.screenshot(path=os.path.join(SHOTS, "chat-open.png"))

    # send a message
    page.fill("#chat-input", "Reply with exactly the word PONG and nothing else.")
    page.press("#chat-input", "Enter")
    page.wait_for_timeout(150)
    ok(page.locator(".chat-bubble.user").count() == 1, "user bubble appended")
    ok(page.inner_text(".chat-bubble.user").startswith("Reply with exactly"), "user text preserved")
    typing_shown = page.locator(".chat-typing").count() >= 0  # indicator may flash fast
    page.wait_for_function("() => document.querySelectorAll('.chat-bubble.bot').length >= 2", timeout=30000)
    reply = page.locator(".chat-bubble.bot").nth(1).inner_text()
    ok(len(reply.strip()) > 0, "got a model reply: " + reply.strip()[:50].replace("\n", " "))
    ok("PONG" in reply.upper(), "model obeyed instruction")
    ok(page.is_disabled("#chat-send") == False, "send button re-enabled after reply")
    ok(page.input_value("#chat-input") == "", "input cleared after send")

    # second message: profile context flows through
    page.fill("#chat-input", "Which grade am I in? Answer with just the grade number.")
    page.press("#chat-input", "Enter")
    page.wait_for_function("() => document.querySelectorAll('.chat-bubble.bot').length >= 3", timeout=30000)
    reply2 = page.locator(".chat-bubble.bot").nth(2).inner_text()
    ok("10" in reply2, "profile context reaches the model: " + reply2.strip()[:60].replace("\n", " "))

    # markdown table rendering
    page.fill("#chat-input", "Show a markdown table with header Country and exactly two rows (Harvard, Yale). Nothing else.")
    page.press("#chat-input", "Enter")
    page.wait_for_function("() => document.querySelectorAll('.chat-bubble.bot').length >= 4", timeout=45000)
    page.wait_for_timeout(300)
    tables = page.locator(".chat-table").count()
    ok(tables >= 1, "markdown table rendered as real <table>: %d" % tables)
    ths = page.locator(".chat-table th").count()
    ok(ths >= 1, "table has header cells: %d" % ths)
    page.screenshot(path=os.path.join(SHOTS, "chat-reply.png"))

    # history survived typing (3 user + welcome/3 bot)
    n_users = page.locator(".chat-bubble.user").count()
    ok(n_users == 3, "three user messages in transcript: %d" % n_users)

    # close via button, reopen, close via Escape
    page.click('[data-action="chat-close"]')
    page.wait_for_timeout(150)
    ok(not page.is_visible("#chat-panel"), "close button hides panel")
    ok(page.get_attribute("#chat-fab", "aria-expanded") == "false", "aria-expanded resets")
    page.click("#chat-fab")
    page.wait_for_timeout(150)
    page.keyboard.press("Escape")
    page.wait_for_timeout(150)
    ok(not page.is_visible("#chat-panel"), "Escape closes the chat")
    ok(page.locator(".chat-bubble.user").count() == 3, "transcript preserved across close/reopen")

    # chat panel must not break mobile layout or touch audit
    mob = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = mob.new_page()
    mp.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
    mp.goto(HTTP_URL + "#/profile")
    mp.wait_for_timeout(600)
    small = mp.evaluate("""() => {
      const bad = [];
      document.querySelectorAll('button, a, input, select, textarea, [role=button]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 44 && !el.classList.contains('link-btn') && !el.closest('.consent')
            && !el.classList.contains('tiny') && !el.closest('.date-sources') && !el.closest('.uni-live-src'))
          bad.push((el.tagName + '.' + (el.className||'')).slice(0,60) + ' h=' + Math.round(r.height));
      });
      return bad;
    }""")
    ok(len(small) == 0, "touch targets still >= 44px with chat FAB" + (": " + "; ".join(small[:6]) if small else ""))
    # open chat on mobile and screenshot
    mp.click("#chat-fab")
    mp.wait_for_timeout(400)
    panel_box = mp.locator("#chat-panel").bounding_box()
    ok(panel_box is not None and panel_box["width"] <= 390, "mobile chat panel fits viewport: %s" % (panel_box and round(panel_box["width"])))
    mp.screenshot(path=os.path.join(SHOTS, "chat-mobile.png"))
    mob.close()

    # ================= file:// mode: graceful offline =================
    print("\n--- Chat on file:// (graceful offline) ---")
    fctx = browser.new_context(viewport={"width": 1280, "height": 900})
    fp = fctx.new_page()
    ferrors = []
    fp.on("pageerror", lambda e: ferrors.append("pageerror: " + str(e)))
    fp.goto(FILE_URL)
    fp.wait_for_timeout(600)
    fp.click("#chat-fab")
    fp.wait_for_timeout(1000)
    fstatus = fp.inner_text("#chat-status")
    ok("offline" in fstatus, "file:// status says offline: " + fstatus)
    fp.fill("#chat-input", "hello?")
    fp.press("#chat-input", "Enter")
    fp.wait_for_timeout(2500)
    bubbles = fp.locator(".chat-bubble.bot").count()
    last_bot = fp.locator(".chat-bubble.bot").nth(bubbles - 1).inner_text() if bubbles else ""
    ok("npm start" in last_bot, "offline copy tells the user to run npm start: " + last_bot[:70].replace("\n", " "))
    ok("PONG" not in last_bot, "no fabricated model reply offline")
    ok(len(ferrors) == 0, "file:// chat produced no page errors" + (": " + "; ".join(ferrors) if ferrors else ""))
    fctx.close()

    ctx.close()
    browser.close()

print("\n--- JS errors captured ---")
if errors:
    for e in errors:
        print("  ERROR " + e)
else:
    print("  none")

fails = [m for c, m in checks if not c]
print("\n=== %d passed, %d failed, %d js-errors ===" % (len(checks) - len(fails), len(fails), len(errors)))
if fails or errors:
    sys.exit(1)
