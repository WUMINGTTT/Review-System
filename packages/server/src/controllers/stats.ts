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
 * - pendingCount: 待审核数（我创建的、状态为 SUBMITTED）
 * - approvedCount: 已通过数（仅创建者可见，管理员可见全部）
 * - rejectedCount: 已打回数（仅创建者可见，管理员可见全部）
 * - archivedCount: 已归档数（仅创建者可见，管理员可见全部）
 *
 * 使用 Promise.all 并行查询 5 个统计
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.roles.includes('admin');

    // 并行查询 5 个统计数据
    const [draftCount, pendingCount, approvedCount, rejectedCount, archivedCount] =
      await Promise.all([
        // 我的草稿：我创建的、状态为 DRAFT
        prisma.evaluation.count({
          where: { createdBy: userId, status: 'DRAFT' },
        }),

        // 待审核：我创建的、状态为 SUBMITTED
        prisma.evaluation.count({
          where: { createdBy: userId, status: 'SUBMITTED' },
        }),

        // 已通过：仅创建者可见（评价管理页面规则）
        isAdmin
          ? prisma.evaluation.count({ where: { status: 'APPROVED' } })
          : prisma.evaluation.count({
              where: { status: 'APPROVED', createdBy: userId },
            }),

        // 已打回：仅创建者可见
        isAdmin
          ? prisma.evaluation.count({ where: { status: 'REJECTED' } })
          : prisma.evaluation.count({
              where: { status: 'REJECTED', createdBy: userId },
            }),

        // 已归档：仅创建者可见
        isAdmin
          ? prisma.evaluation.count({ where: { status: 'ARCHIVED' } })
          : prisma.evaluation.count({
              where: { status: 'ARCHIVED', createdBy: userId },
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
