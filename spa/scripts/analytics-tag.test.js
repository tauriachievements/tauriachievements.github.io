const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const MEASUREMENT_ID = "G-XTSGVHYVTS";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const HEADLESS_CHROME = CHROME.replace("Chrome/", "HeadlessChrome/");

function analyticsScript() {
  const inline = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const analytics = inline.filter((script) => script.includes(MEASUREMENT_ID));
  assert.equal(analytics.length, 1, "one inline script sets up Google Analytics");
  return analytics[0];
}

function openPage(navigator) {
  const added = [];
  const page = {
    navigator,
    document: {
      createElement: (tagName) => ({ tagName }),
      head: { appendChild: (element) => added.push(element) },
    },
  };
  page.window = page;
  vm.runInNewContext(analyticsScript(), page);
  const commands = page.dataLayer ? Array.from(page.dataLayer, (entry) => Array.from(entry)) : [];
  return { added, commands };
}

test("a visitor's browser loads Google Analytics and queues the page view", () => {
  const { added, commands } = openPage({ webdriver: false, userAgent: CHROME });

  assert.equal(added.length, 1);
  assert.equal(added[0].tagName, "script");
  assert.equal(added[0].src, GTAG_SRC);
  assert.equal(added[0].async, true);
  assert.deepEqual(commands.map((command) => command[0]), ["js", "config"]);
  assert.deepEqual(commands[1], ["config", MEASUREMENT_ID]);
});

test("a browser driven by automation sends nothing to Google Analytics", () => {
  const { added, commands } = openPage({ webdriver: true, userAgent: CHROME });

  assert.deepEqual(added, []);
  assert.deepEqual(commands, []);
});

test("headless Chrome sends nothing to Google Analytics", () => {
  const { added, commands } = openPage({ webdriver: false, userAgent: HEADLESS_CHROME });

  assert.deepEqual(added, []);
  assert.deepEqual(commands, []);
});

test("index.html loads gtag.js only through that check, never as a static tag", () => {
  assert.doesNotMatch(indexHtml, /<script[^>]*\ssrc="https:\/\/www\.googletagmanager\.com/);
});
