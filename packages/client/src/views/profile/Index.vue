<script setup lang="ts">
/**
 * 个人中心页面
 *
 * 功能: 查看和编辑个人信息
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { getUserById, updateUser } from '@/api/user';
import { Edit, SwitchButton, ArrowRight } from '@element-plus/icons-vue';

const router = useRouter();
const userStore = useUserStore();

// ========== 响应式 ==========
const isMobile = ref(window.innerWidth <= 767);
window.addEventListener('resize', () => {
  isMobile.value = window.innerWidth <= 767;
});

// ========== 用户信息 ==========
const userInfo = ref<any>(null);
const loading = ref(false);

// ========== 编辑状态 ==========
const editMode = ref(false);
const editForm = ref({
  realName: '',
  email: '',
});
const saving = ref(false);

// ========== 伪头像字符 ==========
const avatarChar = computed(() => {
  const name = userInfo.value?.realName || userInfo.value?.username || '用';
  return name.charAt(0).toUpperCase();
});

// ========== 角色文本 ==========
const roleText = computed(() => {
  const roles = userInfo.value?.roles || [];
  if (roles.includes('admin')) return '管理员';
  return '普通用户';
});

// ========== 加载用户信息 ==========
async function fetchUserInfo() {
  if (!userStore.userInfo?.id) return;
  loading.value = true;
  try {
    const res = await getUserById(userStore.userInfo.id);
    if (res.success) {
      userInfo.value = res.data;
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
  } finally {
    loading.value = false;
  }
}

// ========== 进入编辑模式 ==========
function startEdit() {
  editForm.value = {
    realName: userInfo.value?.realName || '',
    email: userInfo.value?.email || '',
  };
  editMode.value = true;
}

// ========== 取消编辑 ==========
function cancelEdit() {
  editMode.value = false;
}

// ========== 保存修改 ==========
async function saveEdit() {
  if (!editForm.value.realName.trim()) {
    ElMessage.warning('真实姓名不能为空');
    return;
  }

  saving.value = true;
  try {
    const res = await updateUser(userInfo.value.id, {
      realName: editForm.value.realName.trim(),
      email: editForm.value.email.trim() || undefined,
    });
    if (res.success) {
      ElMessage.success('修改成功');
      editMode.value = false;
      // 更新本地数据
      userInfo.value = { ...userInfo.value, ...res.data };
      // 同步更新 store 中的用户信息
      if (userStore.userInfo) {
        userStore.userInfo.realName = res.data.realName;
        userStore.userInfo.email = res.data.email;
      }
    } else {
      ElMessage.error(res.message || '修改失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '修改失败');
  } finally {
    saving.value = false;
  }
}

// ========== 退出登录 ==========
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    userStore.logout();
    router.push('/login');
  } catch {
    // 取消
  }
}

// ========== 格式化时间 ==========
function formatTime(time: string) {
  if (!time) return '-';
  const date = new Date(time);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  fetchUserInfo();
});
</script>

<template>
  <div class="profile-page" v-loading="loading">
    <!-- 头部卡片 -->
    <div class="profile-header">
      <div class="avatar-large">{{ avatarChar }}</div>
      <div class="header-info">
        <h2 class="user-name">{{ userInfo?.realName || userInfo?.username || '-' }}</h2>
        <div class="user-meta">
          <el-tag size="small" :type="userInfo?.roles?.includes('admin') ? 'danger' : 'info'">
            {{ roleText }}
          </el-tag>
          <span class="meta-text">账号: {{ userInfo?.username || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- 信息卡片 -->
    <div class="profile-card">
      <div class="card-header">
        <span class="card-title">基本信息</span>
        <el-button v-if="!editMode" type="primary" text :icon="Edit" @click="startEdit">
          编辑
        </el-button>
      </div>

      <!-- 查看模式 -->
      <div v-if="!editMode" class="info-grid">
        <div class="info-item">
          <span class="info-label">用户名</span>
          <span class="info-value">{{ userInfo?.username || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">真实姓名</span>
          <span class="info-value">{{ userInfo?.realName || '-' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">邮箱</span>
          <span class="info-value">{{ userInfo?.email || '未设置' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">角色</span>
          <span class="info-value">{{ roleText }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">注册时间</span>
          <span class="info-value">{{ formatTime(userInfo?.createdAt) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">最后更新</span>
          <span class="info-value">{{ formatTime(userInfo?.updatedAt) }}</span>
        </div>
      </div>

      <!-- 编辑模式 -->
      <div v-else class="edit-form">
        <el-form label-position="top" :model="editForm">
          <el-form-item label="用户名">
            <el-input :model-value="userInfo?.username" disabled />
          </el-form-item>
          <el-form-item label="真实姓名" required>
            <el-input v-model="editForm.realName" placeholder="请输入真实姓名" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="editForm.email" placeholder="请输入邮箱（选填）" />
          </el-form-item>
        </el-form>
        <div class="edit-actions">
          <el-button @click="cancelEdit">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
        </div>
      </div>
    </div>

    <!-- 退出登录 -->
    <div class="logout-card" @click="handleLogout">
      <el-icon class="logout-icon"><SwitchButton /></el-icon>
      <span class="logout-text">退出登录</span>
      <el-icon class="logout-arrow"><ArrowRight /></el-icon>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 800px;
  margin: 0 auto;
}

/* ========== 头部卡片 ========== */
.profile-header {
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  border-radius: 12px;
  padding: 40px 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  color: #fff;
}

.avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-text {
  font-size: 14px;
  opacity: 0.85;
}

/* ========== 信息卡片 ========== */
.profile-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* ========== 信息网格 ========== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px 40px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 13px;
  color: #909399;
}

.info-value {
  font-size: 15px;
  color: #303133;
  word-break: break-all;
}

/* ========== 编辑表单 ========== */
.edit-form {
  max-width: 480px;
}

.edit-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

/* ========== 退出登录 ========== */
.logout-card {
  margin-top: 20px;
  background: #fff;
  border-radius: 12px;
  padding: 18px 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.logout-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.logout-icon {
  font-size: 20px;
  color: #f56c6c;
}

.logout-text {
  flex: 1;
  font-size: 15px;
  color: #f56c6c;
  font-weight: 500;
}

.logout-arrow {
  font-size: 14px;
  color: #c0c4cc;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .profile-header {
    padding: 28px 20px;
    gap: 16px;
    border-radius: 10px;
    margin-bottom: 12px;
  }

  .avatar-large {
    width: 64px;
    height: 64px;
    font-size: 28px;
  }

  .user-name {
    font-size: 20px;
  }

  .profile-card {
    padding: 20px 16px;
    border-radius: 10px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .edit-form {
    max-width: 100%;
  }

  .logout-card {
    padding: 16px 20px;
    border-radius: 10px;
  }
}
</style>
