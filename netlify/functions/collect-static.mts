import type { Config } from "@netlify/functions";
import { runStaticCollection } from "../../src/collect/static";
import { runAndRespond } from "../../src/handler";
import { createRuntime } from "../../src/runtime";

export default async () => runAndRespond("collect-static", () => runStaticCollection(createRuntime()));

// Every four hours at half past (0:30, 4:30, ... UTC), offset from collect-guild (on the hour) and collect-weekly (quarter past),
// so the runs do not crowd each other in Blizzard's rate limit. Whatever does not fit in the time budget follows in the next run.
export const config: Config = { schedule: "30 */4 * * *" };
