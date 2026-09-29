import { ExceptionFilter, Catch, ArgumentsHost, Logger } from "@nestjs/common";

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
    console.error(exception);
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
    } else if (exception instanceof ForBiddenException) {
      let msg = exception.message;
      if (typeof exception.errors === "string") {
        msg = exception.errors;
      }
      return response.status(exception.status).json({
        ...exception,
        message: msg || exception.message,
      });
    } else if (exception instanceof UnAuthorizedException) {
      let msg = exception.message;
      if (typeof exception.errors === "string") {
        msg = exception.errors;
      }
      return response.status(exception.status).json({
        ...exception,
        message: msg || exception.message,
      });
    } else if (exception instanceof QueryFailedError) {
      if ((exception as any)?.code === "23505") {
        const detail = (exception as any)?.detail || "";
        let msg = "Dữ liệu bị trùng lặp!";
        if (detail.includes("tax_code") || detail.includes("taxCode")) {
          msg = "Mã số thuế đã tồn tại!";
        } else if (detail.includes("username")) {
          msg = "Mã số thuế hoặc tên đăng nhập đã tồn tại!";
        } else if (detail.includes("email")) {
          msg = "Email đã tồn tại!";
        }

        const badRequestException = new FieldDuplicatedException(
          {
            name: exception?.name,
            message: msg,
            code: (exception as any)?.code,
            detail: (exception as any)?.detail,
          },
          (exception as any)?.detail,
        );
        return response.status(badRequestException.status).json({
          ...badRequestException,
          message: msg,
        });
      } else {
        const internalError = new InternalServerException({
          name: exception?.name,
          message: exception?.message,
          code: (exception as any)?.code,
          detail: (exception as any)?.detail,
        });
        return response.status(internalError.status).json({
          ...internalError,
        });
      }
    } else if (exception?.status === 400) {
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
    } else {
      const internalError = new InternalServerException(exception?.message);
      return response.status(internalError.status).json({
        ...internalError,
      });
    }
  }
}
