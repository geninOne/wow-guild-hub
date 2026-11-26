import serverstart from "../config/serverstart.json";
import { parseServerStart } from "./lib/serverstart";

/** Tag des Serverstarts aus `config/serverstart.json`; null, wenn dort keiner steht. */
export const SERVER_START: string | null = parseServerStart(serverstart);
