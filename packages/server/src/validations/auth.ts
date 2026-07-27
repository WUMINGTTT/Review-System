import { z } from 'zod';

/**
 * 注册表单数据验证
 *
 * 设计说明：
 * - 用户名、密码、真实姓名为必填项
 * - 邮箱为可选项，用户可在注册后绑定（用于后续邮箱登录、找回密码等功能）
 */
export const registerSchema = z.object({
  username: z.string().min(3, { message: '用户名长度至少为3个字符' }),
  password: z.string().min(6, { message: '密码必须至少为6个字符' }),
  realName: z.string().min(1, { message: '真实姓名不能为空' }),
  email: z.email({ message: '邮箱地址无效' }).optional(),
});

/**
 * 登录表单数据验证
 *
 * 主登录方式：用户名 + 密码
 * 邮箱登录作为第二方式，在用户绑定邮箱后由 /api/auth/login-by-email 提供
 */
export const loginSchema = z.object({
  username: z.string().min(1, { message: '用户名不能为空' }),
  password: z.string().min(1, { message: '密码不能为空' }),
});

/**
 * 邮箱登录表单数据验证（第二登录方式）
 *
 * 前提：用户已绑定邮箱
 */
export const loginByEmailSchema = z.object({
  email: z.email({ message: '邮箱地址无效' }),
  password: z.string().min(1, { message: '密码不能为空' }),
});
