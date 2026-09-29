import { HttpStatus } from "@nestjs/common";
import * as ERROR from "./error";

export interface ResponseData<T> {
  data?: T;
  message?: string;
  code?: number;
  success?: boolean;
}

export interface List<T> {
  items: T;
  count?: number;
  pageSize?: number;
  pageNumber?: number;
  common?: any;
}

interface Code {
  code: number;
  message: string;
}

export default class Response {
  static SUCCESSFULLY = {
    code: HttpStatus.OK,
    message: "Successfully!",
    success: true,
  };
  static SOMETHING_WRONG = { code: 3000, message: "Something wrong" };
  static NOT_FOUND(name: string): Code {
    return { code: 3001, message: `${name} not found` };
  }
  static EXISTED(name: string): Code {
    return { code: 3001, message: `${name} had already existed` };
  }
  static DOET_OR_MOET_NOT_FOUND = {
    code: 3002,
    message: "Doet or Moet not found",
  };
  static SCHOOL_YEAR_EXISTED = {
    code: 3031,
    message: "School year had already existed",
  };
  static DOCUMENT_NOT_SUPPORT = { code: 3033, message: "Document not support" };
  static WRONG_PASS = { code: 3034, message: "Wrong password" };
  static DISABLE_USER = { code: 3035, message: "User is disabled" };
  static PERMISSION = { code: 3036, message: "You don't have permission" };
  static WRONG_TOKEN = { code: 3037, message: "Token is wrong" };

  static success(message: string): ResponseData<null> {
    return {
      message,
      success: true,
      code: HttpStatus.OK,
    };
  }

  static getList<T>(list: List<T[]>): ResponseData<List<T[]>> {
    return {
      data: list,
      ...this.SUCCESSFULLY,
    };
  }

  static get<T>(data: T): ResponseData<T> {
    return {
      data,
      ...this.SUCCESSFULLY,
    };
  }

  static errorInternal(data?: any): ERROR.SomethingException {
    console.error(data);
    if (data?.status) return data;
    const error = data instanceof Error ? data.message : data;

    return new ERROR.SomethingException({ ...this.SOMETHING_WRONG, error });
  }

  static errorNotFound(error?: any): ERROR.NotFoundException {
    console.error(error);
    return new ERROR.NotFoundException(error);
  }

  static errorBad(error?: any): ERROR.BadRequestException {
    console.error(error);
    return new ERROR.BadRequestException(error);
  }

  static errorForBidden(error?: any): ERROR.ForBiddenException {
    console.error(error);
    return new ERROR.ForBiddenException(error);
  }

  static LOGIN_FAILED = {
    code: 3040,
    message: "Tài khoản hoặc mật khẩu không đúng. Xin vui lòng thử lại",
  };
  static MISSING_INFO = {
    code: 3041,
    message: "Vui lòng nhập đầy đủ thông tin",
  };
}
