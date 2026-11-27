import config from "../config/server-start.json";
import { parseServerStart } from "./lib/server-start";

/** Day of the server start from `config/server-start.json`; null if none is set there. */
export const SERVER_START: string | null = parseServerStart(config);
