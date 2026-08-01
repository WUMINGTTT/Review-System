import { Request, Response } from 'express';
import { prisma } from '../app';
import { saveRatingSchema, submitRatingSchema } from '../validations/rating';

/**
 * 获取我的待评分列表
 *
 * 查询逻辑：
 * 1. 查找 reviewerId = 当前用户 的 RatingItem
 * 2. 只返回评价状态为 APPROVED 的（已通过审核的评价才能评分）
 * 3. 可选按 evaluationId 筛选
 */
export const getMyRatings = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { evaluationId } = req.query;

    // 构建查询条件
    const where: any = {
      reviewerId: userId,
      evaluation: { status: 'APPROVED' }, // 只有已通过的评价才能评分
    };

    // 可选：按评价活动筛选
    if (evaluationId) {
      where.evaluationId = Number(evaluationId);
    }

    const ratings = await prisma.ratingItem.findMany({
      where,
      include: {
        evaluation: { select: { id: true, title: true, status: true } },
        participant: { select: { id: true, name: true, description: true } },
        dimensionScores: true, // DimensionScore 已包含 dimensionName、maxScore、weight
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ code: 200, data: ratings });
  } catch (error) {
    console.error('获取待评分列表失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};

/**
 * 获取评分详情
 *
 * 包含关联的评价信息、被评价人信息、各维度评分
 */
export const getRatingById = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ratingId = Number(req.params.id);

    const rating = await prisma.ratingItem.findUnique({
      where: { id: ratingId },
      include: {
        evaluation: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            scoreDimensions: true,
          },
        },
        participant: { select: { id: true, name: true, description: true } },
        dimensionScores: true,
        reviewer: { select: { id: true, username: true, realName: true } },
      },
    });

    if (!rating) {
      return res.status(404).json({ code: 404, message: '评分项不存在' });
    }

    // 权限检查：只有评分人本人可以查看
    if (rating.reviewerId !== userId) {
      return res.status(403).json({ code: 403, message: '无权查看此评分项' });
    }

    res.json({ code: 200, data: rating });
  } catch (error) {
    console.error('获取评分详情失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};

/**
 * 保存评分（自动保存/手动保存）
 *
 * 流程：
 * 1. 验证权限和状态
 * 2. 验证分数不超过维度满分
 * 3. 更新或创建 DimensionScore 记录
 * 4. 更新评语
 */
export const saveRating = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ratingId = Number(req.params.id);
    const data = saveRatingSchema.parse(req.body);

    // 查询评分项及其关联的评价维度
    const rating = await prisma.ratingItem.findUnique({
      where: { id: ratingId },
      include: {
        evaluation: { select: { scoreDimensions: true } },
      },
    });

    if (!rating) {
      return res.status(404).json({ code: 404, message: '评分项不存在' });
    }

    // 权限检查：只有评分人本人可以保存
    if (rating.reviewerId !== userId) {
      return res.status(403).json({ code: 403, message: '无权操作此评分项' });
    }

    // 状态检查：已提交的评分不能再修改
    if (rating.status === 'SUBMITTED') {
      return res.status(400).json({ code: 400, message: '评分已提交，无法修改' });
    }

    // 验证分数不超过维度满分
    if (data.scores && data.scores.length > 0) {
      const dimensions = rating.evaluation.scoreDimensions;
      for (const item of data.scores) {
        const dimension = dimensions.find((d) => d.id === item.dimensionId);
        if (!dimension) {
          return res.status(400).json({ code: 400, message: `维度 ${item.dimensionId} 不存在` });
        }
        if (item.score > dimension.maxScore) {
          return res.status(400).json({
            code: 400,
            message: `维度 "${dimension.name}" 的分数不能超过 ${dimension.maxScore}`,
          });
        }
      }
    }

    // 使用事务更新评分
    await prisma.$transaction(async (tx) => {
      // 更新评分项的评语
      await tx.ratingItem.update({
        where: { id: ratingId },
        data: { comment: data.comment },
      });

      // 更新各维度分数
      if (data.scores && data.scores.length > 0) {
        for (const item of data.scores) {
          // 查找对应的维度信息
          const dimension = rating.evaluation.scoreDimensions.find(
            (d) => d.id === item.dimensionId
          );

          if (!dimension) continue;

          // 检查是否已有该维度的评分记录
          const existing = await tx.dimensionScore.findFirst({
            where: {
              ratingItemId: ratingId,
              dimensionId: item.dimensionId,
            },
          });

          if (existing) {
            // 更新已有记录
            await tx.dimensionScore.update({
              where: { id: existing.id },
              data: { score: item.score },
            });
          } else {
            // 创建新记录（需要冗余存储维度信息）
            await tx.dimensionScore.create({
              data: {
                ratingItemId: ratingId,
                dimensionId: item.dimensionId,
                dimensionName: dimension.name,
                score: item.score,
                maxScore: dimension.maxScore,
                weight: dimension.weight,
              },
            });
          }
        }
      }
    });

    // 查询更新后的数据返回
    const updated = await prisma.ratingItem.findUnique({
      where: { id: ratingId },
      include: { dimensionScores: true },
    });

    res.json({ code: 200, message: '保存成功', data: updated });
  } catch (error) {
    console.error('保存评分失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};

/**
 * 提交评分
 *
 * 流程：
 * 1. 验证所有维度都已评分
 * 2. 验证分数不超过维度满分
 * 3. 保存评分并更新状态为 SUBMITTED
 */
export const submitRating = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ratingId = Number(req.params.id);
    const data = submitRatingSchema.parse(req.body);

    // 查询评分项
    const rating = await prisma.ratingItem.findUnique({
      where: { id: ratingId },
      include: {
        evaluation: { select: { scoreDimensions: true } },
      },
    });

    if (!rating) {
      return res.status(404).json({ code: 404, message: '评分项不存在' });
    }

    // 权限检查
    if (rating.reviewerId !== userId) {
      return res.status(403).json({ code: 403, message: '无权操作此评分项' });
    }

    // 状态检查
    if (rating.status === 'SUBMITTED') {
      return res.status(400).json({ code: 400, message: '评分已提交，请勿重复提交' });
    }

    // 验证所有维度都已评分
    const dimensions = rating.evaluation.scoreDimensions;
    const scoredDimensionIds = data.scores.map((s) => s.dimensionId);
    const missingDimensions = dimensions.filter((d) => !scoredDimensionIds.includes(d.id));

    if (missingDimensions.length > 0) {
      return res.status(400).json({
        code: 400,
        message: `以下维度未评分：${missingDimensions.map((d) => d.name).join('、')}`,
      });
    }

    // 验证分数不超过维度满分
    for (const item of data.scores) {
      const dimension = dimensions.find((d) => d.id === item.dimensionId);
      if (dimension && item.score > dimension.maxScore) {
        return res.status(400).json({
          code: 400,
          message: `维度 "${dimension.name}" 的分数不能超过 ${dimension.maxScore}`,
        });
      }
    }

    // 使用事务提交评分
    await prisma.$transaction(async (tx) => {
      // 更新评分项状态
      await tx.ratingItem.update({
        where: { id: ratingId },
        data: {
          status: 'SUBMITTED',
          comment: data.comment,
        },
      });

      // 更新各维度分数
      for (const item of data.scores) {
        const dimension = dimensions.find((d) => d.id === item.dimensionId);
        if (!dimension) continue;

        const existing = await tx.dimensionScore.findFirst({
          where: {
            ratingItemId: ratingId,
            dimensionId: item.dimensionId,
          },
        });

        if (existing) {
          await tx.dimensionScore.update({
            where: { id: existing.id },
            data: { score: item.score },
          });
        } else {
          await tx.dimensionScore.create({
            data: {
              ratingItemId: ratingId,
              dimensionId: item.dimensionId,
              dimensionName: dimension.name,
              score: item.score,
              maxScore: dimension.maxScore,
              weight: dimension.weight,
            },
          });
        }
      }
    });

    // 查询更新后的数据返回
    const updated = await prisma.ratingItem.findUnique({
      where: { id: ratingId },
      include: { dimensionScores: true },
    });

    res.json({ code: 200, message: '提交成功', data: updated });
  } catch (error) {
    console.error('提交评分失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};

/**
 * 检查是否所有被评价人都已评分
 *
 * 返回：
 * - total: 总评分项数量
 * - submitted: 已提交数量
 * - pending: 待评分数量
 * - isComplete: 是否全部完成
 */
export const checkCompletion = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const evaluationId = Number(req.params.evaluationId);

    // 查询该评价下我的所有评分项
    const ratings = await prisma.ratingItem.findMany({
      where: {
        evaluationId,
        reviewerId: userId,
      },
    });

    const total = ratings.length;
    const submitted = ratings.filter((r) => r.status === 'SUBMITTED').length;
    const isComplete = total > 0 && submitted === total;

    res.json({
      code: 200,
      data: {
        total,
        submitted,
        pending: total - submitted,
        isComplete,
      },
    });
  } catch (error) {
    console.error('检查完成状态失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};

/**
 * 获取评价的评分结果列表
 *
 * 可见性规则：
 * - PUBLIC（公开）：所有人可见
 * - PRIVATE（隐藏）：仅创建者、审核者和管理员可见
 *
 * 返回该评价下所有已提交的评分项
 */
export const getRatingsByEvaluationId = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.roles.includes('admin');
    const evaluationId = Number(req.params.evaluationId);

    // 查询评价信息（包含可见性和审核者列表）
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        reviewers: { select: { reviewerId: true } },
      },
    });

    if (!evaluation) {
      return res.status(404).json({ code: 404, message: '评价活动不存在' });
    }

    // 可见性检查：PRIVATE 的评价只有创建者、审核者和管理员可以查看评分结果
    if (evaluation.visibility === 'PRIVATE') {
      const isCreator = evaluation.createdBy === userId;
      const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === userId);

      if (!isCreator && !isReviewer && !isAdmin) {
        return res.status(403).json({
          code: 403,
          message: '该评价的评分结果为隐藏状态，仅创建者、审核者和管理员可查看',
        });
      }
    }

    // 查询该评价下所有已提交的评分项
    const ratings = await prisma.ratingItem.findMany({
      where: {
        evaluationId,
        status: 'SUBMITTED', // 只返回已提交的评分
      },
      include: {
        participant: { select: { id: true, name: true, description: true } },
        reviewer: { select: { id: true, username: true, realName: true } },
        dimensionScores: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ code: 200, data: ratings });
  } catch (error) {
    console.error('获取评分结果失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
};
