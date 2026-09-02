import { execSync } from "child_process";

export default function globalTeardown() {
  if (process.env.E2E_DOCKER === "1") {
    try {
      execSync("docker rm -f excalihub-e2e", { stdio: "pipe" });
    } catch {
      // container already gone
    }
  }
}
