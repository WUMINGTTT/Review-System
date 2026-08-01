import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// 校验请求体
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
};

// 校验查询参数
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as any;
    next();
  };
};
