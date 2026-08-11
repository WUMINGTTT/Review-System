import { z } from 'zod';

/**
 * 邮箱验证：允许空字符串或有效邮箱
 */
const emailField = z.union([
  z.literal(''),
  z.string().email({ message: '邮箱地址无效' }),
]).optional();

/**
 * 管理员创建用户验证
 */
export const createUserSchema = z.object({
  username: z.string().min(3, { message: '用户名长度至少为3个字符' }),
  password: z.string().min(6, { message: '密码必须至少为6个字符' }),
  realName: z.string().min(1, { message: '真实姓名不能为空' }),
  email: emailField,
  roles: z.array(z.enum(['user', 'admin'])).optional(),
});

/**
 * 用户信息更新表单数据验证
 *
 * 设计说明：
 * - 真实姓名、邮箱为可选项，用户可选择更新其中的任意一项
 */
export const updateUserSchema = z.object({
  realName: z.string().min(1, { message: '真实姓名不能为空' }).optional(),
  email: emailField,
});

/**
 * 管理员更新用户信息表单数据验证
 *
 * 设计说明：
 * - 角色、是否激活为可选项，用户可选择更新其中的任意一项
 */
export const adminUpdateUserSchema = updateUserSchema.extend({
  roles: z.array(z.enum(['user', 'admin'])).optional(),
  isActive: z.boolean().optional(),
});

/**
 * 修改密码表单数据验证
 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, { message: '请输入旧密码' }),
  newPassword: z.string().min(6, { message: '新密码必须至少为6个字符' }),
  confirmPassword: z.string().min(1, { message: '请确认新密码' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

