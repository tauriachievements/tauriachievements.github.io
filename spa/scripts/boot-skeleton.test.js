const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "src");
const read = (file) => fs.readFileSync(path.join(src, file), "utf8");
const squash = (text) => text.replace(/\s+/g, "");

const indexHtml = read("index.html");
const bootCss = squash(indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1]);
const skeletonScss = read("app/shared/_skeleton.scss");
const stylesScss = read("scss/styles.scss");
const headerScss = read("app/core/update-bar.component.scss");
const mythicPlusViews = read("app/features/mythic-plus/mythic-plus-views.ts");

function scssVariable(name) {
  const match = skeletonScss.match(new RegExp(`\\$${name}:\\s*([^;]+);`));
  assert.ok(match, `$${name} is defined in _skeleton.scss`);
  return squash(match[1]);
}

function bootLayouts() {
  const script = indexHtml.match(/var layout = ([^;]+);/);
  assert.ok(script, "index.html picks a boot layout");
  return [...script[1].matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
}

test("the boot skeleton's bones and frames use the app skeleton's colours", () => {
  assert.ok(bootCss.includes(`background-color:${scssVariable("skeleton-bone")}`));
  assert.ok(bootCss.includes(`transparent38%,${scssVariable("skeleton-shine")}50%,transparent62%`));
  assert.ok(bootCss.includes(`border:1pxsolid${scssVariable("skeleton-line")}`));
  assert.ok(bootCss.includes(`background:${scssVariable("skeleton-frame")}`));
});

test("the boot skeleton sweeps like the app skeleton", () => {
  const sweep = squash(skeletonScss.match(/animation:\s*mp-skeleton-sweep([^;]+);/)[1]);
  assert.ok(bootCss.includes(`animation:boot-sweep${sweep};`));
  assert.ok(bootCss.includes("background-attachment:fixed"));
  assert.ok(bootCss.includes("@media(prefers-reduced-motion:no-preference)"));
});

test("the boot header has the real header's height, background and breakpoints", () => {
  const height = stylesScss.match(/--update-bar-height:\s*([^;]+);/)[1];
  assert.ok(bootCss.includes(`height:${height};`));

  const background = headerScss.match(/\.site-bar\s*\{[^}]*?background:\s*([^;]+);/)[1];
  assert.ok(bootCss.includes(`background:${squash(background)};`));

  for (const width of ["1499px", "1023px", "960px", "640px"]) {
    assert.ok(headerScss.includes(`@media (max-width: ${width})`), `the header changes at ${width}`);
    assert.ok(bootCss.includes(`@media(max-width:${width})`), `the boot header changes at ${width}`);
  }
});

test("every boot layout has sections, and the CSS names no other layout", () => {
  const layouts = bootLayouts();
  assert.deepEqual(layouts, ["mythic-plus", "raids", "table"]);

  for (const layout of layouts) {
    assert.ok(indexHtml.includes(`boot-in-${layout}`), `${layout} shows at least one section`);
    assert.ok(bootCss.includes(`[data-boot="${layout}"].boot-in-${layout}`), `${layout} has a rule that shows its sections`);
  }

  const named = new Set([...bootCss.matchAll(/\[data-boot="([a-z-]+)"\]/g)].map((match) => match[1]));
  assert.deepEqual([...named].sort(), layouts);
});

test("the Mythic+ boot layout switches to cards where the leaderboard does", () => {
  const width = Number(mythicPlusViews.match(/MYTHIC_PLUS_CARDS_QUERY = '\(max-width: (\d+)px\)'/)[1]);
  assert.ok(bootCss.includes(`@media(max-width:${width}px){[data-boot="mythic-plus"].boot-table{display:none;}}`));
  assert.ok(bootCss.includes(`@media(min-width:${width + 1}px){[data-boot="mythic-plus"].boot-cards{display:none;}}`));
});

test("the boot skeleton sits inside app-root, so Angular replaces it when the app renders", () => {
  const appRoot = indexHtml.match(/<app-root>([\s\S]*)<\/app-root>/);
  assert.ok(appRoot, "app-root holds the boot markup");
  assert.ok(appRoot[1].includes('class="boot-bar" aria-hidden="true"'));
  assert.ok(appRoot[1].includes('class="boot" aria-hidden="true"'));
});
