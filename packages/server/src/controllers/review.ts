import { Request, Response } from 'express';
import { prisma } from '../app';

/**
 * 获取审核列表（分页）
 *
 * 查询参数：
 * - status: pending（未审核）/ reviewed（已审核）/ 不传返回全部
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 10）
 */
export async function getMyReviews(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));

    // 根据筛选参数构建状态条件
    let statusCondition: any;
    if (status === 'pending') {
      statusCondition = 'SUBMITTED';
    } else if (status === 'reviewed') {
      statusCondition = { in: ['APPROVED', 'ARCHIVED'] };
    } else {
      // 不传参数返回全部
      statusCondition = { in: ['SUBMITTED', 'APPROVED', 'ARCHIVED'] };
    }

    const where = {
      status: statusCondition,
      reviewers: {
        some: { reviewerId: userId },
      },
    };

    // 并行查询列表和总数
    const [reviews, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        include: {
          creator: { select: { id: true, username: true, realName: true } },
          _count: { select: { participants: true, reviewers: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.evaluation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        list: reviews,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('获取审核列表失败:', error);
    res.status(500).json({ success: false, message: '获取审核列表失败' });
  }
}
