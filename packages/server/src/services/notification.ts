import { prisma } from '../app';
import { NotificationType } from '@prisma/client';

/**
 * 创建通知
 *
 * @param userId - 接收通知的用户ID
 * @param type - 通知类型
 * @param title - 通知标题
 * @param content - 通知内容
 * @param relatedId - 关联的业务ID（可选，用于跳转）
 * @returns 创建的通知记录
 */
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  content: string,
  relatedId?: number,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      content,
      relatedId,
    },
  });
}
