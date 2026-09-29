import { HttpStatus } from "@nestjs/common";

export const FIELD_DUPLICATED = "FIELD DUPLICATED";

export const BAD_REQUEST = "BAD REQUEST";

export const INTERNAL_SERVER_ERROR = "INTERNAL SERVER ERROR";

export const UNAUTHORIZED = "UNAUTHORIZED";

export const FORBIDDEN = "FORBIDDEN";

export const NOTFOUND = "NOTFOUND";

export const SOMETHING_WRONG = "SOMETHING WRONG";

export const TOKEN_EXPIRED = "TOKEN EXPIRED";

export class ServiceError extends Error {
  name!: string;
  status!: number;
  code?: string;
  message!: string;
  detail?: string;
  errors?: any;

  constructor(error: any) {
    super();
    this.errors = error;
  }
}

export class BadRequestException extends ServiceError {
  constructor(error: any) {
    super(error);
    this.message = BAD_REQUEST;
    this.status = HttpStatus.BAD_REQUEST;
  }
}

export class FieldDuplicatedException extends BadRequestException {
  field: any;
  constructor(error: any, fieldName: any) {
    super(error);
    this.message = FIELD_DUPLICATED;
    this.field = fieldName;
  }
}

export class NotFoundException extends BadRequestException {
  constructor(error: any) {
    super(error);
    this.message = NOTFOUND;
    this.status = HttpStatus.NOT_FOUND;
  }
}

export class NotAcceptableException extends BadRequestException {
  constructor(error: any) {
    super(error);
    this.message = UNAUTHORIZED;
    this.status = HttpStatus.NOT_ACCEPTABLE;
  }
}

export class SomethingException extends BadRequestException {
  constructor(error: any) {
    super(error);
    this.message = INTERNAL_SERVER_ERROR;
    this.status = HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

export class TokenExpiredException extends BadRequestException {
  constructor(error: any) {
    super(error);
    this.message = TOKEN_EXPIRED;
  }
}

export class ForBiddenException extends ServiceError {
  constructor(error: any) {
    super(error);
    this.status = HttpStatus.FORBIDDEN;
    this.message = FORBIDDEN;
  }
}

export class UnAuthorizedException extends ServiceError {
  constructor(error: any) {
    super(error);
    this.status = HttpStatus.UNAUTHORIZED;
    this.message = UNAUTHORIZED;
  }
}

export class InternalServerException extends ServiceError {
  constructor(error: any) {
    super(error);
    this.status = HttpStatus.INTERNAL_SERVER_ERROR;
    this.message = INTERNAL_SERVER_ERROR;
  }
}
