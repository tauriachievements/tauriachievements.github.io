const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildDataManifest, listFolderFiles } = require("./generate-data-manifest");

test("lists the served data files with a short content hash", () => {
  const { files } = buildDataManifest();

  assert.match(files["lastUpdated.txt"], /^[0-9a-f]{12}$/);
  assert.match(files["RareAchievements.json"], /^[0-9a-f]{12}$/);
});

test("lists the data files inside asset folders", () => {
  const { files } = buildDataManifest();

  assert.match(files["guild-analysis/endless.json"], /^[0-9a-f]{12}$/);
});

test("lists the files in the folders inside an asset folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-manifest-"));
  try {
    fs.mkdirSync(path.join(root, "mythic-plus-data", "legion-s1-1"), { recursive: true });
    fs.writeFileSync(path.join(root, "mythic-plus-data", "index.json"), "{}");
    fs.writeFileSync(path.join(root, "mythic-plus-data", "legion-s1-1", "index.json"), "{}");

    assert.deepEqual(listFolderFiles(root, "mythic-plus-data").sort(), [
      "mythic-plus-data/index.json",
      "mythic-plus-data/legion-s1-1/index.json"
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("lists each generated data file once", () => {
  const listed = Object.keys(buildDataManifest().files);

  assert.equal(listed.length, new Set(listed).size);
});

test("never lists itself", () => {
  assert.equal(buildDataManifest().files["assets/data/data-manifest.json"], undefined);
});
