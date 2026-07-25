/**
 * 通知相关类型定义
 *
 * 对应 Prisma 模型: Notification
 *
 * 设计说明:
 * - 当前阶段使用数据库存储 + 轮询方案（前端定时请求未读通知）
 * - 后续接入小程序时，可通过 NotificationService 接口扩展为微信订阅消息
 * - 通知不存储 updatedAt，已读状态通过 isRead 字段标记即可
 * - 通知按 createdAt 倒序排列，最新的在最前面
 */

import { NotificationType } from '../constants/status';

/**
 * 通知消息接口
 *
 * 对应 Prisma 模型: Notification
 * 数据库表名: notification (snake_case)
 */
export interface INotification {
  /** 通知 ID（数据库自增主键） */
  id: number;
  /** 接收人用户 ID（外键 → User 表） */
  userId: number;
  /** 通知类型（见 constants/status.ts 中的 NotificationType 枚举） */
  type: NotificationType;
  /** 通知标题（简短概括，如"您有新的评价任务"） */
  title: string;
  /** 通知正文（详细内容，可包含操作引导） */
  content: string;
  /** 关联实体 ID（可选，如关联的评价活动 ID，用于点击跳转） */
  relatedId?: number;
  /** 是否已读（默认 false） */
  isRead: boolean;
  /** 创建时间（ISO 8601 格式字符串） */
  createdAt: string;
}

/**
 * 通知服务抽象接口
 *
 * 用于解耦通知的发送逻辑，方便后续扩展不同的通知渠道
 *
 * 使用方式:
 *   1. 当前实现: NotificationServiceDatabase — 将通知写入数据库，前端轮询获取
 *   2. 未来扩展: NotificationServiceWeChat — 同时推送微信订阅消息
 *   3. 装饰器模式: 可组合多个实现，如同时写库 + 推微信
 */
export interface INotificationService {
  /**
   * 发送通知
   * @param userId - 接收人用户 ID
   * @param type - 通知类型
   * @param title - 通知标题
   * @param content - 通知正文
   * @param relatedId - 关联实体 ID（可选）
   */
  send(
    userId: number,
    type: NotificationType,
    title: string,
    content: string,
    relatedId?: number
  ): Promise<void>;
}
