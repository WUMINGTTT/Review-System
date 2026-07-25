/**
 * 用户相关类型定义
 *
 * 对应 Prisma 模型: User
 * 数据库表名: user (snake_case)
 *
 * 设计说明:
 * - id 使用自增整数 (Prisma autoincrement)，前端统一用 number 类型
 * - 用户仅区分 admin（管理员）和 user（普通用户）两种固定角色
 * - 组织者/评审者是用户在某次评价活动中的临时身份，由评价活动的字段决定，
 *   而非用户本身的固定属性。同一用户在不同评价中可以是组织者也可以是评审者
 * - roles 存储为 JSON 字符串，Prisma 通过 @default("[]") 提供默认值
 * - 前端解析 roles 时需要 JSON.parse()，注意做异常兜底
 * - isActive 用于软停用，停用后用户无法登录但仍保留数据关联
 */

/**
 * 用户角色枚举
 *
 * 仅区分系统级的固定角色，组织者和评审者是评价活动中的临时身份，
 * 不作为用户的角色属性存储
 *
 * 设计决策:
 *   早期方案: 用户自带 organizer / reviewer / admin 三种角色
 *   当前方案: 用户仅分 admin 和 user，组织者/评审者身份绑定到具体评价活动
 *   原因: 同一用户可能在评价 A 中是组织者，在评价 B 中是评审者，
 *         角色应跟随评价活动而非用户本身
 */
export enum UserRole {
  /** 普通用户 - 可以作为组织者创建评价，也可以作为评审者参与评分 */
  USER = 'user',
  /** 管理员 - 拥有系统管理权限（审核评价、用户管理等） */
  ADMIN = 'admin',
}

/** 用户信息接口 */
export interface IUser {
  /** 用户 ID（数据库自增主键） */
  id: number;
  /** 登录用户名（唯一） */
  username: string;
  /** 真实姓名 */
  realName: string;
  /** 所属部门（可选，用户可能尚未填写或不属于任何部门） */
  department?: string;
  /**
   * 邮箱地址（可选，优先级高于电话）
   *
   * 后续规划:
   * - 绑定邮箱用于接收验证码
   * - 邮箱注册登录（免密码）
   * - 找回账号/重置密码
   */
  email?: string;
  /** 联系电话（可选） */
  phone?: string;
  /** 头像 URL（可选，存储相对路径） */
  avatar?: string;
  /**
   * 用户角色列表（数据库中以 JSON 字符串存储）
   * 当前仅支持: 'user' | 'admin'
   * 组织者/评审者身份不在这里，而是在 Evaluation 表中体现
   */
  roles: UserRole[];
  /** 账号是否启用（false 表示已停用） */
  isActive: boolean;
  /** 创建时间（ISO 8601 格式字符串） */
  createdAt: string;
  /** 更新时间（ISO 8601 格式字符串） */
  updatedAt: string;
}

/** 登录请求参数 */
export interface LoginRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
}

/** 登录响应数据 */
export interface LoginResponse {
  /** 用户信息 */
  user: IUser;
  /** JWT Token 字符串 */
  token: string;
}

/** 注册请求参数 */
export interface RegisterRequest {
  /** 用户名（唯一） */
  username: string;
  /** 密码 */
  password: string;
  /** 真实姓名 */
  realName: string;
  /** 所属部门（可选） */
  department?: string;
  /** 邮箱地址（可选，后续用于找回密码等功能） */
  email?: string;
  /** 联系电话（可选） */
  phone?: string;
}
