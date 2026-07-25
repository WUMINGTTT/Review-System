/**
 * 通知相关类型定义
 */

import { NotificationType } from '../constants/status';

/** 通知 */
export interface INotification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: number;
  isRead: boolean;
  createdAt: string;
}

/** 通知查询参数 */
export interface INotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
}
