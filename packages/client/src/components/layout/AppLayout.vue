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
import { House, Document, User, SwitchButton, Expand, Fold } from '@element-plus/icons-vue';

// ========== 路由相关 ==========
const route = useRoute(); // 获取当前路由信息
const router = useRouter(); // 路由实例，用于编程式导航

// ========== 用户状态 ==========
const userStore = useUserStore();

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
        <h1 v-show="isCollapse">评</h1>
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
          <span>评价活动</span>
        </el-menu-item>

        <el-menu-item index="/ratings">
          <el-icon><Document /></el-icon>
          <span>我的评分</span>
        </el-menu-item>

        <el-menu-item index="/reviews">
          <el-icon><Document /></el-icon>
          <span>审核管理</span>
        </el-menu-item>

        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 右侧内容区 -->
    <el-container>
      <!-- el-header: 顶栏 -->
      <el-header class="header">
        <div class="header-left">
          <!-- 折叠按钮 -->
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <!-- 根据折叠状态显示不同图标 -->
            <Expand v-if="isCollapse" />
            <Fold v-else />
          </el-icon>
          <!-- 页面标题，从路由 meta 获取 -->
          <span class="page-title">{{ route.meta.title }}</span>
        </div>

        <div class="header-right">
          <!-- 显示用户名 -->
          <span class="username">{{ userStore.userInfo?.name }}</span>
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
  transition: width 0.3s; /* 宽度变化时有过渡动画 */
  overflow: hidden;
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

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
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
