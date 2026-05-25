/**
 * Beta Testing API Controller
 * Composes all route modules into a single Hono app.
 */
import { Hono } from "hono";
import applicationRoutes from "./routes/application.routes";
import feedbackRoutes from "./routes/feedback.routes";
import scenarioRoutes from "./routes/scenario.routes";
import adminRoutes from "./routes/admin.routes";
import dashboardRoutes from "./routes/dashboard.routes";

const app = new Hono();

app.route("/", applicationRoutes);
app.route("/", feedbackRoutes);
app.route("/", scenarioRoutes);
app.route("/", adminRoutes);
app.route("/", dashboardRoutes);

export default app;
