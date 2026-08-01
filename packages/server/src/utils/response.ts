import { Response } from 'express';

// 成功响应
export const sendSuccess = (res: Response, data?: any, message?: string) => {
  const response: any = { success: true };
  if (message) response.message = message;
  if (data !== undefined) response.data = data;
  return res.json(response);
};

// 分页响应
export const sendPaginated = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  pageSize: number
) => {
  return res.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
};

// 错误响应
export const sendError = (res: Response, statusCode: number, error: string) => {
  return res.status(statusCode).json({
    success: false,
    error
  });
};
