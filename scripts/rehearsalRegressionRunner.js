const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const casesDir = path.join(repoRoot, "tests", "rehearsal", "cases");
const runsDir = path.join(repoRoot, "tests", "rehearsal", "runs");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadCases() {
  const files = fs
    .readdirSync(casesDir)
    .filter((name) => name.endsWith(".json"));
  const allCases = [];
  for (const file of files) {
    const fullPath = path.join(casesDir, file);
    const parsed = readJson(fullPath);
    const cases = Array.isArray(parsed.cases) ? parsed.cases : [];
    for (const item of cases) {
      allCases.push({ ...item, _sourceFile: file });
    }
  }
  return allCases;
}

function validateCases(cases) {
  const errors = [];
  const seenIds = new Set();

  for (const item of cases) {
    const missing = [];
    if (!item.id) missing.push("id");
    if (!item.title) missing.push("title");
    if (!Array.isArray(item.steps) || item.steps.length === 0)
      missing.push("steps");
    if (!Array.isArray(item.expected) || item.expected.length === 0)
      missing.push("expected");

    if (missing.length > 0) {
      errors.push(
        `Case in ${item._sourceFile} is missing: ${missing.join(", ")}`,
      );
      continue;
    }

    if (seenIds.has(item.id)) {
      errors.push(`Duplicate case id: ${item.id}`);
    }
    seenIds.add(item.id);
  }

  return errors;
}

function printList(cases) {
  const sorted = [...cases].sort((a, b) => a.id.localeCompare(b.id));
  console.log(`Loaded ${sorted.length} rehearsal regression cases.`);
  for (const item of sorted) {
    const area = item.area || "unspecified";
    console.log(`- ${item.id} [${area}] ${item.title}`);
  }
}

function timestampSlug() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function toChecklistMarkdown(cases) {
  const lines = [];
  lines.push("# Rehearsal Regression Run");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Result legend: [ ] not run, [x] pass, [!] fail");
  lines.push("");

  const sorted = [...cases].sort((a, b) => a.id.localeCompare(b.id));
  for (const item of sorted) {
    lines.push(`## ${item.id} - ${item.title}`);
    lines.push("");
    lines.push(`- Area: ${item.area || "unspecified"}`);
    lines.push(`- Source: ${item._sourceFile}`);
    lines.push("- Status: [ ]");
    lines.push("");

    if (Array.isArray(item.preconditions) && item.preconditions.length > 0) {
      lines.push("Preconditions:");
      for (const pre of item.preconditions) lines.push(`- ${pre}`);
      lines.push("");
    }

    lines.push("Steps:");
    for (const step of item.steps) lines.push(`- ${step}`);
    lines.push("");

    lines.push("Expected:");
    for (const exp of item.expected) lines.push(`- ${exp}`);
    lines.push("");

    lines.push("Notes:");
    lines.push("- ");
    lines.push("");
  }

  return lines.join("\n");
}

function runChecklist(cases) {
  fs.mkdirSync(runsDir, { recursive: true });
  const outputPath = path.join(runsDir, `run-${timestampSlug()}.md`);
  const content = toChecklistMarkdown(cases);
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Created checklist: ${path.relative(repoRoot, outputPath)}`);
}

function main() {
  const mode = process.argv[2];
  const cases = loadCases();
  const errors = validateCases(cases);

  if (errors.length > 0) {
    console.error("Regression case validation failed:");
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  if (mode === "--list") {
    printList(cases);
    return;
  }

  if (mode === "--run") {
    runChecklist(cases);
    return;
  }

  console.log("Usage: node scripts/rehearsalRegressionRunner.js --list|--run");
}

main();
