import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = error instanceof HttpException ? error.getStatus() : 500;
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      Number.isInteger(error.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    )
      status = error.statusCode;
    if (status >= 500) console.error("API_INTERNAL_ERROR");
    host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(status)
      .send({
        code:
          status === 404
            ? "NOT_FOUND"
            : status >= 500
              ? "INTERNAL_ERROR"
              : "INVALID_REQUEST",
      });
  }
}
