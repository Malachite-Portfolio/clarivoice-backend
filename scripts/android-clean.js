const { spawnSync } = require("node:child_process");
const { rmSync, existsSync } = require("node:fs");
const path = require("node:path");

const androidDir = path.resolve(__dirname, "..", "android");
const pathsToDelete = ["app/.cxx", "app/build", "build"];

const result = spawnSync("gradlew.bat", ["clean"], {
  cwd: androidDir,
  stdio: "inherit",
  shell: true,
});

if (result.status === 0) {
  console.log("[android:clean] Gradle clean finished successfully.");
  process.exit(0);
}

console.warn(
  "[android:clean] Gradle clean failed due native clean artifacts. Running manual fallback cleanup."
);

for (const relPath of pathsToDelete) {
  const target = path.resolve(androidDir, relPath);
  if (!existsSync(target)) {
    continue;
  }
  try {
    rmSync(target, { recursive: true, force: true });
    console.log(`[android:clean] Removed ${target}`);
  } catch (error) {
    console.warn(
      `[android:clean] Could not fully remove ${target}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

process.exit(0);
