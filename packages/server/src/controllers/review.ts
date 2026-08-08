import { Request, Response } from 'express';
import { prisma } from '../app';

/**
 * 获取待审核列表
 */
export async function getMyReviews(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const reviews = await prisma.evaluation.findMany({
      where: {
        status: 'SUBMITTED',
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
    console.error('获取待审核列表失败:', error);
    res.status(500).json({ success: false, message: '获取待审核列表失败' });
  }
}
