/**
 * Analytics Worker, routed on <host>/api/* for both host names of the site; the pages themselves stay on Cloudflare
 * Pages. It only mounts the copyable analytics module in ../analytics (routes and Durable Object).
 *
 * The reference manual has an /api/ section of its own, so anything under /api/ that the module does not claim is
 * passed on to Pages, where the redirects generated at build time send it to its new home under /doc/.
 */
import { Hono } from 'hono';
import { registerAnalyticsRoutes } from '../analytics/routes';

export { VisitStatsDurableObject } from '../analytics/worker';

const app = new Hono<{ Bindings: Env }>();
registerAnalyticsRoutes(app);
app.notFound((c) => fetch(c.req.raw));

export default app;
