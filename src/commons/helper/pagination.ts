import { BadRequestException } from "commons/error";

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getPagination(query: PaginationQuery): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException("page phải là số nguyên lớn hơn hoặc bằng 1");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException("limit phải là số nguyên từ 1 đến 100");
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
