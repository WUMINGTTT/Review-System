import { Request, Response } from 'express';
import { prisma } from '../app';

/**
 * 获取审核列表
 *
 * 查询参数：
 * - status: pending（未审核）/ reviewed（已审核）/ 不传返回全部
 */
export async function getMyReviews(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string;

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

    const reviews = await prisma.evaluation.findMany({
      where: {
        status: statusCondition,
        reviewers: {
          some: { reviewerId: userId },
        },
      },
      include: {
        creator: { select: { id: true, username: true, realName: true } },
        _count: { select: { participants: true, reviewers: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('获取审核列表失败:', error);
    res.status(500).json({ success: false, message: '获取审核列表失败' });
  }
}
