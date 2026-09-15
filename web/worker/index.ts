/**
 * AMS Class analytics Worker, routed on ams-class.tokenzhang.com/api/*; the pages themselves stay on Cloudflare Pages.
 * It only mounts the copyable analytics module in ../analytics (routes and Durable Object).
 */
import { Hono } from 'hono';
import { registerAnalyticsRoutes } from '../analytics/routes';

export { VisitStatsDurableObject } from '../analytics/worker';

const app = new Hono<{ Bindings: Env }>();
registerAnalyticsRoutes(app);

export default app;
