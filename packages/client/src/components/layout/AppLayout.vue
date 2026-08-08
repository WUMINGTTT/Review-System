<script setup lang="ts">
/**
 * 主布局组件
 *
 * 结构: 侧边栏 + 顶栏 + 内容区
 * 功能: 导航菜单、折叠侧边栏、显示用户信息、退出登录
 */
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import {
  House,
  Document,
  User,
  SwitchButton,
  Expand,
  Fold,
  ArrowLeft,
} from '@element-plus/icons-vue';

// ========== 路由相关 ==========
const route = useRoute(); // 获取当前路由信息
const router = useRouter(); // 路由实例，用于编程式导航

// ========== 用户状态 ==========
const userStore = useUserStore();

// 判断当前用户是否是管理员
const isAdmin = computed(() => {
  const roles = userStore.userInfo?.roles || [];
  return roles.includes('admin');
});

// ========== 侧边栏折叠 ==========
// ref 创建响应式变量，控制侧边栏是否折叠
const isCollapse = ref(false);

// ========== 当前激活菜单 ==========
// computed 计算属性，根据当前路由路径自动更新
// 当用户访问 /evaluations 时，对应菜单高亮
const activeMenu = computed(() => route.path);

// 切换折叠状态
function toggleCollapse() {
  isCollapse.value = !isCollapse.value;
}

// ========== 退出登录 ==========
async function handleLogout() {
  try {
    // ElMessageBox.confirm 弹出确认对话框
    // 返回 Promise，用户点击确定 resolve，点击取消 reject
    // 设置选项
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    // 用户点击确定
    userStore.logout();
    router.push('/login');
  } catch {
    // 用户点击取消，不做任何操作
  }
}
</script>

<template>
  <!-- el-container: 布局容器 -->
  <el-container class="layout-container">
    <!-- el-aside: 侧边栏，宽度根据折叠状态动态变化 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="aside">
      <!-- Logo 区域 -->
      <div class="logo">
        <h1 v-show="!isCollapse">评价系统</h1>
      </div>

      <!-- el-menu: 导航菜单 -->
      <!-- router 属性：点击菜单自动跳转到 index 对应的路由 -->
      <!-- collapse 属性：控制菜单是否折叠 -->
      <!-- default-active：当前激活的菜单项，绑定路由路径 -->
      <el-menu :default-active="activeMenu" :collapse="isCollapse" router class="side-menu">
        <!-- el-menu-item: 菜单项 -->
        <!-- index: 菜单项标识，router 模式下作为路由路径 -->
        <el-menu-item index="/dashboard">
          <el-icon><House /></el-icon>
          <span>工作台</span>
        </el-menu-item>

        <el-menu-item index="/evaluations">
          <el-icon><Document /></el-icon>
          <span>评价管理</span>
        </el-menu-item>

        <el-menu-item index="/reviews">
          <el-icon><Document /></el-icon>
          <span>审核管理</span>
        </el-menu-item>

        <el-menu-item v-if="isAdmin" index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>

      <!-- 底部折叠按钮 -->
      <div class="sidebar-bottom">
        <div class="collapse-btn" @click="toggleCollapse">
          <el-icon :size="18">
            <Expand v-if="isCollapse" />
            <Fold v-else />
          </el-icon>
          <span v-show="!isCollapse" class="collapse-text">收起</span>
        </div>
      </div>
    </el-aside>

    <!-- 右侧内容区 -->
    <el-container>
      <!-- el-header: 顶栏 -->
      <el-header class="header">
        <div class="header-left">
          <!-- 返回按钮 -->
          <template v-if="route.meta.backTo">
            <span class="back-link" @click="route.meta.backMode === 'back' ? router.back() : router.push(route.meta.backTo as string)">
              <el-icon :size="16"><ArrowLeft /></el-icon>
              <span>返回</span>
            </span>
            <el-divider direction="vertical" />
          </template>
          <span class="page-title">{{ route.meta.title }}</span>
        </div>

        <div class="header-right">
          <!-- 显示用户名 -->
          <span class="username">{{
            userStore.userInfo?.realName || userStore.userInfo?.username
          }}</span>
          <!-- 退出按钮 -->
          <el-button :icon="SwitchButton" text @click="handleLogout"> 退出 </el-button>
        </div>
      </el-header>

      <!-- el-main: 内容区 -->
      <!-- router-view 渲染子路由对应的组件 -->
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-container {
  height: 100vh;
}

/* 侧边栏样式 */
.aside {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Logo 区域 */
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.logo h1 {
  font-size: 18px;
  white-space: nowrap; /* 防止文字换行 */
}

/* 菜单样式 */
.side-menu {
  border-right: none;
  background-color: #304156;
  flex: 1;
}

.side-menu:not(.el-menu--collapse) {
  width: 200px;
}

/* 深度选择器：穿透到子组件修改样式 */
:deep(.el-menu-item) {
  color: #bfcbd9;
}

:deep(.el-menu-item:hover),
:deep(.el-menu-item.is-active) {
  background-color: #263445;
  color: #409eff;
}

/* 侧边栏底部 */
.sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  border-radius: 6px;
  cursor: pointer;
  color: #bfcbd9;
  transition: all 0.25s ease;
  padding: 0 12px;
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #409eff;
}

.collapse-btn:active {
  transform: scale(0.96);
}

.collapse-text {
  font-size: 13px;
  white-space: nowrap;
}

/* 顶栏样式 */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e6e6e6;
  background-color: #fff;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: color 0.2s;
  user-select: none;
}

.back-link:hover {
  color: #409eff;
}

.page-title {
  font-size: 16px;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  font-size: 14px;
  color: #606266;
}

/* 内容区样式 */
.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
