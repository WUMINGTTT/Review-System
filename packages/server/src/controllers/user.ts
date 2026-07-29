import { Request, Response } from 'express';
import { prisma } from '../app';
import { updateUserSchema, adminUpdateUserSchema } from '../validations/user';

/**
 * 用户控制器
 * 处理用户管理相关的 CRUD 操作
 */

// 查询时排除密码字段，避免敏感信息泄露
const userSelect = {
  id: true,
  username: true,
  realName: true,
  email: true,
  roles: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * 获取用户列表（分页 + 搜索）
 *
 * 权限：仅管理员
 *
 * 查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 10）
 * - keyword: 搜索关键词（模糊匹配用户名、真实姓名、邮箱）
 */
export async function getUsers(req: Request, res: Response) {
  try {
    // 解析分页参数
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const keyword = req.query.keyword as string | undefined;

    // 构建搜索条件
    const where: any = {};

    // 如果有关键词，模糊匹配多个字段
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }

    // 并行查询列表和总数
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }, // 按创建时间倒序
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        list: users,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
}

/**
 * 获取用户详情
 *
 * 权限：管理员可查看所有人，普通用户只能查看自己
 *
 * 路由参数：
 * - id: 用户 ID
 */
export async function getUserById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 权限检查：普通用户只能查看自己的信息
    const isAdmin = req.user?.roles.includes('admin');
    if (req.user?.id !== id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权限查看其他用户信息',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
}

/**
 * 更新用户信息
 *
 * 权限：管理员可更新所有人，普通用户只能更新自己
 * 注意：普通用户只能修改 realName 和 email，管理员还可以修改 roles 和 isActive
 */
export async function updateUser(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const isAdmin = req.user?.roles.includes('admin');

    // 权限检查
    if (req.user?.id !== id && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: '无权限修改其他用户信息',
      });
    }

    // 根据角色选择不同的验证 schema
    const schema = isAdmin ? adminUpdateUserSchema : updateUserSchema;
    const validationResult = schema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: validationResult.error.issues,
      });
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 如果要修改邮箱，检查是否已被其他用户使用
    if (validationResult.data.email) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: validationResult.data.email,
          id: { not: id }, // 排除当前用户
        },
      });
      if (emailTaken) {
        return res.status(400).json({
          success: false,
          message: '该邮箱已被其他用户使用',
        });
      }
    }

    // 更新用户，roles 需要序列化为 JSON 字符串
    const updateData: any = { ...validationResult.data };
    if (updateData.roles) {
      updateData.roles = JSON.stringify(updateData.roles);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    res.json({
      success: true,
      message: '更新成功',
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新用户信息失败' });
  }
}

/**
 * 禁用/启用用户
 *
 * 权限：仅管理员
 * 说明：通过切换 isActive 字段实现，可恢复
 */
export async function updateUserStatus(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { isActive } = req.body;

    // 验证 isActive 必须是布尔值
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive 必须是布尔值',
      });
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 不能禁用自己
    if (req.user?.id === id && !isActive) {
      return res.status(400).json({
        success: false,
        message: '不能禁用自己的账号',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });

    res.json({
      success: true,
      message: isActive ? '用户已启用' : '用户已禁用',
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新用户状态失败' });
  }
}

/**
 * 硬删除用户
 *
 * 权限：仅管理员
 * 警告：此操作不可恢复！如果用户有关联数据，Prisma 会阻止删除
 */
export async function deleteUser(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    // 不能删除自己
    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账号',
      });
    }

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
      });
    }

    // 尝试删除，如果有关联数据会抛出外键约束错误
    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: '用户已删除',
    });
  } catch (error: any) {
    // 捕获外键约束错误（P2003）或关联记录阻止删除错误（P2014）
    if (error.code === 'P2003' || error.code === 'P2014') {
      return res.status(400).json({
        success: false,
        message: '该用户有关联数据，无法删除。请先处理相关数据，或使用禁用功能',
      });
    }
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
}
