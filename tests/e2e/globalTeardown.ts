import { execSync } from "child_process";

export default function globalTeardown() {
  if (process.env.E2E_DOCKER !== "1") return;
  try {
    execSync("docker compose -f docker-compose.e2e.yml down --remove-orphans", {
      stdio: "pipe",
    });
  } catch {
    // stack already gone
  }
}
