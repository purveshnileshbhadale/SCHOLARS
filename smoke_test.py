import os, sys, json
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "file:///" + os.path.join(HERE, "index.html").replace("\\", "/")
SHOTS = os.path.join(HERE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)

errors = []
checks = []
def ok(cond, msg):
    checks.append((bool(cond), msg))
    print(("  PASS  " if cond else "  FAIL  ") + msg)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    def on_console(m):
        if m.type == "error" and "net::" not in m.text and "fonts.g" not in m.text:
            errors.append("console: " + m.text)
    page.on("console", on_console)

    # ---------------- Fresh onboarding flow ----------------
    print("\n--- Onboarding (desktop) ---")
    page.goto(URL)
    page.wait_for_timeout(400)
    ok(page.locator(".ob").count() == 1, "first screen is onboarding")
    ok(page.url.endswith("#/onboarding"), "hash is #/onboarding: " + page.url.split("/")[-1])

    page.click('[data-action="pick-grade"][data-grade="10"]')
    page.wait_for_timeout(120)
    tip = page.inner_text("#grade-tip")
    ok("Grade 10" in tip, "grade tip updates: " + tip[:60])
    page.fill("#ob-name", "TestKid")
    page.click('[data-action="ob-next"]')
    page.wait_for_timeout(150)
    ok("step 2 of 3" in page.inner_text(".ob").lower(), "advanced to step 2")

    page.click('[data-action="pick-major"][data-major="Computer Science"]')
    page.wait_for_timeout(120)
    pressed = page.get_attribute('[data-action="pick-major"][data-major="Computer Science"]', "aria-pressed")
    ok(pressed == "true", "major chip selected")

    page.click('[data-action="ob-next"]')
    page.wait_for_timeout(150)
    ok("step 3 of 3" in page.inner_text(".ob").lower(), "advanced to step 3")
    page.fill("#ob-current", "90")
    page.wait_for_timeout(250)
    ob_live = page.inner_text("#ob-live")
    ok("Projected profile strength" in ob_live,
       "onboarding live preview reacts as you type: " + ob_live.replace("\n", " ")[:90])
    page.fill("#sat", "1300")
    page.wait_for_timeout(250)
    ob_live2 = page.inner_text("#ob-live")
    ok(ob_live2 != ob_live and "Test scores" in ob_live2,
       "typed SAT updates the projection live: " + ob_live2.replace("\n", " ")[:90])
    page.fill("#sat", "")
    page.wait_for_timeout(200)

    # consent guard
    page.click('[data-action="ob-finish"]')
    page.wait_for_timeout(250)
    ok("#/onboarding" in page.url, "finish blocked without parental consent")
    toast_txt = page.inner_text("#toast-host") if page.locator(".toast").count() else ""
    ok("parent or guardian" in toast_txt.lower(), "friendly consent message shown")

    page.check(".consent input")
    page.click('[data-action="ob-finish"]')
    page.wait_for_timeout(350)
    ok("#/home" in page.url, "finish lands on home: " + page.url.split("#")[-1])
    ok(page.locator(".tabbar").count() == 1 and page.locator(".sidebar").count() == 1, "app shell (sidebar + tabbar) present")
    score = page.inner_text(".ring-score")
    ok("/100" in score, "profile ring renders score: " + score.replace("\n", " "))
    ok(page.locator(".move-card").count() == 1, "'Your next best move' card present")
    ok(page.locator(".target-card").count() == 3, "3 top targets shown")
    ok(page.locator("#dates-card").count() == 1, "home shows live key-dates card")
    dates_txt = page.inner_text("#dates-card")
    ok(any(w in dates_txt for w in ("in ", "today", "tomorrow")),
       "date card counts down from today: " + dates_txt.replace("\n", " ")[-120:])
    clock1 = page.locator(".live-clock").first.inner_text()
    page.wait_for_timeout(1300)
    clock2 = page.locator(".live-clock").first.inner_text()
    ok(clock1 != clock2, "live clock ticks in real time: " + clock1 + " → " + clock2)
    page.screenshot(path=os.path.join(SHOTS, "01-home-desktop.png"), full_page=True)

    # ---------------- Profile + pillar ----------------
    print("\n--- Profile builder ---")
    page.goto(URL + "#/profile")
    page.wait_for_timeout(300)
    ok(page.locator(".pillar-card").count() == 5, "5 pillar cards")
    ok(page.locator(".fab").count() == 1, "floating Add achievement button")
    page.screenshot(path=os.path.join(SHOTS, "02-profile-desktop.png"), full_page=True)

    page.goto(URL + "#/profile/awards")
    page.wait_for_timeout(300)
    ok("Awards" in page.inner_text("h1"), "pillar detail header")
    ok(page.locator(".empty").count() == 1, "awards empty state on fresh profile")
    ok("school-level" in page.inner_text(".empty"), "empty state copy is specific")
    page.screenshot(path=os.path.join(SHOTS, "03-pillar-empty.png"), full_page=True)

    # ---------------- Add achievement ----------------
    print("\n--- Add achievement ---")
    page.goto(URL + "#/add")
    page.wait_for_timeout(300)
    ok(page.locator('[data-action="pick-type"]').count() == 8, "8 achievement type chips")
    page.click('[data-action="save-entry"]')
    page.wait_for_timeout(200)
    ok(page.locator("#err-type").is_visible(), "type validation message")
    ok(page.locator("#err-name").count() == 0, "name field hidden until a type is chosen")

    page.click('[data-action="pick-type"][data-type="competition"]')
    page.wait_for_timeout(200)
    ok(page.locator('[data-action="pick-level"]').count() == 4, "level segmented control appears")
    ok(page.locator('[data-action="pick-result"]').count() == 3, "result options appear")
    page.click('[data-action="save-entry"]')
    page.wait_for_timeout(200)
    ok(page.locator("#err-name").is_visible(), "name validation message")
    page.fill("#f-name", "Regional Robotics Challenge")
    page.click('[data-action="pick-level"][data-level="state"]')
    page.wait_for_timeout(150)
    page.click('[data-action="pick-result"][data-result="winner"]')
    page.wait_for_timeout(150)
    page.fill("#f-hrs", "4")
    page.fill("#f-wks", "8")
    desc = "Built the robot and led the drive team to first place regionally."
    page.fill("#f-desc", desc)
    page.wait_for_timeout(200)
    counter = page.inner_text("#desc-counter")
    ok(counter == "%d/150" % len(desc), "character counter live: " + counter)
    impact = page.inner_text("#impact-box")
    ok("pillar:" in impact.lower() and "%" in impact, "live estimated impact box: " + impact.replace("\n", " ")[:90])
    ok(page.locator("#impact-live").count() == 1, "impact box gains a live projection row")
    proj_txt = page.inner_text("#impact-live")
    ok("Profile strength" in proj_txt and "→" in proj_txt,
       "projection shows overall strength before saving: " + proj_txt.replace("\n", " ")[:100])
    ok("fit" in proj_txt.lower(), "projection shows university fit live: " + proj_txt.replace("\n", " ")[100:180])
    page.screenshot(path=os.path.join(SHOTS, "04-add-form.png"), full_page=True)

    before_score = page.inner_text(".ring-score") if page.locator(".ring-score").count() else None
    page.click('[data-action="save-entry"]')
    page.wait_for_timeout(400)
    ok("#/home" in page.url or "#/profile" in page.url, "save returns to previous screen: " + page.url.split("#")[-1])
    toast = page.inner_text("#toast-host") if page.locator(".toast").count() else ""
    ok("Saved" in toast, "confirmation toast: " + toast.replace("\n", " ")[:80])

    # entry persisted?
    page.goto(URL + "#/profile/awards")
    page.wait_for_timeout(300)
    ok("Regional Robotics" in page.inner_text("body"), "saved entry listed on awards pillar")
    ok(page.locator(".entry-item").count() == 1, "one entry row")

    # edit + delete round trip
    page.click('[data-action="edit-entry"]')
    page.wait_for_timeout(300)
    ok(page.locator("#f-name").input_value() == "Regional Robotics Challenge", "edit loads entry into form")
    page.click('[data-action="form-back"]')
    page.wait_for_timeout(300)
    page.click('[data-action="delete-entry"]')
    page.wait_for_timeout(250)
    ok(page.locator(".modal").count() == 1, "delete confirmation modal opens")
    page.click('[data-action="confirm-delete"]')
    page.wait_for_timeout(350)
    ok(page.locator(".entry-item").count() == 0, "entry deleted")

    # ---------------- Chances ----------------
    print("\n--- Ivy chances ---")
    page.goto(URL + "#/chances")
    page.wait_for_timeout(350)
    ok(page.locator(".uni-row").count() == 8, "all 8 Ivies listed")
    bands = page.locator(".chip-reach, .chip-high").all_inner_texts()
    ok(all(b in ("Reach", "High reach") for b in bands) and len(bands) >= 8, "only Reach / High reach bands: " + ",".join(sorted(set(bands))))
    ok("admission percentages" in page.inner_text(".disclaimer").lower() or "never show admission" in page.inner_text(".disclaimer").lower(), "persistent honest disclaimer")
    ok(page.locator(".dots").count() == 8, "5-dot fit meter per row")
    page.click('[data-action="chances-sort"][data-sort="az"]')
    page.wait_for_timeout(300)
    first_uni = page.locator(".uni-row h4").first.inner_text()
    ok(first_uni == "Brown", "A–Z sort puts Brown first: " + first_uni)
    page.click('[data-action="chances-sort"][data-sort="ranked"]')
    page.wait_for_timeout(300)
    ok(page.locator("#dates-card").count() == 1, "chances shows live application-deadline card")
    ok("Early Decision" in page.inner_text("#dates-card"), "deadline card names Early Decision")
    page.screenshot(path=os.path.join(SHOTS, "05-chances.png"), full_page=True)

    # university detail
    page.goto(URL + "#/university/cornell")
    page.wait_for_timeout(300)
    body = page.inner_text("body")
    ok("Why this band" in body, "university detail: why this band")
    ok("top 2 strengths" in body.lower(), "top 2 strengths section")
    strength_txt = page.inner_text(".strength-list")
    ok("at 0%" not in strength_txt, "no 0% pillar passed off as a strength: " + strength_txt.replace("\n", " ")[:80])
    ok("top 2 gaps" in body.lower(), "top 2 gaps section")
    gap_txt = page.inner_text(".gap-list")
    gap_lines = [l for l in gap_txt.split("\n") if l.strip()]
    ok(len(gap_lines) >= 2 and gap_lines[0].split("—")[-1].strip() != gap_lines[1].split("—")[-1].strip(),
       "the two gap lines are distinct copy")
    ok(page.locator(".act-item").count() == 3, "3 concrete actions")
    ok("Placeholder weights" in body, "emphasis weights marked as placeholder")
    ok("Check Cornell" in body or "check" in body.lower(), "policy-check prompt for international rules")
    # live Wikipedia summary (falls back gracefully offline)
    ok(page.locator("#uni-live").count() == 1, "university live 'About' card present")
    try:
        page.wait_for_function(
            "() => { const el = document.getElementById('uni-live');"
            " return el && (el.innerText.indexOf('Live from Wikipedia') >= 0"
            " || el.innerText.indexOf('Offline') >= 0"
            " || el.innerText.indexOf('timed out') >= 0); }",
            timeout=12000)
    except Exception:
        pass
    live_txt = page.inner_text("#uni-live")
    ok("Live from Wikipedia" in live_txt or "Offline" in live_txt or "timed out" in live_txt,
       "live Wikipedia summary or graceful fallback: " + live_txt.replace("\n", " ")[:110])
    # live deadline countdowns for this school
    ok(page.locator("#uni-deadlines").count() == 1, "university deadline countdown card present")
    dl_txt = page.inner_text("#uni-deadlines")
    ok("Early Decision" in dl_txt and "Regular Decision" in dl_txt,
       "early + regular deadlines listed: " + dl_txt.replace("\n", " ")[:120])
    ok(any(w in dl_txt for w in ("in ", "today", "tomorrow")), "deadline countdown is live")
    page.screenshot(path=os.path.join(SHOTS, "06-university.png"), full_page=True)

    # ---------------- Roadmap ----------------
    print("\n--- Roadmap ---")
    page.goto(URL + "#/roadmap")
    page.wait_for_timeout(300)
    ok(page.locator(".tabs button").count() == 4, "4 timeline period tabs")
    ok(page.locator("#dates-card").count() == 1, "roadmap shows live deadlines card")
    ok(page.locator(".task").count() >= 3, "tasks listed: " + str(page.locator(".task").count()))
    ok(page.locator(".chip-points").count() >= 1, "points badges (+N) shown")
    # toggle a task
    first_toggle = page.locator('[data-action="toggle-task"]').first
    tid = first_toggle.get_attribute("data-id")
    was_done = "done" in (first_toggle.locator("xpath=ancestor::li[1]").get_attribute("class") or "")
    first_toggle.click()
    page.wait_for_timeout(300)
    cls_after = page.locator("li.task").first.get_attribute("class")
    if was_done:
        ok("done" not in (cls_after or ""), "toggling un-completes a task")
    else:
        ok("done" in (cls_after or ""), "toggling completes a task")
    page.click('[data-action="roadmap-period"][data-period="summer"]')
    page.wait_for_timeout(300)
    ok("period=summer" in page.url, "period tab switches via hash: " + page.url.split("#")[-1])
    # counsellor modal
    page.click('[data-action="open-counsellor"]')
    page.wait_for_timeout(250)
    ok(page.locator(".modal").count() == 1, "counsellor contact form opens")
    page.click('[data-action="send-counsellor"]')
    page.wait_for_timeout(200)
    ok(page.locator("#err-cn").is_visible(), "counsellor form validates")
    page.fill("#cn-name", "Aarav Parent")
    page.fill("#cn-contact", "parent@example.com")
    page.click('[data-action="send-counsellor"]')
    page.wait_for_timeout(250)
    ok("Message sent" in page.inner_text(".modal"), "counsellor success state")
    page.click('[data-action="close-modal"]')
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(SHOTS, "07-roadmap.png"), full_page=True)

    # ---------------- Settings + demo data ----------------
    print("\n--- Settings + demo ---")
    page.goto(URL + "#/settings")
    page.wait_for_timeout(300)
    ok(page.locator("#st-name").count() == 1, "settings: name field")
    ok(page.locator('[data-action="export-data"]').count() == 1, "export JSON button")
    ok(page.locator("#live-data").count() == 1, "settings: live data status card")
    live_card = page.inner_text("#live-data")
    ok("Connected" in live_card or "Offline" in live_card, "live data shows connection state: " +
       ("Connected" if "Connected" in live_card else "Offline"))
    ok(page.locator('[data-action="refresh-live"]').count() == 1, "refresh live summaries button")
    ok(page.locator('[data-action="reset-data"]').count() == 1, "reset button")
    page.click('[data-action="reset-data"]')
    page.wait_for_timeout(250)
    ok("can't be undone" in page.inner_text(".modal"), "reset confirm dialog")
    page.click('[data-action="close-modal"]')
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(SHOTS, "08-settings.png"), full_page=True)

    # demo student
    print("\n--- Demo data ---")
    page.evaluate("localStorage.clear()")
    page.goto(URL + "#/onboarding")
    page.reload()
    page.wait_for_timeout(400)
    page.click('[data-action="ob-demo"]')
    page.wait_for_timeout(500)
    ok("#/home" in page.url, "demo button lands on home")
    ok("Aarav" in page.inner_text("h1"), "greeting uses demo name: " + page.inner_text("h1"))
    demo_score = page.inner_text(".ring-score")
    ok("/100" in demo_score, "demo score renders: " + demo_score.replace("\n", " "))
    ok(page.locator(".badge-change").count() == 1, "'+N this month' change badge: " +
       (page.inner_text(".badge-change") if page.locator(".badge-change").count() else ""))
    page.goto(URL + "#/profile")
    page.wait_for_timeout(300)
    entries = page.locator(".pillar-card").all_inner_texts()
    ok(len(entries) == 5, "demo has all 5 pillar cards")
    weak = page.locator(".bar.weak").count()
    ok(weak >= 1, "demo shows at least one weak-pillar amber bar: " + str(weak))
    page.goto(URL + "#/chances")
    page.wait_for_timeout(300)
    ok(page.locator(".uni-row").count() == 8, "demo chances: 8 Ivies")
    page.screenshot(path=os.path.join(SHOTS, "09-demo-chances.png"), full_page=True)

    # real-time academics → overall strength
    print("\n--- Real-time reactivity ---")
    page.goto(URL + "#/profile/academics")
    page.wait_for_timeout(350)
    ok(page.locator("#acad-overall").count() == 1, "academics page shows overall strength")
    overall_before = page.inner_text("#acad-overall")
    page.fill("#ac-current", "97")
    page.wait_for_timeout(300)
    overall_after = page.inner_text("#acad-overall")
    acad_after = page.inner_text("#acad-live-score")
    ok(overall_before != overall_after,
       "typing a grade moves overall strength instantly: " + overall_before + " → " + overall_after)
    ok("/100" in acad_after, "academics pillar score updates live: " + acad_after)
    page.fill("#ac-current", "92")
    page.wait_for_timeout(250)
    ok(page.inner_text("#acad-overall") == overall_before, "restoring the grade restores the score")

    # persistence across reload
    print("\n--- Persistence ---")
    page.goto(URL + "#/settings")
    page.wait_for_timeout(300)
    page.fill("#st-name", "PersistedName")
    page.wait_for_timeout(250)
    page.reload()
    page.wait_for_timeout(400)
    page.goto(URL + "#/settings")
    page.wait_for_timeout(300)
    ok(page.locator("#st-name").input_value() == "PersistedName", "name survives reload (localStorage)")

    # ---------------- Mobile layout ----------------
    print("\n--- Mobile (390x844) ---")
    mob = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mp = mob.new_page()
    mp.on("pageerror", lambda e: errors.append("mobile pageerror: " + str(e)))
    mp.goto(URL + "#/onboarding")
    mp.wait_for_timeout(400)
    mp.click('[data-action="ob-demo"]')
    mp.wait_for_timeout(500)
    ok("#/home" in mp.url, "mobile: demo loads")
    ok(mp.locator(".tabbar").is_visible(), "bottom tab bar visible on phone")
    ok(not mp.locator(".sidebar").is_visible(), "sidebar hidden on phone")
    ok(mp.locator(".tabbar a").count() == 5, "5 tab bar items")
    ok(mp.locator("#dates-card").count() == 1, "mobile: live dates card renders")
    mp.screenshot(path=os.path.join(SHOTS, "10-home-mobile.png"))
    mp.goto(URL + "#/chances")
    mp.wait_for_timeout(350)
    mp.screenshot(path=os.path.join(SHOTS, "11-chances-mobile.png"))
    mp.goto(URL + "#/roadmap")
    mp.wait_for_timeout(350)
    mp.screenshot(path=os.path.join(SHOTS, "12-roadmap-mobile.png"))
    mp.goto(URL + "#/add")
    mp.wait_for_timeout(350)
    mp.screenshot(path=os.path.join(SHOTS, "13-add-mobile.png"))
    # tab bar must not cover content at the bottom of a long page
    mp.goto(URL + "#/profile")
    mp.wait_for_timeout(350)
    mp.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    mp.wait_for_timeout(250)
    covered = mp.evaluate("""() => {
      const tb = document.querySelector('.tabbar').getBoundingClientRect();
      const els = [...document.querySelectorAll('main .card, main .empty')];
      return els.some(el => { const r = el.getBoundingClientRect();
        return r.bottom > tb.top + 4 && r.top < tb.bottom - 4 && r.height > 10; });
    }""")
    ok(not covered, "tab bar does not cover cards when scrolled to bottom")

    # touch target audit
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
    ok(len(small) == 0, "touch targets >= 44px (exceptions noted)" + (": " + "; ".join(small[:6]) if small else ""))

    # ---------------- Keyboard + a11y basics ----------------
    print("\n--- Keyboard / a11y ---")
    page.goto(URL + "#/home")
    page.wait_for_timeout(300)
    focusables = page.evaluate("""() => document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea').length""")
    ok(focusables > 10, "keyboard focusable elements present: " + str(focusables))
    aria = page.evaluate("""() => {
      const iconOnly = [...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && b.querySelector('svg'));
      return iconOnly.filter(b => !b.getAttribute('aria-label')).length;
    }""")
    ok(aria == 0, "icon-only buttons have aria-labels (missing: %d)" % aria)
    page.keyboard.press("Tab")
    focused = page.evaluate("() => document.activeElement.tagName + ' ' + (document.activeElement.getAttribute('href')||'')")
    ok(focused != "BODY", "first Tab focuses a control: " + focused)

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
