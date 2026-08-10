import { Request, Response, NextFunction } from 'express'; // Express 的请求和响应类型
import { verifyToken } from '../utils/jwt'; // 导入 JWT 验证函数
import { JwtPayload } from '@shared/types/api'; // 导入 JwtPayload 类型
import { prisma } from '../app'; // 导入 prisma 实例

// 扩展 Express 的 Request 类型，让 req.user 有类型提示
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * 中间件函数，用于验证 JWT 并将用户信息附加到请求对象上
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 从请求头中获取 Authorization 字段
  const authHeader = req.headers.authorization;
  // 如果没有提供 Authorization 字段，返回 401 未授权
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: '未提供授权信息',
    });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      message: '无效的授权信息',
    });
  }

  // 检查用户状态和 token 版本
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: '账号已被禁用，请联系管理员',
      });
    }

    // 检查 token 版本是否匹配，不匹配说明角色被修改，需要重新登录
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: '权限已变更，请重新登录',
      });
    }
  } catch (error) {
    // 数据库查询失败时不阻塞请求，继续处理
    console.error('检查用户状态失败:', error);
  }

  // 将解码后的用户信息附加到请求对象上
  req.user = payload;
  next(); // 调用 next() 以继续处理请求
}

/**
 * 角色守卫中间件
 * @param allowedRoles 允许的角色列表
 */
export function roleGuard(...allowedRoles: string[]) {
  // 返回一个中间件函数
  return (req: Request, res: Response, next: NextFunction) => {
    // 检查 req.user.roles 是否包含 allowedRoles 中的任意一个
    if (!req.user || !req.user.roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
      });
    }
    // 如果通过检查，调用 next() 以继续处理请求
    next();
  };
}
