import { execSync } from "child_process";

// Clears stale listeners from previous sessions so a run can't be served by
// an orphan server holding previous-session state (that's how a demo run once
// saw a git connection from an earlier attempt).
//
// Playwright workers re-import the config module AFTER the run's webServers
// are listening, so only the FIRST invocation — main process, config load,
// before any webServer exists — does the killing; it marks the env and
// worker re-imports (which inherit it) no-op. Listeners only — established
// client sockets (health polls, browsers) must never match.
export function killStalePorts(): void {
  if (process.env.EXCALIHUB_PORTS_CLEANED === "1") return;
  process.env.EXCALIHUB_PORTS_CLEANED = "1";

  // Docker mode owns :8081 via docker-proxy; `docker rm -f` handles the
  // container. Host-side webServers (:4321 hub, :8099 stub) still need it.
  const ports = process.env.E2E_DOCKER === "1" ? [4321, 8099] : [8081, 4321, 8099];

  for (const port of ports) {
    // Parse the headed output: with -t, lsof drops the -sTCP:LISTEN filter.
    // lsof exits 1 with no output when nothing listens — empty list.
    const listeningPids = (): number[] => {
      try {
        return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { stdio: "pipe" })
          .toString()
          .split("\n")
          .slice(1)
          .map((line) => Number(line.trim().split(/\s+/)[1]))
          .filter((n) => Number.isInteger(n) && n > 0);
      } catch {
        return [];
      }
    };

    const signal = (pids: number[], sig: NodeJS.Signals) =>
      pids.forEach((pid) => {
        try {
          process.kill(pid, sig);
        } catch {
          // already exited
        }
      });

    let pids = listeningPids();
    if (pids.length === 0) continue;
    console.log(`[cleanup] stale listeners on :${port} (pids ${pids.join(", ")})`);

    signal(pids, "SIGTERM");
    const deadline = Date.now() + 5000;
    while (pids.length > 0 && Date.now() < deadline) {
      execSync("sleep 0.2", { stdio: "pipe" });
      pids = listeningPids();
      signal(pids, "SIGTERM");
    }
    if (pids.length > 0) {
      signal(pids, "SIGKILL");
      execSync("sleep 0.5", { stdio: "pipe" });
      pids = listeningPids();
    }
    if (pids.length > 0) {
      throw new Error(
        `Port ${port} is still held by ${pids.join(", ")} — a stale server ` +
          "would serve this run with previous-session state"
      );
    }
  }
}
