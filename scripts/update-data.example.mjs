import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, "..", "data", "insights.json");

async function main() {
  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);

  data.meta.updatedAt = new Date().toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("Demo data timestamp updated.");
  console.log("Next step: replace this file with Reddit fetch + AI analysis logic.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
