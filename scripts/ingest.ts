import "dotenv/config";
import { runIngest } from "../src/lib/ingest";

const seasonArg = process.argv[2];
const season = seasonArg ? Number(seasonArg) : undefined;

runIngest(season)
  .then((result) => {
    console.log("Ingest complete:", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Ingest failed:", err);
    process.exit(1);
  });
