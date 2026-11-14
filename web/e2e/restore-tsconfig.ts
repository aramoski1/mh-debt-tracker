import { execFileSync } from "node:child_process";

/** Next adds the e2e build folder to tsconfig. That folder is generated, so leave the committed file alone. */
export default function restoreTsconfig() {
  try {
    execFileSync("git", ["checkout", "--", "tsconfig.json"], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
  } catch {
    // A missing git checkout should not fail the desk check.
  }
}
