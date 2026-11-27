import { purgeCache, type Config, type Context } from "@netlify/functions";
import { handleApi } from "../../src/api/router";
import { createNetlifyStore } from "../../src/store";

// Environment, IP and cache purging are for the extensions (src/extensions); the core itself does not need them.
export default (req: Request, context: Context) =>
  handleApi(req, createNetlifyStore(), undefined, {
    env: process.env,
    clientIp: context.ip,
    purgeCache: (tags) => purgeCache({ tags }),
  });

export const config: Config = { path: "/api/*" };
