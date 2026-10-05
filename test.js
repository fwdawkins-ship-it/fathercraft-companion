/* Functional smoke test for The Dad Field Manual — jsdom, no browser needed. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost:8765/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

let failures = 0;
function check(name, cond) {
  if (cond) { console.log("PASS  " + name); }
  else { failures++; console.log("FAIL  " + name); }
}

// Load scripts the way a browser would (in order), with localStorage scoped.
window.localStorage.clear();
const dataSrc = fs.readFileSync(path.join(root, "js", "data.js"), "utf8");
const appSrc = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
window.eval(dataSrc);
window.eval(appSrc);

// -- Structure -------------------------------------------------------------
check("renders 4 checklist sections", document.querySelectorAll("#checklists-app .section-block").length === 4);
check("renders 4 field-note blocks", document.querySelectorAll("#notes-holder .section-block").length === 4);
const totalItems = document.querySelectorAll("#checklists-app .check-item input").length;
check("renders all checklist items (" + totalItems + ")", totalItems === 59);
check("renders habit grid (5 habits x 7 days)", document.querySelectorAll("#habits-app .daybox").length === 35);
check("overall progress starts at 0%", document.getElementById("overall-pct").textContent === "0%");

// -- Tab switching ----------------------------------------------------------
const tabs = Array.from(document.querySelectorAll(".tab"));
tabs.find(t => t.dataset.section === "dad-habits").click();
check("habits tab shows habits app", !document.getElementById("habits-app").hidden);
check("habits tab hides checklists", document.getElementById("checklists-app").hidden);
check("habits tab hides notes", document.getElementById("notes-app").hidden);
tabs.find(t => t.dataset.section === "hospital-day").click();
check("hospital tab shows checklists again", !document.getElementById("checklists-app").hidden);

// -- Checking items + persistence -------------------------------------------
const firstBox = document.querySelector("#checklists-app .check-item input");
firstBox.click();
const secondBox = document.querySelectorAll("#checklists-app .check-item input")[1];
secondBox.click();
check("check updates overall %", document.getElementById("overall-pct").textContent !== "0%");
const savedState = JSON.parse(window.localStorage.getItem("dad-field-manual-v1"));
check("state saved to localStorage", savedState && Object.keys(savedState.checks).length === 2);

// Simulate a fresh page load: new DOM + the same saved state a real browser
// would carry over (jsdom gives each window its own storage, so we copy it).
const dom2 = new JSDOM(html, { url: "http://localhost:8765/", runScripts: "outside-only", pretendToBeVisual: true });
const w2 = dom2.window, d2 = w2.document;
w2.localStorage.setItem("dad-field-manual-v1", JSON.stringify(savedState));
w2.eval(dataSrc);
w2.eval(appSrc);
const persisted = Array.from(d2.querySelectorAll("#checklists-app .check-item input")).filter(b => b.checked);
check("state persists across reload", persisted.length === 2);

// -- Notes -------------------------------------------------------------------
const ta = d2.querySelector("#notes-holder textarea");
ta.value = "Car seat check Saturday at fire station.";
ta.dispatchEvent(new w2.Event("input", { bubbles: true }));
const st2 = JSON.parse(w2.localStorage.getItem("dad-field-manual-v1"));
check("note saved", st2.notes["note-before-baby"] === "Car seat check Saturday at fire station.");

// -- Habit boxes -------------------------------------------------------------
w2.eval(`(function(){
  document.querySelector('.tab[data-section="dad-habits"]').click();
  var boxes = document.querySelectorAll("#habits-app .daybox");
  boxes[0].click(); boxes[1].click(); boxes[8].click();
})()`);
const st3 = JSON.parse(w2.localStorage.getItem("dad-field-manual-v1"));
const habitKeys = Object.keys(st3.habits).filter(k => st3.habits[k]);
check("3 habit boxes recorded", habitKeys.length === 3);
check("all keys scoped to week+day", habitKeys.every(k => /@\d{4}-\d{2}-\d{2}#\d$/.test(k)));
check("week total shows 3", d2.querySelector(".week-total").textContent.startsWith("3"));

// -- Reset -------------------------------------------------------------------
w2.confirm = () => true;
d2.getElementById("reset-all").click();
const st4Raw = w2.localStorage.getItem("dad-field-manual-v1");
const st4 = st4Raw ? JSON.parse(st4Raw) : { checks: {}, habits: {} };
check("reset wipes everything", Object.keys(st4.checks).length === 0 && Object.keys(st4.habits).length === 0);
check("overall back to 0%", d2.getElementById("overall-pct").textContent === "0%");

console.log("-----");
console.log(failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED");
process.exit(failures === 0 ? 0 : 1);