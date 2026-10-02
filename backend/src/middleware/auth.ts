import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/token";
import { HttpError } from "./error";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "unauthenticated", "Missing bearer token."));
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    return next();
  } catch {
    return next(new HttpError(401, "invalid_token", "Session is invalid or expired."));
  }
}
