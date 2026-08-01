import { Request, Response } from 'express';
import { prisma } from '../app';
import {
  createEvaluationSchema,
  updateEvaluationSchema,
  rejectSchema,
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

    const { title, description, visibility, participants, reviewerIds, scoreDimensions } =
      validationResult.data;

    // 2. 验证评分维度权重之和是否为 100
    const totalWeight = scoreDimensions.reduce((sum, dim) => sum + dim.weight, 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        success: false,
        message: `评分维度权重之和必须为 100，当前为 ${totalWeight}`,
      });
    }

    // 3. 验证评审人是否存在
    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
    });
    if (reviewers.length !== reviewerIds.length) {
      return res.status(400).json({
        success: false,
        message: '部分评审人不存在',
      });
    }

    // 4. 使用事务创建评价（4 张表的操作要么全部成功，要么全部失败）
    const evaluation = await prisma.$transaction(async (tx) => {
      // 4.1 创建评价主记录
      const newEvaluation = await tx.evaluation.create({
        data: {
          title,
          description,
          visibility,  // 评分可见性：PUBLIC（公开）或 PRIVATE（隐藏）
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
        reviewerId,                              // userId
        'ASSIGNED_AS_REVIEWER',                  // type
        '您被分配为审核者',                        // title
        `您被分配为评价"${title}"的审核者，请关注`, // content
        evaluation.id                            // relatedId
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

    // 构建筛选条件
    const where: any = {};

    // 按状态筛选
    if (status) {
      where.status = status;
    }

    // 只显示我创建的评价
    if (myOnly) {
      where.createdBy = req.user!.id;
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [{ title: { contains: keyword } }, { description: { contains: keyword } }];
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
          // 包含被评价人数量
          _count: {
            select: {
              participants: true,
              reviewers: true,
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
      },
    });

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评价不存在',
      });
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
 * 状态限制：只有 DRAFT 状态可以修改
 */
export async function updateEvaluation(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 查询评价
    const evaluation = await prisma.evaluation.findUnique({ where: { id } });
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

    // 状态检查：只有草稿状态可以修改
    if (evaluation.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '只有草稿状态的评价可以修改',
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

    // 使用事务更新评价
    const updatedEvaluation = await prisma.$transaction(async (tx) => {
      // 更新评价主记录
      const updated = await tx.evaluation.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description && { description }),
        },
      });

      // 如果提供了被评价人，替换原有数据
      if (participants) {
        // 先删除原有被评价人
        await tx.participant.deleteMany({ where: { evaluationId: id } });
        // 再创建新的
        await tx.participant.createMany({
          data: participants.map((p) => ({
            evaluationId: id,
            name: p.name,
            description: p.description,
            phone: p.phone,
          })),
        });
      }

      // 如果提供了评分维度，替换原有数据
      if (scoreDimensions) {
        await tx.scoreDimension.deleteMany({ where: { evaluationId: id } });
        await tx.scoreDimension.createMany({
          data: scoreDimensions.map((dim) => ({
            evaluationId: id,
            name: dim.name,
            description: dim.description,
            maxScore: dim.maxScore,
            weight: dim.weight,
          })),
        });
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

    // 状态检查：只有草稿状态可以删除
    if (evaluation.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: '只有草稿状态的评价可以删除',
      });
    }

    // 删除评价（级联删除会自动删除关联的被评价人、评审人、评分维度）
    await prisma.evaluation.delete({ where: { id } });

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

    // 更新状态为已提交
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // 查询审核者列表，发送通知
    const reviewers = await prisma.evaluationReviewer.findMany({
      where: { evaluationId: id },
      select: { reviewerId: true },
    });

    for (const reviewer of reviewers) {
      await createNotification(
        reviewer.reviewerId,                          // userId
        'EVALUATION_SUBMITTED',                       // type
        '您有新的评价待审核',                           // title
        `评价"${evaluation.title}"已提交，请及时审核`, // content
        evaluation.id                                 // relatedId
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

    // 更新状态为已通过
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

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

    // 更新状态为已打回
    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: validationResult.data.rejectReason,
        reviewedAt: new Date(),
      },
    });

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
      evaluation.createdBy,           // userId
      'EVALUATION_ARCHIVED',          // type
      '您的评价已归档',                 // title
      `评价"${evaluation.title}"已归档`, // content
      evaluation.id                   // relatedId
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
