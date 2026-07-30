import { Request, Response } from 'express';
import { prisma } from '../app';

/**
 * 统计控制器
 * 提供工作台需要的统计数据
 */

/**
 * 获取工作台统计数据
 *
 * 返回：
 * - draftCount: 我的草稿数（我创建的、状态为 DRAFT）
 * - pendingCount: 待我审核数（我是评审人、状态为 SUBMITTED）
 * - approvedCount: 已通过数
 * - rejectedCount: 已打回数
 * - archivedCount: 已归档数
 *
 * 使用 Promise.all 并行查询 5 个统计
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // 并行查询 5 个统计数据
    const [draftCount, pendingCount, approvedCount, rejectedCount, archivedCount] =
      await Promise.all([
        // 我的草稿：我创建的、状态为 DRAFT
        prisma.evaluation.count({
          where: {
            createdBy: userId,
            status: 'DRAFT',
          },
        }),

        // 待我审核：状态为 SUBMITTED、我是评审人
        // reviewers.some 表示 EvaluationReviewer 表中至少有一条记录的 reviewerId 等于当前用户
        prisma.evaluation.count({
          where: {
            status: 'SUBMITTED',
            reviewers: {
              some: {
                reviewerId: userId,
              },
            },
          },
        }),

        // 已通过
        prisma.evaluation.count({
          where: { status: 'APPROVED' },
        }),

        // 已打回
        prisma.evaluation.count({
          where: { status: 'REJECTED' },
        }),

        // 已归档
        prisma.evaluation.count({
          where: { status: 'ARCHIVED' },
        }),
      ]);

    res.json({
      success: true,
      data: {
        draftCount,
        pendingCount,
        approvedCount,
        rejectedCount,
        archivedCount,
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
}

