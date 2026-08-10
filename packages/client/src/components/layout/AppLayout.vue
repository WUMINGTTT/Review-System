<script setup lang="ts">
/**
 * 主布局组件
 *
 * 结构: 侧边栏 + 顶栏 + 内容区
 * 功能: 导航菜单、折叠侧边栏、显示用户信息、退出登录
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { getUnreadCount } from '@/api/notification';
import {
  House,
  Document,
  User,
  Expand,
  Fold,
  ArrowLeft,
  Bell,
  Menu,
  Promotion,
  List,
} from '@element-plus/icons-vue';

// ========== 路由相关 ==========
const route = useRoute();
const router = useRouter();

// 记录上一个路由路径
const previousPath = ref<string>('');

// 监听路由变化，记录上一个路径
router.afterEach((_to, from) => {
  previousPath.value = from.fullPath;
});

// 处理返回逻辑
function handleBack() {
  // 如果当前是详情页，且上一个页面是创建/编辑/评分页，则跳转到评价管理
  if (route.meta.isDetail) {
    const blockedPaths = ['/evaluations/create', '/rate', '/edit'];
    const isFromBlocked = blockedPaths.some((p) => previousPath.value.includes(p));
    if (isFromBlocked) {
      router.push('/evaluations');
      return;
    }
  }
  // 默认使用 router.back()
  router.back();
}

// ========== 用户状态 ==========
const userStore = useUserStore();

const isAdmin = computed(() => {
  const roles = userStore.userInfo?.roles || [];
  return roles.includes('admin');
});

// ========== 响应式判断 ==========
const isMobile = ref(window.innerWidth < 768);

function handleResize() {
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value) {
    drawerVisible.value = false;
  }
}

// ========== 侧边栏 ==========
const isCollapse = ref(false);
const drawerVisible = ref(false);
const activeMenu = computed(() => route.path);

function toggleCollapse() {
  isCollapse.value = !isCollapse.value;
}

function handleMenuSelect() {
  if (isMobile.value) {
    drawerVisible.value = false;
  }
}

// ========== 未读通知数 ==========
const unreadCount = ref(0);

async function fetchUnreadCount() {
  try {
    const res = await getUnreadCount();
    if (res.success) {
      unreadCount.value = res.data.total;
    }
  } catch {
    // 静默失败
  }
}

function goToNotifications() {
  router.push('/notifications');
}

router.afterEach(() => {
  fetchUnreadCount();
});

// ========== 用户头像 ==========
const avatarChar = computed(() => {
  const name = userStore.userInfo?.realName || userStore.userInfo?.username || '用';
  return name.charAt(0).toUpperCase();
});

onMounted(() => {
  fetchUnreadCount();
  window.addEventListener('resize', handleResize);
});
</script>

<template>
  <el-container class="layout-container">
    <!-- 桌面端侧边栏 -->
    <el-aside v-if="!isMobile" :width="isCollapse ? '72px' : '220px'" class="aside">
      <div class="logo">
        <el-icon :size="22" class="logo-icon"><Promotion /></el-icon>
        <h1 v-show="!isCollapse">评价系统</h1>
      </div>

      <el-menu :default-active="activeMenu" :collapse="isCollapse" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon :size="20"><House /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/evaluations">
          <el-icon :size="20"><Document /></el-icon>
          <span>评价管理</span>
        </el-menu-item>
        <el-menu-item index="/reviews">
          <el-icon :size="20"><Document /></el-icon>
          <span>审核管理</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/users">
          <el-icon :size="20"><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/admin/evaluations">
          <el-icon :size="20"><List /></el-icon>
          <span>全部评价</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-bottom">
        <div class="collapse-btn" @click="toggleCollapse">
          <el-icon :size="18">
            <Expand v-if="isCollapse" />
            <Fold v-else />
          </el-icon>
          <span v-show="!isCollapse" class="collapse-text">收起</span>
        </div>
        <!-- <div v-show="!isCollapse" class="version">v1.0</div> -->
      </div>
    </el-aside>

    <!-- 手机端抽屉侧边栏 -->
    <el-drawer
      v-model="drawerVisible"
      direction="ltr"
      :size="230"
      :show-close="false"
      class="mobile-drawer"
    >
      <template #header>
        <div class="drawer-title">
          <el-icon :size="18"><Promotion /></el-icon>
          <span>评价系统</span>
        </div>
      </template>
      <el-menu :default-active="activeMenu" router class="drawer-menu" @select="handleMenuSelect">
        <el-menu-item index="/dashboard">
          <el-icon :size="20"><House /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/evaluations">
          <el-icon :size="20"><Document /></el-icon>
          <span>评价管理</span>
        </el-menu-item>
        <el-menu-item index="/reviews">
          <el-icon :size="20"><Document /></el-icon>
          <span>审核管理</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/users">
          <el-icon :size="20"><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/admin/evaluations">
          <el-icon :size="20"><List /></el-icon>
          <span>全部评价</span>
        </el-menu-item>
      </el-menu>
    </el-drawer>

    <!-- 右侧内容区 -->
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button v-if="isMobile" :icon="Menu" text @click="drawerVisible = true" />
          <template v-if="route.meta.backTo">
            <span class="back-link" @click="handleBack">
              <el-icon :size="16"><ArrowLeft /></el-icon>
              <span>返回</span>
            </span>
            <el-divider direction="vertical" />
          </template>
          <span class="page-title">{{ route.meta.title }}</span>
        </div>

        <div class="header-right">
          <el-badge
            :value="unreadCount"
            :hidden="unreadCount === 0"
            :max="99"
            class="notification-badge"
          >
            <el-button :icon="Bell" text @click="goToNotifications" class="notification-btn" />
          </el-badge>
          <div
            class="user-avatar"
            :title="userStore.userInfo?.realName || userStore.userInfo?.username || '用户'"
            @click="router.push('/profile')"
          >
            {{ avatarChar }}
          </div>
        </div>
      </el-header>

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

/* ========== 侧边栏 ========== */
.aside {
  background: linear-gradient(180deg, #1a2332 0%, #2d3a4a 100%);
  transition: width 0.3s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-icon {
  color: #409eff;
}

.logo h1 {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 1px;
}

/* 菜单样式 */
.side-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  padding: 8px 0;
}

.side-menu:not(.el-menu--collapse) {
  width: 220px;
}

:deep(.el-menu-item) {
  color: #8b9bb4;
  height: 48px;
  line-height: 48px;
  margin: 2px 8px;
  border-radius: 8px;
  transition: all 0.25s ease;
}

:deep(.el-menu-item:hover) {
  background-color: rgba(64, 158, 255, 0.08);
  color: #c0c8d4;
}

:deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.15);
  color: #409eff;
  position: relative;
}

:deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: #409eff;
  border-radius: 0 3px 3px 0;
}

:deep(.el-menu--collapse .el-menu-item) {
  margin: 2px 8px;
  border-radius: 8px;
}

:deep(.el-menu--collapse .el-menu-item.is-active::before) {
  width: 3px;
  height: 16px;
}

/* 侧边栏底部 */
.sidebar-bottom {
  margin-top: auto;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7d94;
  transition: all 0.25s ease;
  padding: 0 12px;
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: #409eff;
}

.collapse-btn:active {
  transform: scale(0.96);
}

.collapse-text {
  font-size: 13px;
  white-space: nowrap;
}

.version {
  text-align: center;
  font-size: 11px;
  color: #4a5a6d;
  padding: 6px 0 2px;
}

/* ========== 抽屉 ========== */
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.drawer-title .el-icon {
  color: #409eff;
}

.drawer-menu {
  border-right: none;
}

/* ========== 顶栏 ========== */
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
  min-width: 0;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  user-select: none;
}

.user-avatar:hover {
  transform: scale(1.03);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.4);
}

.main {
  background-color: #f5f7fa;
  padding: 20px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 右侧内容区使用 flex 布局 */
.layout-container > .el-container {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.notification-badge {
  display: flex;
  align-items: center;
}

.notification-btn {
  padding: 4px;
  min-height: auto;
  height: auto;
}

.notification-badge :deep(.el-button) {
  font-size: 18px;
  color: #606266;
}

.notification-badge :deep(.el-button:hover) {
  color: #409eff;
}

.notification-badge :deep(.el-badge__content) {
  font-size: 10px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .header {
    padding: 0 12px;
    height: 50px;
    overflow: hidden;
  }

  .header-left {
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .header-right {
    gap: 8px;
    flex-shrink: 0;
  }

  .page-title {
    font-size: 14px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .notification-badge {
    position: relative;
    z-index: 1;
  }

  .notification-badge :deep(.el-badge__content) {
    font-size: 9px;
    padding: 0 3px;
    height: 14px;
    line-height: 14px;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
  }

  .main {
    padding: 12px;
  }
}
</style>
