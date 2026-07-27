import jwt from 'jsonwebtoken';
import { JwtPayload } from '@shared/types/api';

/**
 * 生成JWT令牌
 * @param { JwtPayload } payload JWT载荷
 * @returns 生成的JWT令牌
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', { expiresIn: '7d' });
}
/**
 * 验证JWT令牌
 * @param { string } token JWT令牌
 * @returns { JwtPayload | null } 验证结果，若验证成功返回JWT载荷，否则返回null
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as JwtPayload;
  } catch (error) {
    return null;
  }
}
