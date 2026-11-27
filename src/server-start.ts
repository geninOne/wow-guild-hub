import config from "../config/serverstart.json";
import { parseServerStart } from "./lib/server-start";

/** Day of the server start from `config/serverstart.json`; null if none is set there. */
export const SERVER_START: string | null = parseServerStart(config);
