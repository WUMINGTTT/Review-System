import jwt from 'jsonwebtoken';
import { JwtPayload } from '@shared/types/api';

// JWT Secret 必须通过环境变量配置
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('警告: JWT_SECRET 环境变量未设置，请在 .env 文件中配置');
}

/**
 * 生成JWT令牌
 * @param { JwtPayload } payload JWT载荷
 * @returns 生成的JWT令牌
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '7d' });
}

/**
 * 验证JWT令牌
 * @param { string } token JWT令牌
 * @returns { JwtPayload | null } 验证结果，若验证成功返回JWT载荷，否则返回null
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as JwtPayload;
  } catch (error) {
    return null;
  }
}
