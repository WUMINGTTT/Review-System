import { Request, Response } from 'express'; // Express 的请求和响应类型
import { prisma } from '../app'; // Prisma 客户端实例（在 app.ts 中已导出）
import { hashPassword, comparePassword } from '../utils/password'; // 密码工具
import { generateToken } from '../utils/jwt'; // JWT 工具
import { registerSchema, loginSchema, loginByEmailSchema } from '../validations/auth'; // 验证规则

/**
 * 用户注册
 */
export async function register(req: Request, res: Response) {
  // 验证请求体
  const validationResult = registerSchema.safeParse(req.body);
  // 如果验证失败，返回错误响应
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: validationResult.error.issues,
    });
  }

  // 解构验证后的数据（email 为可选字段）
  const { username, password, realName, email } = validationResult.data;

  // 检查用户名是否已存在（如提供邮箱则同时检查邮箱）
  const existingUser = await prisma.user.findFirst({
    where: email ? { OR: [{ username }, { email }] } : { username },
  });
  // 如果用户已存在，返回错误响应
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: email ? '用户名或邮箱已存在' : '用户名已存在',
    });
  }

  // 哈希密码
  const hashedPassword = hashPassword(password);

  // 创建用户
  try {
    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        realName,
        email: email || null, // 没填邮箱则存 null
        roles: JSON.stringify(['user']),
        isActive: true,
      },
    });
    res.json({ success: true, message: '注册成功' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '注册失败',
    });
  }
}

/**
 * 用户名 + 密码登录
 */
export async function login(req: Request, res: Response) {
  // 验证请求体
  const validationResult = loginSchema.safeParse(req.body);
  // 如果验证失败，返回错误响应
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: validationResult.error.issues,
    });
  }

  // 解构验证后的数据
  const { username, password } = validationResult.data;

  // 根据用户名查找用户
  const user = await prisma.user.findUnique({
    where: { username },
  });

  // 用户不存在或密码错误，统一返回"用户名或密码错误"（避免泄露哪个字段不对）
  if (!user || !comparePassword(password, user.password)) {
    return res.status(401).json({
      success: false,
      message: '用户名或密码错误',
    });
  }

  // 检查账号是否被停用
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: '账号已被禁用，请联系管理员',
    });
  }

  // 生成 JWT 令牌
  const token = generateToken({
    id: user.id,
    username: user.username,
    roles: JSON.parse(user.roles),
    tokenVersion: user.tokenVersion,
  });

  // 返回用户信息和令牌
  res.json({
    success: true,
    message: '登录成功',
    data: {
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        roles: JSON.parse(user.roles),
      },
      token,
    },
  });
}

/**
 * 邮箱 + 密码登录
 */
export async function loginByEmail(req: Request, res: Response) {
  // 验证请求体
  const validationResult = loginByEmailSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: validationResult.error.issues,
    });
  }

  // 解构验证后的数据
  const { email, password } = validationResult.data;

  // 根据邮箱查找用户
  const user = await prisma.user.findFirst({
    where: { email },
  });

  // 用户不存在（可能未绑定邮箱）或密码错误
  if (!user || !comparePassword(password, user.password)) {
    return res.status(401).json({
      success: false,
      message: '邮箱或密码错误',
    });
  }

  // 检查账号是否被停用
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: '账号已被禁用，请联系管理员',
    });
  }

  // 生成 JWT 令牌
  const token = generateToken({
    id: user.id,
    username: user.username,
    roles: JSON.parse(user.roles),
    tokenVersion: user.tokenVersion,
  });

  // 返回用户信息和令牌
  res.json({
    success: true,
    message: '登录成功',
    data: {
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        email: user.email,
        roles: JSON.parse(user.roles),
      },
      token,
    },
  });
}
