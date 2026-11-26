import type { Config } from "@netlify/functions";
import { runGuildCollection } from "../../src/collect/guild";
import { runAndRespond } from "../../src/handler";
import { createRuntime } from "../../src/runtime";

export default async () => runAndRespond("collect-guild", () => runGuildCollection(createRuntime()));

export const config: Config = { schedule: "@hourly" };
