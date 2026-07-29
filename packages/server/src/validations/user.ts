import { z } from 'zod';

/**
 * 用户信息更新表单数据验证
 *
 * 设计说明：
 * - 真实姓名、邮箱为可选项，用户可选择更新其中的任意一项
 */
export const updateUserSchema = z.object({
  realName: z.string().min(1, { message: '真实姓名不能为空' }).optional(),
  email: z.email({ message: '邮箱地址无效' }).optional(),
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

