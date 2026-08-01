import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// 自定义错误类
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 错误处理中间件
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Zod 验证错误
  if (err instanceof ZodError) {
    const messages = err.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json({
      success: false,
      error: '参数验证失败',
      details: messages
    });
  }

  // Prisma 错误
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // 唯一约束冲突
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: '数据已存在'
      });
    }
    // 记录不存在
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }
  }

  // 自定义错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // 未知错误
  return res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
};
