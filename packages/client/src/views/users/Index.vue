<script setup lang="ts">
/**
 * 用户管理页面（仅管理员可访问）
 *
 * 功能:
 * 1. 用户列表（分页 + 搜索）
 * 2. 编辑用户角色
 * 3. 启用/禁用用户
 * 4. 删除用户
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsers, updateUser, updateUserStatus, deleteUser } from '@/api/user'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 用户列表
const users = ref<any[]>([])
const loading = ref(false)

// 分页
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
})

// 搜索关键词
const keyword = ref('')

// 编辑弹窗
const editDialogVisible = ref(false)
const editForm = ref({
  id: 0,
  username: '',
  realName: '',
  email: '',
  roles: [] as string[],
})
const editLoading = ref(false)

// 可选角色
const roleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
]

// 格式化日期
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

// 解析 roles（兼容 JSON 字符串和数组）
function parseRoles(roles: any): string[] {
  if (!roles) return []
  if (Array.isArray(roles)) return roles
  try {
    return JSON.parse(roles)
  } catch {
    return []
  }
}

// 角色标签文本
function getRoleLabel(roles: any) {
  const parsed = parseRoles(roles)
  return parsed.includes('admin') ? '管理员' : '普通用户'
}

// 获取用户列表
async function fetchUsers() {
  loading.value = true
  try {
    const res = await getUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      keyword: keyword.value || undefined,
    })
    if (res.success) {
      users.value = res.data.list
      pagination.value.total = res.data.total
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  pagination.value.page = 1
  fetchUsers()
}

// 翻页
function handlePageChange(page: number) {
  pagination.value.page = page
  fetchUsers()
}

// 打开编辑弹窗
function openEditDialog(user: any) {
  editForm.value = {
    id: user.id,
    username: user.username,
    realName: user.realName || '',
    email: user.email || '',
    roles: parseRoles(user.roles),
  }
  editDialogVisible.value = true
}

// 保存编辑
async function handleSaveEdit() {
  editLoading.value = true
  try {
    const res = await updateUser(editForm.value.id, {
      realName: editForm.value.realName,
      email: editForm.value.email,
      roles: editForm.value.roles,
    })
    if (res.success) {
      ElMessage.success('更新成功')
      editDialogVisible.value = false
      fetchUsers()
    }
  } catch (error) {
    console.error('更新用户失败:', error)
  } finally {
    editLoading.value = false
  }
}

// 切换启用/禁用
async function handleToggleStatus(user: any) {
  const newStatus = !user.isActive
  const action = newStatus ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定要${action}用户"${user.username}"吗？`, `${action}确认`, {
      type: 'warning',
    })
    const res = await updateUserStatus(user.id, newStatus)
    if (res.success) {
      ElMessage.success(`${action}成功`)
      fetchUsers()
    }
  } catch {
    // 取消
  }
}

// 删除用户
async function handleDelete(user: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户"${user.username}"吗？此操作不可恢复。`,
      '删除确认',
      { type: 'error' }
    )
    const res = await deleteUser(user.id)
    if (res.success) {
      ElMessage.success('删除成功')
      fetchUsers()
    }
  } catch {
    // 取消
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="users-page">
    <!-- 搜索栏 -->
    <div class="top-bar">
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
    </div>

    <!-- 用户表格 -->
    <el-table :data="users" v-loading="loading" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="realName" label="姓名" width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="parseRoles(row.roles).includes('admin') ? 'danger' : 'info'" size="small">
            {{ getRoleLabel(row.roles) }}
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

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, prev, pager, next"
      @current-change="handlePageChange"
      style="margin-top: 20px; justify-content: flex-end"
    />

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑用户" width="480px">
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
          <el-select v-model="editForm.roles" multiple style="width: 100%">
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
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit" :loading="editLoading">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  padding: 0;
}

.top-bar {
  margin-bottom: 20px;
}
</style>
