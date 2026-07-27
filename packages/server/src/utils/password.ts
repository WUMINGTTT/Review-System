import bcrypt from 'bcryptjs';

/**
 * 哈希处理密码
 * @param { String } password - 需要进行哈希处理的密码
 * @returns { String } - 返回哈希处理后的密码
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * 比对密码
 * @param { String } password - 需要进行密码比对的密码
 * @param { String } hash - 需要进行密码比对的哈希密码
 * @returns { Boolean } - 返回密码比对结果
 */
export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
