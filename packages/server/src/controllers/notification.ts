import { Request, Response } from 'express';
import { prisma } from '../app';

/**
 * 获取通知列表
 *
 * 查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 10）
 * - isRead: 筛选已读/未读（可选，不传返回全部）
 */
export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;

    // 构建查询条件
    const where: any = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    // 并行查询通知列表和总数
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      code: 200,
      data: {
        list: notifications,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}

/**
 * 标记单条通知为已读
 *
 * 路由参数：
 * - id: 通知ID
 *
 * 权限检查：只能标记自己的通知
 */
export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const notificationId = Number(req.params.id);

    // 查询通知是否存在且属于当前用户
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ code: 404, message: '通知不存在' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ code: 403, message: '无权操作此通知' });
    }

    // 标记已读
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.json({ code: 200, message: '已标记为已读', data: updated });
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}

/**
 * 标记所有通知为已读
 *
 * 将当前用户所有未读通知标记为已读
 */
export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    // 批量更新所有未读通知
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      code: 200,
      message: '已全部标记为已读',
      data: { count: result.count },
    });
  } catch (error) {
    console.error('标记全部已读失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
}
