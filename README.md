# 评价系统

一个基于 Vue 3 + Express + Prisma + MySQL 的在线评价管理系统，支持多维度评分、审核流程和用户权限管理。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Element Plus + Pinia + Vue Router |
| 后端 | Express + Prisma + MySQL + JWT |
| 部署 | Nginx + PM2 |

## 项目结构

```
Review-System/
├── packages/
│   ├── client/          # 前端项目
│   │   ├── src/
│   │   │   ├── api/         # API 请求封装
│   │   │   ├── components/  # 公共组件
│   │   │   ├── router/      # 路由配置
│   │   │   ├── stores/      # Pinia 状态管理
│   │   │   ├── utils/       # 工具函数
│   │   │   └── views/       # 页面组件
│   │   └── package.json
│   └── server/          # 后端项目
│       ├── src/
│       │   ├── controllers/ # 业务控制器
│       │   ├── middlewares/  # 中间件（鉴权、限流）
│       │   ├── routes/       # 路由定义
│       │   ├── validations/  # 参数校验
│       │   └── utils/        # 工具函数
│       ├── prisma/           # 数据库模型
│       └── package.json
├── deploy.sh            # 一键部署脚本
└── README.md
```

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 5.7
- pnpm >= 8

### 安装

```bash
# 克隆项目
git clone https://github.com/WUMINGTTT/Review-System.git
cd Review-System

# 安装依赖
pnpm install

# 配置数据库
cp packages/server/.env.example packages/server/.env
# 编辑 .env 文件，填入数据库连接信息

# 同步数据库结构
cd packages/server
npx prisma db push

# 启动开发服务器
cd ../..
pnpm dev
```

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | 123456 |

---

## 文档

- [用户使用手册](docs/user-manual.md) - 系统各功能模块的使用说明
- [阿里云部署指南](docs/deployment-aliyun.md) - 服务器部署完整教程

---

## 部署

```bash
# 拉取代码
git pull origin main

# 安装依赖
pnpm install

# 同步数据库
cd packages/server
npx prisma generate
npx prisma db push

# 构建后端
npm run build

# 构建前端
cd ../client
npm run build

# 重启服务
pm2 restart review-system
```

---

## 开发

```bash
# 同时启动前端和后端开发服务器
pnpm dev

# 仅启动前端
pnpm --filter @review-system/client dev

# 仅启动后端
pnpm --filter @review-system/server dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3000`。

---

## License

MIT
