import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { OtpError } from "../services/otp";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request body.",
        details: err.flatten(),
      },
    });
  }
  if (err instanceof OtpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  return res.status(500).json({
    error: { code: "server_error", message: "Something went wrong." },
  });
}
