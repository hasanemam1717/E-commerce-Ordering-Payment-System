export type AsyncHandler = (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) => Promise<void>;

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
