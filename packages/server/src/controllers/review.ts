import { Request, Response } from 'express';
import { prisma } from '../app';
import { rejectSchema } from '../validations/evaluation';

/**
 * 获取待审核列表
 */
export async function getMyReviews(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const reviews = await prisma.evaluation.findMany({
      where: {
        status: 'SUBMITTED', // 只查询已提交的评价
        reviewers: {
          some: { reviewerId: userId }, // 当前用户是审核者
        },
      },
      include: {
        creator: { select: { id: true, username: true, realName: true } },
        _count: { select: { participants: true, reviewers: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json({ code: 200, data: reviews });
  } catch (error) {
    console.error('获取待审核列表失败:', error);
    res.status(500).json({ code: 500, message: '获取待审核列表失败' });
  }
}

/**
 * 审核通过
 *
 * 流程：
 * 1. 查询评价，检查状态是否为 SUBMITTED
 * 2. 检查当前用户是否是审核者
 * 3. 更新状态为 APPROVED，清空驳回原因
 */
export async function approveReview(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const evaluationId = Number(req.params.id);

    // 1. 查询评价，包含审核者列表
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { reviewers: { select: { reviewerId: true } } },
    });

    if (!evaluation) {
      return res.status(404).json({ code: 404, message: '评价活动不存在' });
    }

    // 2. 检查状态是否为 SUBMITTED
    if (evaluation.status !== 'SUBMITTED') {
      return res.status(400).json({ code: 400, message: '只有已提交的评价可以审核' });
    }

    // 3. 检查当前用户是否是审核者
    const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === userId);
    if (!isReviewer) {
      return res.status(403).json({ code: 403, message: '您不是该评价的审核者' });
    }

    // 4. 更新状态为 APPROVED，清空驳回原因
    const updated = await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: 'APPROVED',
        rejectReason: null, // 清空之前的驳回原因（如果有）
      },
    });

    res.json({ code: 200, message: '已通过', data: updated });
  } catch (error) {
    console.error('审核通过失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}

/**
 * 审核驳回
 */
export async function rejectReview(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const evaluationId = Number(req.params.id);
    const { rejectReason } = rejectSchema.parse(req.body); // 获取审核驳回原因

    if (!rejectReason) {
      return res.status(400).json({ code: 400, message: '请填写驳回原因' });
    }

    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { reviewers: { select: { reviewerId: true } } },
    });

    if (!evaluation) {
      return res.status(404).json({ code: 404, message: '评价活动不存在' });
    }

    if (evaluation.status !== 'SUBMITTED') {
      return res.status(400).json({ code: 400, message: '只有已提交的评价可以审核' });
    }
    // 3. 检查当前用户是否是审核者
    const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === userId);
    if (!isReviewer) {
      return res.status(403).json({ code: 403, message: '您不是该评价的审核者' });
    }

    const updated = await prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: 'REJECTED',
        rejectReason: rejectReason,
      },
    });

    res.json({ code: 200, message: '已驳回', data: updated });
  } catch (error) {
    console.error('审核驳回失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}
