import { Request, Response } from 'express';
import { prisma } from '../app';
import {
  createEvaluationSchema,
  updateEvaluationSchema,
  rejectSchema,
  submitRatingsSchema,
} from '../validations/evaluation';

import { createNotification } from '../services/notification'; // 导入通知服务

/**
 * 创建评价
 *
 * 流程：
 * 1. 验证请求参数
 * 2. 开启事务
 *    - 创建 Evaluation 记录
 *    - 创建 Participant 记录（被评价人）
 *    - 创建 ScoreDimension 记录（评分维度）
 *    - 创建 EvaluationReviewer 记录（评审人）
 * 3. 返回创建的评价
 *
 * 为什么用事务？
 * 因为要同时写入 4 张表，任何一步失败都需要回滚，保证数据一致性
 */
export async function createEvaluation(req: Request, res: Response) {
  try {
    // 1. 验证请求参数
    const validationResult = createEvaluationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validationResult.error.issues,
      });
    }

    const { title, description, participants, reviewerIds, scoreDimensions } =
      validationResult.data;

    // 2. 验证评分维度权重之和是否为 100
    const totalWeight = scoreDimensions.reduce((sum, dim) => sum + dim.weight, 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        success: false,
        message: `评分维度权重之和必须为 100，当前为 ${totalWeight}`,
      });
    }

    // 3. 验证评分维度名称不能重复
    const dimNames = scoreDimensions.map((dim) => dim.name);
    const duplicateNames = dimNames.filter((name, index) => dimNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      return res.status(400).json({
        success: false,
        message: `评分维度名称重复：${duplicateNames[0]}`,
      });
    }

    // 4. 验证评审人是否存在
    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
    });
    if (reviewers.length !== reviewerIds.length) {
      return res.status(400).json({
        success: false,
        message: '部分评审人不存在',
      });
    }

    // 4. 使用事务创建评价（所有表的操作要么全部成功，要么全部失败）
    const evaluation = await prisma.$transaction(async (tx) => {
      // 4.1 创建评价主记录
      const newEvaluation = await tx.evaluation.create({
        data: {
          title,
          description,
          visibility: 'PRIVATE', // 固定为私有
          createdBy: req.user!.id, // 从 JWT 中获取当前用户 ID
          status: 'DRAFT', // 初始状态为草稿
        },
      });

      // 4.2 创建被评价人记录
      // createMany 一次插入多条记录，比循环 create 更高效
      await tx.participant.createMany({
        data: participants.map((p) => ({
          evaluationId: newEvaluation.id,
          name: p.name,
          description: p.description,
          phone: p.phone,
        })),
      });

      // 4.3 创建评分维度记录
      await tx.scoreDimension.createMany({
        data: scoreDimensions.map((dim) => ({
          evaluationId: newEvaluation.id,
          name: dim.name,
          description: dim.description,
          maxScore: dim.maxScore,
          weight: dim.weight,
        })),
      });

      // 4.4 创建评审人关联记录（多对多关系的中间表）
      await tx.evaluationReviewer.createMany({
        data: reviewerIds.map((reviewerId) => ({
          evaluationId: newEvaluation.id,
          reviewerId,
        })),
      });

      return newEvaluation;
    });

    // 5. 发送通知给审核者
    for (const reviewerId of reviewerIds) {
      await createNotification(
        reviewerId, // userId
        'ASSIGNED_AS_REVIEWER', // type
        '您被分配为审核者', // title
        `您被分配为评价"${title}"的审核者，请关注`, // content
        evaluation.id, // relatedId
      );
    }

    // 6. 返回创建成功的结果
    res.status(201).json({
      success: true,
      message: '评价创建成功',
      data: { id: evaluation.id },
    });
  } catch (error) {
    console.error('创建评价失败:', error);
    res.status(500).json({ success: false, message: '创建评价失败' });
  }
}

/**
 * 获取评价列表（分页 + 筛选）
 *
 * 查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 10）
 * - keyword: 搜索关键词（模糊匹配标题、描述）
 * - status: 按状态筛选
 * - myOnly: 是否只显示我创建的评价（true/false）
 */
export async function getEvaluations(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const keyword = req.query.keyword as string | undefined;
    const status = req.query.status as string | undefined;
    const myOnly = req.query.myOnly === 'true';

    const userId = req.user!.id;
    const isAdmin = req.user!.roles.includes('admin');

    // 构建筛选条件
    const where: any = {};

    // 按状态筛选
    if (status) {
      where.status = status;
    }

    // 只显示我创建的评价
    if (myOnly) {
      where.createdBy = userId;
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }, { description: { contains: keyword } }];
    }

    // 可见性过滤（评价管理页面）：
    // - 评价管理页面仅展示创建者自己的评价
    // - 审核者通过审核管理页面查看待审核的评价
    // - 管理员始终可见所有评价
    if (!isAdmin) {
      where.createdBy = userId;
    }

    // 并行查询列表和总数
    const [evaluations, total] = await Promise.all([
      prisma.evaluation.findMany({
        where,
        include: {
          // 包含创建者信息（不包含密码）
          creator: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
          // 包含被评价人列表
          participants: {
            select: {
              id: true,
              name: true,
            },
          },
          // 包含评分维度列表
          scoreDimensions: {
            select: {
              id: true,
              name: true,
              weight: true,
              maxScore: true,
            },
          },
          // 包含当前用户的评分记录（仅 DRAFT 状态需要）
          ratingItems: {
            where: { reviewerId: userId },
            select: {
              participantId: true,
              dimensionScores: {
                select: {
                  dimensionId: true,
                  score: true,
                },
              },
            },
          },
          // 包含被评价人数量和评分记录数量
          _count: {
            select: {
              participants: true,
              reviewers: true,
              ratingItems: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.evaluation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        list: evaluations,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('获取评价列表失败:', error);
    res.status(500).json({ success: false, message: '获取评价列表失败' });
  }
}

/**
 * 获取评价详情
 *
 * 包含关联数据：创建者、被评价人、评审人、评分维度
 */
export async function getEvaluationById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user!.roles.includes('admin');

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        // 创建者信息
        creator: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
        // 被评价人列表
        participants: true,
        // 评审人列表（通过中间表）
        reviewers: {
          include: {
            reviewer: {
              select: {
                id: true,
                username: true,
                realName: true,
              },
            },
          },
        },
        // 评分维度列表
        scoreDimensions: true,
        // 评分记录（含维度分数详情）
        ratingItems: {
          include: {
            dimensionScores: true,
          },
        },
      },
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 可见性检查（管理员始终可见）
    if (!isAdmin) {
      const isCreator = evaluation.createdBy === userId;
      const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === userId);

      // DRAFT / REJECTED: 仅创建者可见
      if (
        (evaluation.status === 'DRAFT' || evaluation.status === 'REJECTED') &&
        !isCreator
      ) {
        return res.status(404).json({
          success: false,
          message: '评价不存在',
        });
      }

      // SUBMITTED / APPROVED / ARCHIVED: 创建者 + 评审人可见
      if (!isCreator && !isReviewer) {
        return res.status(404).json({
          success: false,
          message: '评价不存在',
        });
      }
    }

    res.json({ success: true, data: evaluation });
  } catch (error) {
    console.error('获取评价详情失败:', error);
    res.status(500).json({ success: false, message: '获取评价详情失败' });
  }
}

/**
 * 更新评价
 *
 * 权限：只有创建者可以修改
 * 状态限制：DRAFT 和 REJECTED 状态可以修改
 *
 * 特殊逻辑：
 * - 评审人被移除时，发送通知
 * - 评分维度变更时，清空已有评分记录
 * - REJECTED 状态修改后，清除驳回原因，记录修改时间
 */
export async function updateEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 查询评价（包含当前评审人）
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        reviewers: { select: { reviewerId: true } },
      },
    });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 权限检查：只有创建者可以修改
    if (evaluation.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: '只有创建者可以修改评价',
      });
    }

    // 状态检查：DRAFT 和 REJECTED 状态可以修改
    if (evaluation.status !== 'DRAFT' && evaluation.status !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: '只有草稿或已驳回状态的评价可以修改',
      });
    }

    // 验证请求参数
    const validationResult = updateEvaluationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validationResult.error.issues,
      });
    }

    const { title, description, participants, reviewerIds, scoreDimensions } =
      validationResult.data;

    // 如果修改了评分维度，验证权重之和
    if (scoreDimensions) {
      const totalWeight = scoreDimensions.reduce((sum, dim) => sum + dim.weight, 0);
      if (totalWeight !== 100) {
        return res.status(400).json({
          success: false,
          message: `评分维度权重之和必须为 100，当前为 ${totalWeight}`,
        });
      }
    }

    // 计算评审人变更
    const currentReviewerIds = evaluation.reviewers.map((r) => r.reviewerId);
    const removedReviewerIds: number[] = [];
    const addedReviewerIds: number[] = [];

    if (reviewerIds) {
      // 被移除的评审人：在旧列表中但不在新列表中
      removedReviewerIds.push(...currentReviewerIds.filter((rid) => !reviewerIds.includes(rid)));
      // 新增的评审人：在新列表中但不在旧列表中
      addedReviewerIds.push(...reviewerIds.filter((rid) => !currentReviewerIds.includes(rid)));
    }

    // 查询现有的被评价人和评分维度（用于对比变更）
    const existingParticipants = participants
      ? await prisma.participant.findMany({ where: { evaluationId: id } })
      : [];
    const existingDimensions = scoreDimensions
      ? await prisma.scoreDimension.findMany({ where: { evaluationId: id } })
      : [];

    // 使用事务更新评价
    const updatedEvaluation = await prisma.$transaction(async (tx) => {
      // 更新评价主记录
      const updateData: any = {};
      if (title) updateData.title = title;
      if (description !== undefined) updateData.description = description;

      // REJECTED 状态修改后，清除驳回原因，记录修改时间
      if (evaluation.status === 'REJECTED') {
        updateData.rejectReason = null;
        updateData.modifiedAt = new Date();
      }

      const updated = await tx.evaluation.update({
        where: { id },
        data: updateData,
      });

      // 处理被评价人变更
      if (participants) {
        // 按姓名匹配：保留的、新增的、被移除的
        const existingNameMap = new Map(existingParticipants.map((p) => [p.name, p]));
        const newNames = new Set(participants.map((p) => p.name));

        // 被移除的被评价人
        const removedParticipants = existingParticipants.filter((p) => !newNames.has(p.name));
        if (removedParticipants.length > 0) {
          const removedIds = removedParticipants.map((p) => p.id);
          // 删除被移除者的评分记录
          await tx.dimensionScore.deleteMany({
            where: { ratingItem: { participantId: { in: removedIds } } },
          });
          await tx.ratingItem.deleteMany({
            where: { participantId: { in: removedIds } },
          });
          await tx.participant.deleteMany({
            where: { id: { in: removedIds } },
          });
        }

        // 更新保留的被评价人 & 新增被评价人
        for (const p of participants) {
          const existing = existingNameMap.get(p.name);
          if (existing) {
            // 更新已存在的
            await tx.participant.update({
              where: { id: existing.id },
              data: {
                description: p.description,
                phone: p.phone,
              },
            });
          } else {
            // 新增
            await tx.participant.create({
              data: {
                evaluationId: id,
                name: p.name,
                description: p.description,
                phone: p.phone,
              },
            });
          }
        }
      }

      // 处理评分维度变更
      if (scoreDimensions) {
        // 按维度名称匹配
        const existingDimMap = new Map(existingDimensions.map((d) => [d.name, d]));
        const newDimNames = new Set(scoreDimensions.map((d) => d.name));

        // 被移除的维度
        const removedDimensions = existingDimensions.filter((d) => !newDimNames.has(d.name));
        if (removedDimensions.length > 0) {
          const removedDimIds = removedDimensions.map((d) => d.id);
          // 删除被移除维度的评分
          await tx.dimensionScore.deleteMany({
            where: { dimensionId: { in: removedDimIds } },
          });
          await tx.scoreDimension.deleteMany({
            where: { id: { in: removedDimIds } },
          });
        }

        // 检查是否有维度属性变更（权重、满分等）
        let dimensionsChanged = false;
        for (const dim of scoreDimensions) {
          const existing = existingDimMap.get(dim.name);
          if (existing) {
            if (
              existing.weight !== dim.weight ||
              existing.maxScore !== dim.maxScore
            ) {
              dimensionsChanged = true;
              break;
            }
          }
        }

        // 如果维度属性变更，清空所有评分（因为权重变化影响总分计算）
        if (dimensionsChanged) {
          await tx.dimensionScore.deleteMany({
            where: { ratingItem: { evaluationId: id } },
          });
          await tx.ratingItem.deleteMany({ where: { evaluationId: id } });
        }

        // 更新保留的维度 & 新增维度
        for (const dim of scoreDimensions) {
          const existing = existingDimMap.get(dim.name);
          if (existing) {
            await tx.scoreDimension.update({
              where: { id: existing.id },
              data: {
                description: dim.description,
                maxScore: dim.maxScore,
                weight: dim.weight,
              },
            });
          } else {
            await tx.scoreDimension.create({
              data: {
                evaluationId: id,
                name: dim.name,
                description: dim.description,
                maxScore: dim.maxScore,
                weight: dim.weight,
              },
            });
          }
        }
      }

      // 如果提供了评审人，替换原有数据
      if (reviewerIds) {
        await tx.evaluationReviewer.deleteMany({ where: { evaluationId: id } });
        await tx.evaluationReviewer.createMany({
          data: reviewerIds.map((reviewerId) => ({
            evaluationId: id,
            reviewerId,
          })),
        });
      }

      return updated;
    });

    // 事务成功后，给被移除的评审人发送通知
    for (const reviewerId of removedReviewerIds) {
      await createNotification(
        reviewerId,
        'ASSIGNED_AS_REVIEWER',
        '评审资格变更',
        `您已被移出评价"${evaluation.title}"的评审人列表`,
        id,
      );
    }

    // 给新增的评审人发送通知
    for (const reviewerId of addedReviewerIds) {
      await createNotification(
        reviewerId,
        'ASSIGNED_AS_REVIEWER',
        '您被分配为审核者',
        `您被分配为评价"${evaluation.title}"的审核者，请关注`,
        id,
      );
    }

    res.json({
      success: true,
      message: '更新成功',
      data: updatedEvaluation,
    });
  } catch (error) {
    console.error('更新评价失败:', error);
    res.status(500).json({ success: false, message: '更新评价失败' });
  }
}

/**
 * 删除评价
 *
 * 权限：创建者或管理员
 * 状态限制：只有 DRAFT 状态可以删除
 */
export async function deleteEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const evaluation = await prisma.evaluation.findUnique({ where: { id } });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 权限检查：创建者或管理员可以删除
    const isAdmin = req.user!.roles.includes('admin');
    if (evaluation.createdBy !== req.user!.id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权删除此评价',
      });
    }

    // 状态检查：草稿、已通过、已归档状态可以删除
    if (
      evaluation.status !== 'DRAFT' &&
      evaluation.status !== 'APPROVED' &&
      evaluation.status !== 'ARCHIVED'
    ) {
      return res.status(400).json({
        success: false,
        message: '只有草稿、已通过或已归档状态的评价可以删除',
      });
    }

    // 使用事务：先删评分相关记录（因RatingItem未设置级联删除），再删评价
    await prisma.$transaction(async (tx) => {
      // 删除维度评分记录（通过 ratingItem 关联）
      await tx.dimensionScore.deleteMany({
        where: { ratingItem: { evaluationId: id } },
      });
      // 删除评分记录
      await tx.ratingItem.deleteMany({
        where: { evaluationId: id },
      });
      // 删除评价（级联删除被评价人、评审人、评分维度）
      await tx.evaluation.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除评价失败:', error);
    res.status(500).json({ success: false, message: '删除评价失败' });
  }
}

/**
 * 提交评价
 *
 * 状态流转：DRAFT → SUBMITTED 或 REJECTED → SUBMITTED
 * 权限：只有创建者可以提交
 */
export async function submitEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const evaluation = await prisma.evaluation.findUnique({ where: { id } });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 权限检查
    if (evaluation.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: '只有创建者可以提交评价',
      });
    }

    // 状态检查：只有草稿或被打回的评价可以提交
    if (evaluation.status !== 'DRAFT' && evaluation.status !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: '只有草稿或被打回的评价可以提交',
      });
    }

    // 驳回后重新提交：清除 rejectReason 和 modifiedAt
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        rejectReason: null,
        modifiedAt: null,
      },
    });

    // 查询审核者列表，发送通知
    const reviewers = await prisma.evaluationReviewer.findMany({
      where: { evaluationId: id },
      select: { reviewerId: true },
    });

    for (const reviewer of reviewers) {
      await createNotification(
        reviewer.reviewerId, // userId
        'EVALUATION_SUBMITTED', // type
        '您有新的评价待审核', // title
        `评价"${evaluation.title}"已提交，请及时审核`, // content
        evaluation.id, // relatedId
      );
    }

    res.json({
      success: true,
      message: '提交成功',
      data: updated,
    });
  } catch (error) {
    console.error('提交评价失败:', error);
    res.status(500).json({ success: false, message: '提交评价失败' });
  }
}

/**
 * 审核通过
 *
 * 状态流转：SUBMITTED → APPROVED
 * 权限：只有评审人可以审核
 */
export async function approveEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: { reviewers: true },
    });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 状态检查
    if (evaluation.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: '只有已提交的评价可以审核',
      });
    }

    // 权限检查：必须是评审人
    const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === req.user!.id);
    if (!isReviewer) {
      return res.status(403).json({
        success: false,
        message: '只有评审人可以审核此评价',
      });
    }

    // 更新状态为已通过，清除 modifiedAt
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        modifiedAt: null,
      },
    });

    // 发送通知给创建者
    await createNotification(
      evaluation.createdBy,
      'EVALUATION_APPROVED',
      '您的评价已通过审核',
      `评价"${evaluation.title}"已通过审核`,
      evaluation.id,
    );

    res.json({
      success: true,
      message: '审核通过',
      data: updated,
    });
  } catch (error) {
    console.error('审核评价失败:', error);
    res.status(500).json({ success: false, message: '审核评价失败' });
  }
}

/**
 * 审核打回
 *
 * 状态流转：SUBMITTED → REJECTED
 * 权限：只有评审人可以审核
 * 要求：必须填写打回原因
 */
export async function rejectEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 验证打回原因
    const validationResult = rejectSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validationResult.error.issues,
      });
    }

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: { reviewers: true },
    });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 状态检查
    if (evaluation.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: '只有已提交的评价可以审核',
      });
    }

    // 权限检查：必须是评审人
    const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === req.user!.id);
    if (!isReviewer) {
      return res.status(403).json({
        success: false,
        message: '只有评审人可以审核此评价',
      });
    }

    // 打回时清除 modifiedAt，确保新一轮驳回需要重新修改
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: validationResult.data.rejectReason,
        reviewedAt: new Date(),
        modifiedAt: null,
      },
    });

    // 发送通知给创建者
    await createNotification(
      evaluation.createdBy,
      'EVALUATION_REJECTED',
      '您的评价已被驳回',
      `评价"${evaluation.title}"已被驳回，原因：${validationResult.data.rejectReason}`,
      evaluation.id,
    );

    res.json({
      success: true,
      message: '已打回',
      data: updated,
    });
  } catch (error) {
    console.error('审核评价失败:', error);
    res.status(500).json({ success: false, message: '审核评价失败' });
  }
}

/**
 * 管理员删除评价（无状态限制）
 *
 * 权限：仅管理员
 * 与普通 deleteEvaluation 不同，管理员可以删除任何状态的评价
 */
export async function adminDeleteEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const evaluation = await prisma.evaluation.findUnique({ where: { id } });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 使用事务：先删评分相关记录（因RatingItem未设置级联删除），再删评价
    await prisma.$transaction(async (tx) => {
      // 删除维度评分记录（通过 ratingItem 关联）
      await tx.dimensionScore.deleteMany({
        where: { ratingItem: { evaluationId: id } },
      });
      // 删除评分记录
      await tx.ratingItem.deleteMany({
        where: { evaluationId: id },
      });
      // 删除评价（级联删除被评价人、评审人、评分维度）
      await tx.evaluation.delete({ where: { id } });
    });

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('管理员删除评价失败:', error);
    res.status(500).json({ success: false, message: '删除评价失败' });
  }
}

/**
 * 归档评价
 *
 * 状态流转：APPROVED → ARCHIVED
 * 权限：评审人或管理员
 */
export async function archiveEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: { reviewers: true },
    });
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 状态检查
    if (evaluation.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: '只有已通过的评价可以归档',
      });
    }

    // 权限检查：评审人或管理员
    const isReviewer = evaluation.reviewers.some((r) => r.reviewerId === req.user!.id);
    const isAdmin = req.user!.roles.includes('admin');
    if (!isReviewer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权归档此评价',
      });
    }

    // 更新状态为已归档
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    // 发送通知给创建者
    await createNotification(
      evaluation.createdBy, // userId
      'EVALUATION_ARCHIVED', // type
      '您的评价已归档', // title
      `评价"${evaluation.title}"已归档`, // content
      evaluation.id, // relatedId
    );

    res.json({
      success: true,
      message: '归档成功',
      data: updated,
    });
  } catch (error) {
    console.error('归档评价失败:', error);
    res.status(500).json({ success: false, message: '归档评价失败' });
  }
}

/**
 * 提交评分（创建者为被评价人打分）
 *
 * 流程：
 * 1. 验证评价存在且为 DRAFT 状态
 * 2. 验证当前用户是创建者
 * 3. 删除已有评分记录（如果有）
 * 4. 为每个被评价人创建 RatingItem + DimensionScore
 *
 * 请求体：
 * {
 *   ratings: [
 *     { participantId: 1, scores: [{ dimensionId: 1, score: 85 }, ...], comment: '...' },
 *     ...
 *   ]
 * }
 */
export async function submitRatings(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 验证请求参数
    const validationResult = submitRatingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validationResult.error.issues,
      });
    }

    const { ratings } = validationResult.data;

    // 验证评价存在
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        participants: true,
        scoreDimensions: true,
      },
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
    }

    // 权限检查：只有创建者可以评分
    if (evaluation.createdBy !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: '只有创建者可以评分',
      });
    }

    // 状态检查：草稿或已驳回状态可以评分
    if (evaluation.status !== 'DRAFT' && evaluation.status !== 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: '只有草稿或已驳回状态的评价可以评分',
      });
    }

    // 验证评分数据
    if (!Array.isArray(ratings) || ratings.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供评分数据',
      });
    }

    // 使用事务处理评分
    await prisma.$transaction(async (tx) => {
      // 删除该评价下当前用户已有的评分记录
      await tx.dimensionScore.deleteMany({
        where: {
          ratingItem: {
            evaluationId: id,
            reviewerId: req.user!.id,
          },
        },
      });
      await tx.ratingItem.deleteMany({
        where: {
          evaluationId: id,
          reviewerId: req.user!.id,
        },
      });

      // 为传入的被评价人创建评分记录
      for (const rating of ratings) {
        const participant = evaluation.participants.find((p) => p.id === rating.participantId);
        if (!participant) continue;

        // 判断该被评价人的评分是否完整（所有维度都有分数）
        const allDimensionsScored = evaluation.scoreDimensions.every((d) =>
          rating.scores.some((s) => s.dimensionId === d.id && s.score > 0 && s.score <= d.maxScore),
        );

        // 创建 RatingItem，完整的设为 SUBMITTED，不完整的设为 DRAFT
        const ratingItem = await tx.ratingItem.create({
          data: {
            evaluationId: id,
            participantId: rating.participantId,
            reviewerId: req.user!.id,
            status: allDimensionsScored ? 'SUBMITTED' : 'DRAFT',
            comment: rating.comment,
          },
        });

        // 创建各维度的 DimensionScore
        for (const scoreData of rating.scores) {
          const dimension = evaluation.scoreDimensions.find((d) => d.id === scoreData.dimensionId);
          if (!dimension) continue;

          // 验证分数不超过满分
          if (scoreData.score > dimension.maxScore) {
            throw new Error(
              `被评价人"${participant.name}"的"${dimension.name}"评分不能超过 ${dimension.maxScore}`,
            );
          }

          await tx.dimensionScore.create({
            data: {
              ratingItemId: ratingItem.id,
              dimensionId: dimension.id,
              dimensionName: dimension.name,
              score: scoreData.score,
              maxScore: dimension.maxScore,
              weight: dimension.weight,
            },
          });
        }
      }

      // 如果是已驳回状态下的修改评分，更新 modifiedAt
      if (evaluation.status === 'REJECTED') {
        await tx.evaluation.update({
          where: { id },
          data: { modifiedAt: new Date() },
        });
      }
    });

    res.json({
      success: true,
      message: '评分提交成功',
    });
  } catch (error: any) {
    console.error('提交评分失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '提交评分失败',
    });
  }
}
