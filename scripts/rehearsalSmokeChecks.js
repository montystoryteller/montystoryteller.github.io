const fs = require("fs");
const path = require("path");

const targetFile = path.resolve(
  __dirname,
  "..",
  "static",
  "audio_rehearsal_workspace3-tts.html",
);

function assertContains(content, needle, label, failures) {
  if (!content.includes(needle)) {
    failures.push(`Missing ${label}: ${needle}`);
  }
}

function assertRegex(content, regex, label, failures) {
  if (!regex.test(content)) {
    failures.push(`Missing ${label}: ${regex}`);
  }
}

function main() {
  if (!fs.existsSync(targetFile)) {
    console.error(`Missing target file: ${targetFile}`);
    process.exit(1);
  }

  const html = fs.readFileSync(targetFile, "utf8");
  const failures = [];

  assertContains(html, 'id="audio-file"', "audio file input", failures);
  assertContains(html, 'id="btn-loop-toggle"', "loop toggle button", failures);
  assertContains(html, 'id="mode-btn-repeat"', "repeat mode button", failures);
  assertContains(
    html,
    'id="mode-btn-release"',
    "release mode button",
    failures,
  );
  assertContains(
    html,
    'id="mode-btn-frontier"',
    "frontier mode button",
    failures,
  );
  assertContains(
    html,
    "function updateExitModeUI()",
    "exit mode UI function",
    failures,
  );
  assertContains(
    html,
    "function renderLoops()",
    "loop render function",
    failures,
  );
  assertContains(
    html,
    "function startPlayback(offset = 0)",
    "playback function",
    failures,
  );

  assertRegex(
    html,
    /const\s+controlsEnabled\s*=\s*!modeBtnRepeat\.disabled\s*&&\s*!modeBtnRelease\.disabled\s*&&\s*!modeBtnFrontier\.disabled\s*;/,
    "disabled-state controlsEnabled guard variable",
    failures,
  );
  assertRegex(
    html,
    /if\s*\(!controlsEnabled\)\s*return;/,
    "disabled-state early return guard",
    failures,
  );

  assertContains(
    html,
    "pendingExitMode === 'frontier'",
    "frontier save branch",
    failures,
  );
  assertContains(
    html,
    "pendingExitMode === 'release'",
    "release save branch",
    failures,
  );
  assertContains(
    html,
    "pendingExitMode = 'repeat'",
    "repeat mode default",
    failures,
  );

  if (failures.length > 0) {
    console.error("Rehearsal smoke checks failed:");
    for (const line of failures) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  console.log("Rehearsal smoke checks passed.");
}

main();
