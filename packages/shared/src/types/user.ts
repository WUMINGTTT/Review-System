/**
 * 用户相关类型定义
 */

/** 用户角色 */
export type UserRole = 'organizer' | 'reviewer' | 'admin';

/** 用户状态 */
export type UserStatus = 'active' | 'disabled';

/** 用户信息 */
export interface IUser {
  id: number;
  username: string;
  realName: string;
  department: string;
  phone?: string;
  avatar?: string;
  roles: UserRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 登录请求参数 */
export interface ILoginParams {
  username: string;
  password: string;
}

/** 注册请求参数 */
export interface IRegisterParams {
  username: string;
  password: string;
  realName: string;
  department: string;
  phone?: string;
  roles?: UserRole[];
}

/** 登录响应数据 */
export interface ILoginResult {
  token: string;
  user: IUser;
}

/** 更新用户参数（管理员） */
export interface IUpdateUserParams {
  realName?: string;
  department?: string;
  phone?: string;
  roles?: UserRole[];
  isActive?: boolean;
}

/** 更新个人信息参数 */
export interface IUpdateProfileParams {
  realName?: string;
  department?: string;
  phone?: string;
  avatar?: string;
}

/** 用户列表查询参数 */
export interface IUserQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  role?: UserRole;
  department?: string;
  isActive?: boolean;
}
