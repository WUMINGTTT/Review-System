import { z } from 'zod';

// 保存评分（自动保存/手动保存）
export const saveRatingSchema = z.object({
  scores: z.array(z.object({
    dimensionId: z.number(),
    score: z.number().min(0, '分数不能为负数'),
  })).optional(),
  comment: z.string().optional(),
});

// 提交评分
export const submitRatingSchema = z.object({
  scores: z.array(z.object({
    dimensionId: z.number(),
    score: z.number().min(0, '分数不能为负数'),
  })).min(1, '请至少填写一个维度的评分'),
  comment: z.string().optional(),
});
