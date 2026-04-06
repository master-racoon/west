/**
 * Cloudflare Pages Functions entrypoint
 * This file exports the onRequest handler that Cloudflare Pages will use
 * to route all requests through our Hono app
 */

import app from "../src/app";

export const onRequest: PagesFunction = async (context) => {
  return app.fetch(context.request, context.env, context);
};
