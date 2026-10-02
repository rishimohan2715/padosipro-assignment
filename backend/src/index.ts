import { createApp } from "./app";
import { config } from "./config";

const isProd = config.nodeEnv === "production";

if (isProd && config.jwtSecret === "dev-secret-change-me") {
  throw new Error(
    "JWT_SECRET is still the development default. Set a real secret before running in production."
  );
}

if (isProd && config.mail.transport === "console") {
  // eslint-disable-next-line no-console
  console.warn(
    "[warn] MAIL_TRANSPORT=console in production — OTPs will only appear in these logs, " +
      "not in users' inboxes. Set MAIL_TRANSPORT=smtp."
  );
}

const app = createApp();
app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[api] listening on port ${config.port} (env=${config.nodeEnv}, mail=${config.mail.transport})`
  );
});
