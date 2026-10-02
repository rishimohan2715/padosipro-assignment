import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import taskRoutes from "./routes/tasks";
import { errorHandler, HttpError } from "./middleware/error";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/tasks", taskRoutes);

  app.use((req, _res, next) => {
    next(new HttpError(404, "not_found", `No route for ${req.method} ${req.path}`));
  });
  app.use(errorHandler);
  return app;
}
