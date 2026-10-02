import os, sys
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

URL = "https://scholars-abroad.onrender.com/"
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
errors = []
checks = []
def ok(cond, msg):
    checks.append((bool(cond), msg))
    print(("  PASS  " if cond else "  FAIL  ") + msg)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    def on_console(m):
        if m.type == "error" and "net::" not in m.text and "fonts.g" not in m.text:
            errors.append("console: " + m.text)
    page.on("console", on_console)

    page.goto(URL, wait_until="load", timeout=60000)
    page.wait_for_timeout(800)
    ok(page.locator(".ob").count() == 1, "deployed app loads (onboarding screen)")

    page.click('[data-action="ob-demo"]')
    page.wait_for_timeout(500)
    ok("#/home" in page.url, "demo student loads on deployed site")

    page.click("#chat-fab")
    page.wait_for_timeout(300)
    ok(page.is_visible("#chat-panel"), "chat panel opens")
    page.wait_for_timeout(2500)  # health check on cold host
    status = page.inner_text("#chat-status")
    ok("online" in status and "missing" not in status, "deployed chat status: " + status)

    page.fill("#chat-input", "Reply with exactly the word LIVE and nothing else.")
    page.press("#chat-input", "Enter")
    page.wait_for_function("() => document.querySelectorAll('.chat-bubble.bot').length >= 2", timeout=60000)
    reply = page.locator(".chat-bubble.bot").nth(1).inner_text()
    ok("LIVE" in reply.upper(), "live Groq reply through deployed UI: " + reply.strip()[:50])

    page.fill("#chat-input", "Which grade am I in? Just the number.")
    page.press("#chat-input", "Enter")
    page.wait_for_function("() => document.querySelectorAll('.chat-bubble.bot').length >= 3", timeout=60000)
    reply2 = page.locator(".chat-bubble.bot").nth(2).inner_text()
    ok("10" in reply2, "profile context works deployed: " + reply2.strip()[:50])

    page.screenshot(path=os.path.join(SHOTS, "deployed-chat.png"))
    browser.close()

print("\n--- JS errors ---")
print("  none" if not errors else "\n".join("  " + e for e in errors))
fails = [m for c, m in checks if not c]
print("\n=== %d passed, %d failed, %d js-errors ===" % (len(checks) - len(fails), len(fails), len(errors)))
if fails or errors:
    sys.exit(1)
