import { purgeCache, type Config, type Context } from "@netlify/functions";
import { handleApi } from "../../src/api/router";
import { createNetlifyStore } from "../../src/store";

// Umgebung, IP und Cache-Leeren gehen an die Erweiterungen (src/erweiterungen); der Kern selbst braucht sie nicht.
export default (req: Request, context: Context) =>
  handleApi(req, createNetlifyStore(), undefined, {
    env: process.env,
    clientIp: context.ip,
    purgeCache: (tags) => purgeCache({ tags }),
  });

export const config: Config = { path: "/api/*" };
