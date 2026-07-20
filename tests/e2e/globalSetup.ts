import { rmSync, mkdirSync } from "fs";

export default function globalSetup() {
  rmSync("./data-e2e", { recursive: true, force: true });
  mkdirSync("./data-e2e", { recursive: true });
}
