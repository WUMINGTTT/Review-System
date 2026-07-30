import { z } from 'zod';

/**
 * 创建评价表单数据验证
 * 需要验证的字段：
 */
export const createEvaluationSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string().min(1, '描述不能为空'),
  participants: z
    .array(
      z.object({
        name: z.string().min(1, '姓名不能为空'),
        description: z.string().optional(),
        phone: z.string().optional(),
      }),
    )
    .min(1, '至少添加一个被评价人'),
  reviewerIds: z.array(z.number()).min(1, '请选择审核人员'),
  scoreDimensions: z
    .array(
      z.object({
        name: z.string().min(1, '维度名称不能为空'),
        description: z.string().optional(),
        maxScore: z.number().min(1, '满分必须大于0').default(100),
        weight: z.number().min(0).max(100, '权重必须在0-100之间'),
      }),
    )
    .min(1, '至少添加一个评分维度'),
});

/**
 * 更新评价表单数据验证
 * 所有字段可选（partial），只更新传入的字段
 */
export const updateEvaluationSchema = createEvaluationSchema.partial();

/**
 * 审核打回验证
 * 打回时必须填写原因
 */
export const rejectSchema = z.object({
  rejectReason: z.string().min(1, '打回原因不能为空'),
});
