import { rmSync, mkdirSync } from "fs";
import { execSync } from "child_process";

function killPort(port: number) {
  const kill = () => {
    try {
      const pid = execSync(`lsof -ti :${port}`, { stdio: "pipe" })
        .toString()
        .trim();
      if (pid) process.kill(Number(pid), "SIGTERM");
    } catch {
      // nothing listening on the port
    }
  };

  kill();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      execSync(`lsof -ti :${port}`, { stdio: "pipe" });
      execSync("sleep 0.2");
    } catch {
      return;
    }
  }
}

export default function globalSetup() {
  killPort(8081);
  killPort(4321);
  rmSync("./data-e2e", { recursive: true, force: true });
  mkdirSync("./data-e2e", { recursive: true });
}
