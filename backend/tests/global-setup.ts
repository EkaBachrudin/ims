import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./config";

export default function globalSetup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
