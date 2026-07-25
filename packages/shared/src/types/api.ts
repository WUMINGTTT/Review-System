/**
 * 通用 API 响应类型定义
 */

/** 通用响应结构 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

/** 分页响应结构 */
export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

/** 错误响应结构 */
export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}
