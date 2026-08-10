<script setup lang="ts">
/**
 * 用户管理页面（仅管理员可访问）
 *
 * 功能:
 * 1. 用户列表（分页 + 搜索）— 卡片网格展示
 * 2. 编辑用户角色
 * 3. 启用/禁用用户
 * 4. 删除用户
 */
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getUsers, updateUser, updateUserStatus, deleteUser, createUser } from '@/api/user';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const isMobile = computed(() => window.innerWidth < 768);

const users = ref<any[]>([]);
const loading = ref(false);

const pagination = ref({
  page: 1,
  pageSize: 12,
  total: 0,
});

const keyword = ref('');

const editDialogVisible = ref(false);
const editForm = ref({
  id: 0,
  username: '',
  realName: '',
  email: '',
  roles: [] as string[],
});
const editLoading = ref(false);

// 创建用户弹窗
const createDialogVisible = ref(false);
const createForm = ref({
  username: '',
  password: '',
  realName: '',
  email: '',
  roles: ['user'] as string[],
});
const createLoading = ref(false);

const roleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
];

function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

function parseRoles(roles: any): string[] {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  try {
    return JSON.parse(roles);
  } catch {
    return [];
  }
}

function isAdminUser(roles: any): boolean {
  return parseRoles(roles).includes('admin');
}

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await getUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: keyword.value || undefined,
    });
    if (res.success) {
      users.value = res.data.list;
      pagination.value.total = res.data.total;
    }
  } catch (error) {
    console.error('获取用户列表失败:', error);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.value.page = 1;
  fetchUsers();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchUsers();
}

function openEditDialog(user: any) {
  editForm.value = {
    id: user.id,
    username: user.username,
    realName: user.realName || '',
    email: user.email || '',
    roles: parseRoles(user.roles),
  };
  editDialogVisible.value = true;
}

async function handleSaveEdit() {
  editLoading.value = true;
  try {
    const res = await updateUser(editForm.value.id, {
      realName: editForm.value.realName,
      email: editForm.value.email,
      roles: editForm.value.roles,
    });
    if (res.success) {
      ElMessage.success('更新成功');
      editDialogVisible.value = false;

      // 如果修改了其他用户的角色，提示管理员该用户需要重新登录
      if (res.rolesChanged) {
        ElMessage.warning('该用户的角色已变更，下次登录时将生效');
      }

      fetchUsers();
    }
  } catch (error) {
    console.error('更新用户失败:', error);
  } finally {
    editLoading.value = false;
  }
}

async function handleToggleStatus(user: any) {
  const newStatus = !user.isActive;
  const action = newStatus ? '启用' : '禁用';
  try {
    await ElMessageBox.confirm(`确定要${action}用户"${user.username}"吗？`, `${action}确认`, {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await updateUserStatus(user.id, newStatus);
    if (res.success) {
      ElMessage.success(`${action}成功`);
      fetchUsers();
    }
  } catch {
    // 取消
  }
}

async function handleDelete(user: any) {
  try {
    await ElMessageBox.confirm(`确定要删除用户"${user.username}"吗？此操作不可恢复。`, '删除确认', {
      type: 'error',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await deleteUser(user.id);
    if (res.success) {
      ElMessage.success('删除成功');
      fetchUsers();
    }
  } catch {
    // 取消
  }
}

onMounted(() => {
  fetchUsers();
});

// 创建用户
function openCreateDialog() {
  createForm.value = {
    username: '',
    password: '',
    realName: '',
    email: '',
    roles: ['user'],
  };
  createDialogVisible.value = true;
}

async function handleCreateUser() {
  createLoading.value = true;
  try {
    const res = await createUser({
      username: createForm.value.username,
      password: createForm.value.password,
      realName: createForm.value.realName,
      email: createForm.value.email || undefined,
      roles: createForm.value.roles,
    });
    if (res.success) {
      ElMessage.success('用户创建成功');
      createDialogVisible.value = false;
      fetchUsers();
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '创建失败');
  } finally {
    createLoading.value = false;
  }
}
</script>

<template>
  <div class="users-page">
    <!-- 搜索栏 -->
    <div class="top-bar">
      <div class="filter-area">
        <el-input
          v-model="keyword"
          placeholder="搜索用户名、姓名、邮箱"
          clearable
          style="width: 300px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
        <span class="total-count">共 {{ pagination.total }} 个用户</span>
      </div>
      <el-button type="primary" @click="openCreateDialog">添加用户</el-button>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && users.length === 0" description="暂无用户" />

    <!-- 桌面端表格 -->
    <el-table v-else-if="!isMobile" :data="users" v-loading="loading" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="realName" label="姓名" width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="isAdminUser(row.roles) ? 'danger' : 'info'" size="small">
            {{ isAdminUser(row.roles) ? '管理员' : '普通用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
            {{ row.isActive ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
          <el-button
            :type="row.isActive ? 'warning' : 'success'"
            link
            :disabled="row.id === userStore.userInfo?.id"
            @click="handleToggleStatus(row)"
          >
            {{ row.isActive ? '禁用' : '启用' }}
          </el-button>
          <el-button
            type="danger"
            link
            :disabled="row.id === userStore.userInfo?.id"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手机端卡片网格 -->
    <div v-else v-loading="loading" class="user-grid">
      <div v-for="user in users" :key="user.id" class="user-card">
        <div class="card-header">
          <div class="user-info">
            <span class="user-name">{{ user.realName || user.username }}</span>
            <span class="user-username">ID: {{ user.id }} · @{{ user.username }}</span>
          </div>
          <div class="card-tags">
            <el-tag :type="isAdminUser(user.roles) ? 'danger' : 'info'" size="small" effect="plain">
              {{ isAdminUser(user.roles) ? '管理员' : '用户' }}
            </el-tag>
            <el-tag :type="user.isActive ? 'success' : 'danger'" size="small" effect="plain">
              {{ user.isActive ? '正常' : '禁用' }}
            </el-tag>
          </div>
        </div>

        <div class="card-details">
          <div class="detail-item" v-if="user.email">
            <span class="detail-label">邮箱</span>
            <span class="detail-value">{{ user.email }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">注册于</span>
            <span class="detail-value">{{ formatDate(user.createdAt) }}</span>
          </div>
        </div>

        <div class="card-actions">
          <el-button type="primary" link size="small" @click="openEditDialog(user)">
            编辑
          </el-button>
          <el-button
            :type="user.isActive ? 'warning' : 'success'"
            link
            size="small"
            :disabled="user.id === userStore.userInfo?.id"
            @click="handleToggleStatus(user)"
          >
            {{ user.isActive ? '禁用' : '启用' }}
          </el-button>
          <el-button
            type="danger"
            link
            size="small"
            :disabled="user.id === userStore.userInfo?.id"
            @click="handleDelete(user)"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <el-pagination
      v-if="pagination.total > pagination.pageSize"
      v-model:current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, prev, pager, next"
      @current-change="handlePageChange"
      style="margin-top: 20px; justify-content: flex-end"
    />

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑用户"
      :width="isMobile ? '95vw' : '480px'"
      destroy-on-close
    >
      <el-form label-width="80px" v-loading="editLoading">
        <el-form-item label="用户名">
          <el-input :model-value="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="editForm.roles"
            multiple
            style="width: 100%"
            :disabled="editForm.id === userStore.userInfo?.id"
          >
            <el-option
              v-for="role in roleOptions"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </el-select>
          <div v-if="editForm.id === userStore.userInfo?.id" class="form-tip">
            不能修改自己的角色
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit" :loading="editLoading">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建用户弹窗 -->
    <el-dialog
      v-model="createDialogVisible"
      title="添加用户"
      :width="isMobile ? '95vw' : '480px'"
      destroy-on-close
    >
      <el-form label-width="80px" v-loading="createLoading">
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" placeholder="请输入用户名（至少3位）" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input
            v-model="createForm.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            show-password
          />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="createForm.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" placeholder="请输入邮箱（选填）" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.roles" multiple style="width: 100%">
            <el-option
              v-for="role in roleOptions"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateUser" :loading="createLoading"
          >创建</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  padding: 0;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
}

.filter-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-count {
  font-size: 14px;
  color: #909399;
  white-space: nowrap;
}

/* 用户卡片网格 */
.user-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.user-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 18px;
  transition: all 0.2s ease;
}

.user-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: #d0d5db;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-username {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.card-tags {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  flex-shrink: 0;
}

.card-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  width: 48px;
}

.detail-value {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  height: 30px;
}

/* ========== 响应式 ========== */
@media (max-width: 1199px) {
  .user-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 991px) {
  .user-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 767px) {
  .user-grid {
    grid-template-columns: 1fr;
  }

  .top-bar {
    margin-bottom: 16px;
  }

  .top-bar :deep(.el-input) {
    width: 100% !important;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
