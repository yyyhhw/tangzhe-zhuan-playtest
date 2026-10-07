"""Independent DOG-ONLY browser smoke for the two-slot draft.

Requires an already available Playwright + WebKit installation and a complete
locally served checkout. Does not install or launch a server. Each device gets a
new disposable browser context, never a player's profile. No production URL is
accepted. This does not replace or modify test_pets2_e2e.py at d201ca2.
Cat C1-C8 and the original cat-specific U7 are NOT COVERED.
"""
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SAVE = "tangzhe-preview-save"
BAK = SAVE + "-bak"
FORMAL = "tangzhe-save"
LOCK = "tangzhe-preview-tab-lock"
SENTINEL = '{"dogSmokeFormalSentinel":1}'
ROOM = "c77"
UIDS = ["dog-a", "dog-b", "dog-c"]
GROWTH = {"dog-a": 51, "dog-b": 62, "dog-c": 73}
ADAPT = {
    "slots": "#petSlots [data-pet-slot]",
    "list": "#petList [data-pet-uid][data-where]",
    "place": '[data-act="petPlace"][data-arg="{uid}"]',
    "replace": "#petReplace [data-replace-uid]",
    "choice": '#petReplace [data-replace-uid="{uid}"]',
    "cancel": '#petReplace [data-act="petReplaceCancel"]',
    "sprite": '#roomFloor .pet-dog.pet-sprite[data-uid="{uid}"]',
    "pat": '[data-act="homePetPat"][data-arg="{uid}"]',
    "floor": "#roomFloor",
}

# App boot performs its normal load-time persistence before exposing __tzz. Freeze
# synchronously when that API is first assigned, before its queued animation frame
# runs. Also freeze explicitly after every load. Assertions snapshot AFTER boot.
FREEZE_INIT = """(() => {
  let api;
  Object.defineProperty(window, '__tzz', { configurable: true,
    get() { return api; },
    set(value) { api = value; if (api && api.pets && api.pets.manual) api.pets.manual(true); }
  });
})();"""


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def boot(page):
    page.wait_for_function("window.__tzz && window.PetGame && document.body.dataset.petReady === '1'", timeout=20000)
    contract = page.evaluate("""() => ({ testMode: __tzz.TEST_MODE,
      api: !!(__tzz.pets && __tzz.pets.manual && __tzz.pets.view && __tzz.pets.draw && __tzz.pets.world),
      model: PetGame.MAX_PER_ROOM === 2 && typeof PetGame.assign === 'function',
      save: __tzz.SAVE_KEY, backup: __tzz.BAK_KEY, blocked: __tzz.saveBlocked, frozen: __tzz.frozen })""")
    require(contract["testMode"] is False, "?test=homes ignores localStorage fixtures. Remove that query parameter.")
    require(contract["api"] and contract["model"], "Loaded app/model does not expose the two-slot draft contract: " + repr(contract))
    require(contract["save"] == SAVE and contract["backup"] == BAK, "Unexpected save keys; refusing to seed.")
    require(not contract["blocked"] and not contract["frozen"], "Fixture loaded blocked or frozen: " + repr(contract))
    page.evaluate("__tzz.pets.manual(true)")
    # Only dismiss boot-time intro/queued dialogs in this disposable fixture.
    page.evaluate("""async () => { for (let i=0; i<8; i++) {
      if (__tzz.modalOpen()) __tzz.closeModal();
      await new Promise(r => setTimeout(r, 120));
    } }""")


def draw(page):
    page.evaluate("__tzz.pets.draw()")
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => resolve()))")


def to_room(page):
    page.evaluate("""room => {
      __tzz.pets.manual(true); __tzz.setTab('home');
      __tzz.homeAct('homeWho', room); __tzz.homeAct('homeSub', 'room');
      __tzz.homeMode = 'live'; __tzz.renderTab(); __tzz.pets.draw();
    }""", ROOM)
    page.locator(ADAPT["floor"]).wait_for(state="visible")
    draw(page)


def reload_frozen(page):
    page.reload(wait_until="load")
    boot(page)
    to_room(page)


def seed(page):
    result = page.evaluate("""({save, backup, formal, sentinel, room}) => {
      __tzz.pets.manual(true);
      const previous = localStorage.getItem(formal);
      if (previous !== null && previous !== sentinel) throw Error('Formal sentinel changed before reseeding');
      const E=__tzz.E, s=E.newState(Date.now()), stamp=Date.now();
      for (const c of E.CEOS) {
        s.ceos[c.id].unlocked=true; s.ceos[c.id].lv=Math.max(1,s.ceos[c.id].lv||1);
        const h=E.homeOf(s,c.id); h.lv=2; h.placed=[];
      }
      s.coins=50000; s.taps=12; s.muted=true; delete s.pet;
      s.pets={v:2,list:[['dog-a',room,51],['dog-b',room,62],['dog-c',null,73]].map(([uid,where,affinity],i)=>({
        uid,species:'dog',room:where,boughtAt:stamp+i,
        eng:{v:1,home:where,savedAt:stamp,dog:{x:2+i,y:2,affinity,energy:80}}
      }))};
      PetGame.norm(s,E);
      const bad=[...E.validState(s),...E.checkSave(JSON.parse(JSON.stringify(s)))];
      if (bad.length) throw Error('Invalid fixture: '+bad.join(', '));
      const raw=JSON.stringify(s);
      localStorage.setItem(formal,sentinel); localStorage.setItem(save,raw); localStorage.setItem(backup,raw);
      return {uids:s.pets.list.map(p=>p.uid), species:s.pets.list.map(p=>p.species)};
    }""", {"save": SAVE, "backup": BAK, "formal": FORMAL, "sentinel": SENTINEL, "room": ROOM})
    require(result["uids"] == UIDS and result["species"] == ["dog"] * 3, "Seed construction did not create three dogs.")
    reload_frozen(page)
    loaded = roster(page)
    require(loaded["rooms"].get(ROOM) == ["dog-a", "dog-b"] and loaded["standby"] == ["dog-c"],
            "Fixture was not loaded. Inspect URL, test mode, served app, and loadInfo; this is not a selector failure: " + repr(loaded))
    require(growth(page) == GROWTH, "Fixture affinities changed while loading: " + repr(growth(page)))
    require(page.locator(ADAPT["slots"]).count() == 2 and page.locator(ADAPT["list"]).count() == 3,
            "Model fixture loaded, but expected current two-slot DOM is absent. See failure diagnostics.")
    sentinel_ok(page)


def roster(page):
    return page.evaluate("__tzz.pets.view()")


def growth(page):
    return page.evaluate("""() => Object.fromEntries(Object.entries(__tzz.pets.view().pets).map(
      ([uid,p]) => [uid,p.eng && p.eng.dog && p.eng.dog.affinity]))""")


def capture(page):
    return page.evaluate("""({save,backup}) => ({state:JSON.stringify(__tzz.state),
      main:localStorage.getItem(save), backup:localStorage.getItem(backup),
      slots:[...document.querySelectorAll('#petSlots [data-pet-slot]')].map(e=>e.dataset.uid||null),
      rows:[...document.querySelectorAll('#petList [data-pet-uid]')].map(e=>[e.dataset.petUid,e.dataset.where])})""",
                         {"save": SAVE, "backup": BAK})


def sentinel_ok(page):
    require(page.evaluate("k => localStorage.getItem(k)", FORMAL) == SENTINEL, "Formal save sentinel changed.")
    keys = set(page.evaluate("Object.keys(localStorage)"))
    require(keys <= {SAVE, BAK, FORMAL, LOCK}, "Unexpected storage keys: " + repr(keys))


def open_replacement(page):
    button = page.locator(ADAPT["place"].format(uid="dog-c"))
    require(button.count() == 1 and button.is_enabled(), "Expected enabled standby dog-c placement button is missing.")
    button.click(timeout=5000)
    page.locator("#petReplace").wait_for(state="visible", timeout=5000)
    ids = page.locator(ADAPT["replace"]).evaluate_all("els => els.map(e=>e.dataset.replaceUid)")
    require(sorted(ids) == ["dog-a", "dog-b"], "Replacement chooser must contain exactly the two residents: " + repr(ids))


def choose(page, uid):
    page.locator(ADAPT["choice"].format(uid=uid)).click(timeout=5000)
    page.locator("#petReplace").wait_for(state="detached", timeout=5000)
    draw(page)


def slots_and_list(page):
    seed(page)
    page.locator("#petSlots").scroll_into_view_if_needed()
    slots = page.locator(ADAPT["slots"]).evaluate_all("""els=>els.map(e=>{const r=e.getBoundingClientRect();
      return {uid:e.dataset.uid,h:r.height,visible:r.width>0&&r.left>=-0.5&&r.right<=innerWidth+0.5&&r.top>=-0.5&&r.bottom<=innerHeight+0.5};})""")
    require(len(slots) == 2 and sorted(x["uid"] for x in slots) == ["dog-a", "dog-b"] and all(x["h"] >= 40 and x["visible"] for x in slots), repr(slots))
    rows = page.locator(ADAPT["list"]).evaluate_all("els=>els.map(e=>[e.dataset.petUid,e.dataset.where,e.textContent])")
    require({u: w for u, w, _ in rows} == {"dog-a": ROOM, "dog-b": ROOM, "dog-c": "standby"}, repr(rows))
    require(any(u == "dog-c" and "待命" in text for u, _, text in rows), "Standby label missing.")
    name = page.evaluate("__tzz.E.CEO_BY_ID.c77.name")
    require(all(name in text for u, _, text in rows if u != "dog-c"), "Resident list lacks room/CEO names.")
    require(page.evaluate("document.documentElement.scrollWidth <= innerWidth + 0.5"), "Horizontal document overflow.")


def replacement_cancel(page):
    seed(page)
    before = capture(page)
    open_replacement(page)
    box = page.locator("#petReplace").evaluate("e=>{const r=e.getBoundingClientRect();return [r.top,r.bottom,innerHeight];}")
    require(box[0] >= -0.5 and box[1] <= box[2] + 0.5, "Replacement picker exceeds viewport: " + repr(box))
    page.locator(ADAPT["cancel"]).click(timeout=5000)
    draw(page)
    require(capture(page) == before, "Cancel changed full state, stored bytes, slots, or list.")


def resident_noop(page):
    seed(page)
    before = capture(page)
    button = page.locator(ADAPT["place"].format(uid="dog-a"))
    require(button.is_disabled(), "Already-resident button must be disabled.")
    # Do not ask Playwright to click a disabled control. Exercise the actual
    # dispatcher as a separate logical no-op, while retaining the DOM assertion.
    page.evaluate("__tzz.act('petPlace','dog-a')")
    draw(page)
    require(page.locator("#petReplace").count() == 0 and capture(page) == before, "Same-room placement was not a no-op.")


def replacement_success(page):
    seed(page)
    before = capture(page)
    open_replacement(page)
    choose(page, "dog-b")
    current, saved = roster(page), capture(page)
    require(current["rooms"].get(ROOM) == ["dog-a", "dog-c"] and current["standby"] == ["dog-b"], "Replacement placement incorrect.")
    require(growth(page) == GROWTH, "Replacement changed affinity.")
    old_state, new_state = json.loads(before["state"]), json.loads(saved["state"])
    require(new_state["coins"] == old_state["coins"] and new_state["rev"] == old_state["rev"] + 1, "Free assignment changed coins or failed to commit one revision.")
    require(saved["main"] == saved["state"] and saved["backup"] == before["main"], "Committed main/backup bytes do not match.")
    reload_frozen(page)
    require(roster(page)["rooms"] == current["rooms"] and roster(page)["standby"] == current["standby"] and growth(page) == GROWTH, "Reload lost placement or affinity.")


def replacement_failure(page, key, mode):
    seed(page)
    page.evaluate("""({main,backup,failed,mode})=>{
      const raw=localStorage.getItem(main);
      if (mode==='silent' && failed===backup) { const old=JSON.parse(raw); old.coins--; localStorage.setItem(backup,JSON.stringify(old)); }
      else localStorage.setItem(backup,raw);
      window.__dogSmokeWorlds={};
      for (const [uid,affinity,energy] of [['dog-a',88,12.75],['dog-b',99,34.5]]) {
        const w=__tzz.pets.world(uid); w.dog.affinity=affinity; w.dog.energy=energy; __dogSmokeWorlds[uid]=w;
      }
    }""", {"main": SAVE, "backup": BAK, "failed": key, "mode": mode})
    before = capture(page)
    page.evaluate("""({key,mode})=>{
      const originalSet=Storage.prototype.setItem, originalGet=Storage.prototype.getItem;
      window.__dogSmokeOps=[]; window.__dogSmokeRestore=()=>{Storage.prototype.setItem=originalSet;Storage.prototype.getItem=originalGet;};
      Storage.prototype.getItem=function(k){__dogSmokeOps.push(['get',k]);return originalGet.call(this,k);};
      Storage.prototype.setItem=function(k,v){__dogSmokeOps.push(['set',k]);if(k===key){
        if(mode==='quota')throw new DOMException('Injected disposable-fixture quota','QuotaExceededError');return;
      }return originalSet.call(this,k,v);};
    }""", {"key": key, "mode": mode})
    try:
        open_replacement(page)
        choose(page, "dog-b")
        require(capture(page) == before, "Failed save changed full state, main/backup bytes, or rendered placement.")
        live = page.evaluate("""()=>Object.entries(__dogSmokeWorlds).map(([uid,old])=>{
          const w=__tzz.pets.world(uid);return [uid,w===old,w.dog.affinity,w.dog.energy];})""")
        require(live == [["dog-a", True, 88, 12.75], ["dog-b", True, 99, 34.5]], "Failed-save resync lost unsaved live growth: " + repr(live))
        require(capture(page) == before, "Post-failure sync changed state or disk.")
        ops = page.evaluate("__dogSmokeOps")
        require(["set", key] in ops, "Injected failure was never exercised.")
        if mode == "silent":
            index = ops.index(["set", key])
            require(["get", key] in ops[index + 1:], "Silent failure was not checked by readback.")
    finally:
        page.evaluate("window.__dogSmokeRestore && __dogSmokeRestore()")


def stale_dialog(page):
    seed(page)
    open_replacement(page)
    result = page.evaluate("""()=>{const room=__tzz.E.CEOS.find(c=>c.id!=='c77').id;
      return PetGame.assign(__tzz.state,__tzz.E,'dog-a',room,{save:()=>true});}""")
    require(result.get("ok"), "Could not stage the isolated test race.")
    before_state = page.evaluate("JSON.stringify(__tzz.state)")
    before_main = page.evaluate("k=>localStorage.getItem(k)", SAVE)
    choose(page, "dog-b")
    require(page.evaluate("JSON.stringify(__tzz.state)") == before_state and page.evaluate("k=>localStorage.getItem(k)", SAVE) == before_main,
            "Stale replacement changed the complete post-race state or stored main.")


def two_sprites_and_targeted_touch(page):
    seed(page)
    page.locator(ADAPT["floor"]).scroll_into_view_if_needed()
    page.evaluate("""()=>{for(const [uid,x] of [['dog-a',1.5],['dog-b',4.5]]){
      const w=__tzz.pets.world(uid); w.dog.x=Math.min(w.cols-1.2,x);w.dog.y=w.rows/2;w.dog.z=0;
    }__tzz.pets.draw();}""")
    draw(page)
    for uid in UIDS[:2]:
        sprite = page.locator(ADAPT["sprite"].format(uid=uid))
        require(sprite.count() == 1 and sprite.is_visible(), "Missing real dog sprite for " + uid)
        require(sprite.locator("canvas").evaluate("e=>e.width>0&&e.height>0"), "Dog canvas has no size: " + uid)
    require(page.locator('#roomFloor .pet-sprite[data-uid]').count() == 2, "Expected exactly two resident sprites.")
    if page.evaluate("!__tzz.pet.M.placeholder"):
        page.wait_for_function("__tzz.pet.view && __tzz.pet.view.artMode === 'atlas'", timeout=10000)
    before = page.evaluate("() => ['dog-a','dog-b'].map(uid=>PetEngine.snapshot(__tzz.pets.world(uid)))")
    point = page.evaluate("""()=>{const w=__tzz.pets.world('dog-a'),r=document.querySelector('#roomFloor').getBoundingClientRect(),tile=r.width/w.cols;
      return {x:r.left+w.dog.x*tile,y:r.top+(w.dog.y-0.35)*tile,width:innerWidth,height:innerHeight};}""")
    require(0 < point["x"] < point["width"] and 0 < point["y"] < point["height"], "Touch target outside viewport: " + repr(point))
    page.touchscreen.tap(point["x"], point["y"])
    after = page.evaluate("() => ['dog-a','dog-b'].map(uid=>PetEngine.snapshot(__tzz.pets.world(uid)))")
    require(after[0] != before[0] and after[0]["dog"]["activity"] == "petted", "Target dog did not react to real touch.")
    require(after[1] == before[1], "Untargeted dog changed during the tap.")
    draw(page)


def diagnostics(page):
    return page.evaluate("""()=>({url:location.href,scripts:[...document.scripts].map(s=>s.src).filter(Boolean),
      testMode:window.__tzz&&__tzz.TEST_MODE,blocked:window.__tzz&&__tzz.saveBlocked,frozen:window.__tzz&&__tzz.frozen,
      loadInfo:window.__tzz&&__tzz.loadInfo,homeWho:window.__tzz&&__tzz.homeWho,homeSub:window.__tzz&&__tzz.homeSub,
      tab:document.querySelector('#app')&&document.querySelector('#app').dataset.tab,
      model:window.__tzz&&window.PetGame&&PetGame.view(__tzz.state,__tzz.E),
      slots:document.querySelectorAll('#petSlots [data-pet-slot]').length,
      list:document.querySelectorAll('#petList [data-pet-uid]').length,
      place:[...document.querySelectorAll('[data-act="petPlace"]')].map(e=>[e.dataset.arg,e.disabled]),
      petReady:document.body.dataset.petReady})""")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", nargs="?", default="http://127.0.0.1:49761/preview/index.html")
    parser.add_argument("--shots", type=Path, default=Path(__file__).resolve().parent / "_dogs2_shots")
    args = parser.parse_args()
    parsed = urlparse(args.url)
    require(parsed.scheme in {"http", "https"} and parsed.hostname in {"localhost", "127.0.0.1", "::1"}, "Only a disposable locally served preview URL is accepted.")
    require("/preview/" in parsed.path and parse_qs(parsed.query).get("test") != ["homes"], "Use the preview path without ?test=homes.")
    # Import only when explicitly run; syntax checking does not need Playwright.
    from playwright.sync_api import sync_playwright
    args.shots.mkdir(parents=True, exist_ok=True)
    results = []
    print("DOG-ONLY SMOKE. Original cat-specific U7 and C1-C8: NOT COVERED.")
    cases = [("D1_slots_and_list", slots_and_list), ("D2_cancel_full_state", replacement_cancel),
             ("D3_resident_noop", resident_noop), ("D4_replace_and_reload", replacement_success),
             ("D5_stale_dialog", stale_dialog), ("D6_two_dog_sprites_touch", two_sprites_and_targeted_touch)]
    for mode in ["quota", "silent"]:
        for key in [BAK, SAVE]:
            cases.append(("D7_" + mode + "_" + ("backup" if key == BAK else "main"), lambda page, k=key, m=mode: replacement_failure(page, k, m)))
    with sync_playwright() as playwright:
        browser = playwright.webkit.launch()
        try:
            for device in ["iPhone SE", "iPhone 15"]:
                context = browser.new_context(**playwright.devices[device], service_workers="block")
                context.add_init_script(FREEZE_INIT)
                page = context.new_page()
                page.set_default_timeout(7000)
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
                try:
                    page.goto(args.url, wait_until="load")
                    boot(page)
                    for name, case in cases:
                        tag = device.replace(" ", "_") + "_" + name
                        try:
                            case(page)
                            sentinel_ok(page)
                            page.screenshot(path=str(args.shots / (tag + ".png")), full_page=True)
                            results.append(True)
                            print("PASS", device, name)
                        except Exception as error:
                            results.append(False)
                            print("FAIL", device, name, str(error))
                            try:
                                (args.shots / (tag + ".json")).write_text(json.dumps(diagnostics(page), ensure_ascii=False, indent=2), encoding="utf-8")
                                page.screenshot(path=str(args.shots / (tag + "_failure.png")), full_page=True)
                            except Exception as diagnostic_error:
                                print("Diagnostic capture failed:", diagnostic_error)
                    results.append(not errors)
                    print("PASS" if not errors else "FAIL", device, "D8_page_errors", json.dumps(errors, ensure_ascii=False))
                except Exception as error:
                    results.append(False)
                    print("FAIL", device, "BOOT", str(error))
                    try:
                        (args.shots / (device.replace(" ", "_") + "_boot.json")).write_text(json.dumps(diagnostics(page), ensure_ascii=False, indent=2), encoding="utf-8")
                    except Exception:
                        pass
                finally:
                    context.close()
        finally:
            browser.close()
    print("Dog-only cases passed %d, failed %d. Cat U7/C1-C8 NOT COVERED. Browser emulation is not a real-device test." % (sum(results), len(results) - sum(results)))
    return 0 if results and all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
