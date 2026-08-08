<script setup lang="ts">
/**
 * 通知列表页面
 *
 * 功能:
 * 1. 展示当前用户的通知列表（卡片样式）
 * 2. 筛选：全部/未读/已读（抽屉选择）
 * 3. 标记已读 / 全部已读 / 删除
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteReadNotifications } from '@/api/notification';

const router = useRouter();

const notifications = ref<any[]>([]);
const loading = ref(false);

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

// 筛选状态
const readFilter = ref('');

const filterOptions = [
  { label: '全部', value: '' },
  { label: '未读', value: 'false' },
  { label: '已读', value: 'true' },
];

const typeMap: Record<string, { label: string; color: string }> = {
  EVALUATION_SUBMITTED: { label: '已提交', color: '#e6a23c' },
  EVALUATION_APPROVED: { label: '已通过', color: '#67c23a' },
  EVALUATION_REJECTED: { label: '已驳回', color: '#f56c6c' },
  EVALUATION_ARCHIVED: { label: '已归档', color: '#909399' },
  ASSIGNED_AS_REVIEWER: { label: '审核分配', color: '#409eff' },
  DEADLINE_REMINDER: { label: '截止提醒', color: '#e6a23c' },
};

function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString();
}

async function fetchNotifications() {
  loading.value = true;
  try {
    const params: any = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    };
    if (readFilter.value !== '') {
      params.isRead = readFilter.value === 'true';
    }
    const res = await getNotifications(params);
    if (res.success) {
      notifications.value = res.data.list;
      pagination.value.total = res.data.total;
    }
  } catch (error) {
    console.error('获取通知列表失败:', error);
    ElMessage.error('获取通知列表失败');
  } finally {
    loading.value = false;
  }
}

function applyFilter(val: string) {
  readFilter.value = val;
  pagination.value.page = 1;
  fetchNotifications();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchNotifications();
}

async function handleMarkAsRead(item: any) {
  if (item.isRead) return;
  try {
    const res = await markAsRead(item.id);
    if (res.success) item.isRead = true;
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

async function handleMarkAllAsRead() {
  try {
    const res = await markAllAsRead();
    if (res.success) {
      ElMessage.success('已全部标记为已读');
      fetchNotifications();
    }
  } catch (error) {
    console.error('标记全部已读失败:', error);
  }
}

function handleClick(item: any) {
  handleMarkAsRead(item);
  if (item.relatedId) {
    router.push(`/evaluations/${item.relatedId}`);
  }
}

async function handleDelete(item: any, event: Event) {
  event.stopPropagation();
  try {
    await ElMessageBox.confirm('确定删除此通知吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await deleteNotification(item.id);
    if (res.success) {
      ElMessage.success('通知已删除');
      fetchNotifications();
    }
  } catch {
    // 取消
  }
}

async function handleDeleteRead() {
  try {
    await ElMessageBox.confirm('确定清除所有已读通知吗？', '清除确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await deleteReadNotifications();
    if (res.success) {
      ElMessage.success(`已清除 ${res.data?.count || 0} 条已读通知`);
      fetchNotifications();
    }
  } catch {
    // 取消
  }
}

onMounted(() => {
  fetchNotifications();
});
</script>

<template>
  <div class="notifications-page">
    <!-- 操作栏：全部单行 -->
    <div class="toolbar">
      <!-- 筛选下拉 -->
      <el-select v-model="readFilter" placeholder="筛选状态" clearable @change="applyFilter" style="width: 130px">
        <el-option v-for="opt in filterOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <!-- 右侧操作 -->
      <div class="toolbar-right">
        <el-button size="small" @click="handleDeleteRead">清除已读</el-button>
        <el-button size="small" type="primary" @click="handleMarkAllAsRead">全部已读</el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && notifications.length === 0" description="暂无通知" />

    <!-- 通知卡片列表 -->
    <div v-loading="loading" class="notification-list">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="notification-card"
        :class="{ unread: !item.isRead }"
        @click="handleClick(item)"
      >
        <div class="card-left">
          <div class="card-dot" v-if="!item.isRead" />
          <div v-else class="card-dot-placeholder" />
        </div>
        <div class="card-body">
          <div class="card-top">
            <div class="card-title-row">
              <span class="card-title">{{ item.title }}</span>
              <el-tag
                v-if="typeMap[item.type]"
                :color="typeMap[item.type].color"
                size="small"
                effect="dark"
                class="type-tag"
              >
                {{ typeMap[item.type].label }}
              </el-tag>
            </div>
            <el-button
              type="danger"
              text
              size="small"
              class="card-delete"
              @click="handleDelete(item, $event)"
            >
              <el-icon :size="14"><Delete /></el-icon>
            </el-button>
          </div>
          <p class="card-content">{{ item.content }}</p>
          <div class="card-bottom">
            <span class="card-time">{{ formatDate(item.createdAt) }}</span>
            <el-button
              v-if="!item.isRead && item.relatedId"
              type="primary"
              link
              size="small"
              @click.stop="handleClick(item)"
            >
              查看详情 →
            </el-button>
          </div>
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
  </div>
</template>

<style scoped>
.notifications-page {
  padding: 0;
}

/* 操作栏 — 单行 */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

/* 通知卡片 */
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: #d0d5db;
}

.notification-card.unread {
  background: #f5f8ff;
}

.card-left {
  display: flex;
  padding-top: 4px;
}

.card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
  flex-shrink: 0;
}

.card-dot-placeholder {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.type-tag {
  flex-shrink: 0;
  border: none;
  font-size: 11px;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
}

.card-delete {
  flex-shrink: 0;
  padding: 2px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.notification-card:hover .card-delete {
  opacity: 1;
}

.card-content {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-time {
  font-size: 12px;
  color: #b0b5bc;
}
</style>
