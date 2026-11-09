const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const spaRoot = path.join(__dirname, "..");
const srcDir = path.join(spaRoot, "src");
const generatedDataDir = path.join(srcDir, "assets", "data");
const outputPath = path.join(generatedDataDir, "data-manifest.json");
const DATA_FILE_PATTERN = /\.(json|txt)$/i;

function buildDataManifest() {
  const files = {};

  for (const publicPath of listDataFiles()) {
    const content = fs.readFileSync(path.join(srcDir, publicPath));
    files[publicPath] = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  }

  return { files };
}

function listDataFiles() {
  const angularConfig = JSON.parse(fs.readFileSync(path.join(spaRoot, "angular.json"), "utf8"));
  const project = Object.values(angularConfig.projects)[0];
  const assetFiles = project.architect.build.options.assets
    .filter((asset) => typeof asset === "string")
    .map((asset) => path.relative(srcDir, path.join(spaRoot, asset)).split(path.sep).join("/"))
    .filter((publicPath) => fs.existsSync(path.join(srcDir, publicPath)))
    .flatMap((publicPath) => fs.statSync(path.join(srcDir, publicPath)).isDirectory()
      ? listFolderFiles(srcDir, publicPath)
      : [publicPath]);
  const generatedFiles = fs.existsSync(generatedDataDir)
    ? listFolderFiles(srcDir, "assets/data")
    : [];

  return [...new Set([...assetFiles, ...generatedFiles])]
    .filter((publicPath) => DATA_FILE_PATTERN.test(publicPath) && path.join(srcDir, publicPath) !== outputPath)
    .sort();
}

function listFolderFiles(root, publicPath) {
  return fs.readdirSync(path.join(root, publicPath), { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = `${publicPath}/${entry.name}`;
      if (entry.isDirectory()) {
        return listFolderFiles(root, entryPath);
      }
      return entry.isFile() ? [entryPath] : [];
    });
}

function generateDataManifest() {
  const manifest = buildDataManifest();

  fs.mkdirSync(generatedDataDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${Object.keys(manifest.files).length} files)`);
}

module.exports = { buildDataManifest, generateDataManifest, listFolderFiles };
