/**
 * 通用 API 响应类型定义
 *
 * 所有后端接口统一返回格式，确保前端可以一致地处理响应
 *
 * 统一格式示例:
 *   成功: { success: true,  message: "操作成功", data: { ... } }
 *   失败: { success: false, message: "参数错误", errors: { field: ["错误信息"] } }
 *
 * 前端使用:
 *   const res = await api.get<ApiResponse<IUser[]>>('/users')
 *   if (res.data.success) { ... }
 */

/**
 * 通用响应结构
 *
 * @typeParam T - 响应数据的具体类型
 *
 * @example
 * // 获取单个用户
 * const res: ApiResponse<IUser> = { success: true, message: "ok", data: user }
 *
 * @example
 * // 获取用户列表
 * const res: ApiResponse<IUser[]> = { success: true, message: "ok", data: [user1, user2] }
 */
export interface ApiResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应消息（成功或失败的描述信息） */
  message: string;
  /** 响应数据（失败时可能为 null） */
  data: T;
}

/**
 * 分页响应结构
 *
 * 用于列表查询接口，支持前端分页展示
 *
 * @typeParam T - 列表元素的具体类型
 *
 * @example
 * // 请求: GET /evaluations?page=1&pageSize=10
 * // 响应:
 * {
 *   success: true,
 *   message: "ok",
 *   data: {
 *     list: [...],       // 当前页数据（最多 10 条）
 *     total: 56,         // 总记录数
 *     page: 1,           // 当前页码（从 1 开始）
 *     pageSize: 10       // 每页条数
 *   }
 * }
 *
 * 前端配合 Element Plus 分页组件使用:
 *   <el-pagination :total="data.total" :page-size="data.pageSize" v-model:current-page="data.page" />
 */
export interface PaginatedResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应消息 */
  message: string;
  /** 分页数据 */
  data: {
    /** 当前页数据列表 */
    list: T[];
    /** 符合条件的总记录数 */
    total: number;
    /** 当前页码（从 1 开始） */
    page: number;
    /** 每页条数 */
    pageSize: number;
  };
}

/**
 * 错误响应结构
 *
 * 用于参数校验失败、权限不足等错误场景
 *
 * @example
 * // 参数校验失败
 * {
 *   success: false,
 *   message: "参数校验失败",
 *   errors: {
 *     title: ["标题不能为空", "标题长度不能超过100字"],
 *     reviewerIds: ["至少选择一名评审人"]
 *   }
 * }
 *
 * @example
 * // 权限不足
 * { success: false, message: "无权限执行此操作" }
 */
export interface ApiError {
  /** 固定为 false */
  success: false;
  /** 错误描述消息 */
  message: string;
  /**
   * 字段级错误详情（可选）
   * key 为字段名，value 为该字段的错误信息列表
   * 前端可用于表单校验回显
   */
  errors?: Record<string, string[]>;
}

/**
 * 分页查询通用参数
 *
 * 所有列表接口的查询参数中都应包含分页字段
 *
 * @example
 * // GET /evaluations?page=2&pageSize=20&keyword=季度
 */
export interface PaginationParams {
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（默认 10） */
  pageSize?: number;
}

/**
 * JWT Token 载荷结构
 *
 * 登录成功后签发 JWT，Token 中包含的用户信息
 * 后端通过 auth 中间件解析 Token 获取此结构
 *
 * @example
 * // 签发: jwt.sign({ id: 1, username: 'admin', roles: ['admin'] }, secret)
 * // 解析: const payload = jwt.verify(token, secret) as JwtPayload
 */
export interface JwtPayload {
  /** 用户 ID */
  id: number;
  /** 用户名 */
  username: string;
  /**
   * 用户角色列表
   * 当前仅支持: 'user' | 'admin'
   * 注意: 组织者/评审者身份不在此处，而是在具体评价活动中体现
   */
  roles: string[];
  /** Token 版本号，用于强制其他用户重新登录 */
  tokenVersion: number;
}
