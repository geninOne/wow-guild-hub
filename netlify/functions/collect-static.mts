import type { Config } from "@netlify/functions";
import { runStaticCollection } from "../../src/collect/static";
import { runAndRespond } from "../../src/handler";
import { createRuntime } from "../../src/runtime";

export default async () => runAndRespond("collect-static", () => runStaticCollection(createRuntime()));

export const config: Config = { schedule: "@daily" };
