import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

import { QueryFailedError } from "typeorm";
import {
  BadRequestException,
  FieldDuplicatedException,
  ForBiddenException,
  InternalServerException,
  UnAuthorizedException,
} from "..";

@Catch()
export class ServiceErrorsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    Logger.error(">>>>throw exception: ", exception);

    if (exception instanceof BadRequestException) {
      let msg = exception.message;
      if (typeof exception.errors === "string") {
        msg = exception.errors;
      } else if (exception.errors && typeof exception.errors === "object") {
        if (typeof exception.errors.message === "string") {
          msg = exception.errors.message;
        } else if (Array.isArray(exception.errors.message)) {
          msg = exception.errors.message[0];
        }
      }
      return response.status(exception.status).json({
        ...exception,
        message: msg || exception.message,
      });
    }

    if (exception instanceof ForBiddenException) {
      let msg = exception.message;
      if (typeof exception.errors === "string") {
        msg = exception.errors;
      }
      return response.status(exception.status).json({
        ...exception,
        message: msg || exception.message,
      });
    }

    if (exception instanceof UnAuthorizedException) {
      let msg = exception.message;
      if (typeof exception.errors === "string") {
        msg = exception.errors;
      }
      return response.status(exception.status).json({
        ...exception,
        message: msg || exception.message,
      });
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception as any)?.code;
      const detail: string = (exception as any)?.detail || "";

      if (code === "23505") {
        let msg = "Dữ liệu bị trùng lặp!";
        if (detail.includes("email")) {
          msg = "Email đã tồn tại!";
        } else if (detail.includes("job_id")) {
          msg = "Ứng viên đã nộp hồ sơ cho tin này!";
        }

        const duplicated = new FieldDuplicatedException(
          { name: exception?.name, message: msg, code, detail },
          detail,
        );
        return response.status(HttpStatus.CONFLICT).json({
          ...duplicated,
          status: HttpStatus.CONFLICT,
          message: msg,
        });
      }

      if (code === "23503") {
        const msg =
          "Dữ liệu liên kết không tồn tại (công ty, người dùng hoặc tin tuyển dụng)";
        const badRequest = new BadRequestException({
          message: msg,
          code,
          detail,
        });
        return response.status(badRequest.status).json({
          ...badRequest,
          message: msg,
        });
      }

      const internalError = new InternalServerException({
        name: exception?.name,
        message: exception?.message,
        code,
        detail,
      });
      return response.status(internalError.status).json({
        ...internalError,
      });
    }

    if (exception?.status === 400) {
      const badRequestException = new BadRequestException(exception?.response);
      let msg = "Yêu cầu không hợp lệ";
      if (exception?.response && typeof exception.response === "object") {
        if (typeof exception.response.message === "string") {
          msg = exception.response.message;
        } else if (Array.isArray(exception.response.message)) {
          msg = exception.response.message[0];
        }
      } else if (typeof exception.response === "string") {
        msg = exception.response;
      }
      return response.status(badRequestException.status).json({
        ...badRequestException,
        message: msg,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res: any = exception.getResponse();
      const message =
        typeof res === "string"
          ? res
          : Array.isArray(res?.message)
            ? res.message[0]
            : (res?.message ?? exception.message);
      return response.status(status).json({ status, message, errors: res });
    }

    const internalError = new InternalServerException(exception?.message);
    return response.status(internalError.status).json({
      ...internalError,
    });
  }
}
