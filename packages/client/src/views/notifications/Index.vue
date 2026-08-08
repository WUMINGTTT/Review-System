<script setup lang="ts">
/**
 * 通知列表页面
 *
 * 功能:
 * 1. 展示当前用户的通知列表
 * 2. 支持筛选：全部 / 未读 / 已读
 * 3. 标记单条已读 / 全部已读
 * 4. 点击通知跳转到相关评价详情
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete } from '@element-plus/icons-vue';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, deleteReadNotifications } from '@/api/notification';

const router = useRouter();

const notifications = ref<any[]>([]);
const loading = ref(false);

// 分页
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

// 筛选：'' | 'true' | 'false'
const readFilter = ref('');

// 通知类型映射
const typeMap: Record<string, string> = {
  EVALUATION_SUBMITTED: '评价已提交',
  EVALUATION_APPROVED: '评价已通过',
  EVALUATION_REJECTED: '评价已驳回',
  EVALUATION_ARCHIVED: '评价已归档',
  ASSIGNED_AS_REVIEWER: '被分配为审核者',
  DEADLINE_REMINDER: '截止提醒',
};

// 格式化日期
function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

// 获取通知列表
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

// 筛选变更
function handleFilterChange(val: string | number | boolean | undefined) {
  readFilter.value = String(val || '');
  pagination.value.page = 1;
  fetchNotifications();
}

// 翻页
function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchNotifications();
}

// 标记单条已读
async function handleMarkAsRead(item: any) {
  if (item.isRead) return;
  try {
    const res = await markAsRead(item.id);
    if (res.success) {
      item.isRead = true;
    }
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

// 标记全部已读
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

// 点击通知跳转
function handleClick(item: any) {
  handleMarkAsRead(item);
  if (item.relatedId) {
    router.push(`/evaluations/${item.relatedId}`);
  }
}

// 删除单条通知
async function handleDelete(item: any, event: Event) {
  event.stopPropagation(); // 阻止触发点击通知的跳转
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

// 清除所有已读通知
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
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <el-radio-group v-model="readFilter" @change="handleFilterChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="false">未读</el-radio-button>
        <el-radio-button value="true">已读</el-radio-button>
      </el-radio-group>
      <div class="top-bar-right">
        <el-button @click="handleDeleteRead">清除已读</el-button>
        <el-button @click="handleMarkAllAsRead">全部标记为已读</el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && notifications.length === 0" description="暂无通知" />

    <!-- 通知列表 -->
    <div v-loading="loading" class="notification-list">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="notification-item"
        :class="{ unread: !item.isRead }"
        @click="handleClick(item)"
      >
        <div class="notification-dot" v-if="!item.isRead" />
        <div class="notification-body">
          <div class="notification-header">
            <span class="notification-title">{{ item.title }}</span>
            <el-tag size="small" type="info" effect="plain">
              {{ typeMap[item.type] || item.type }}
            </el-tag>
            <el-button
              type="danger"
              text
              size="small"
              class="delete-btn"
              @click="handleDelete(item, $event)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <p class="notification-content">{{ item.content }}</p>
          <span class="notification-time">{{ formatDate(item.createdAt) }}</span>
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

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.top-bar-right {
  display: flex;
  gap: 8px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.notification-item:hover {
  border-color: #c0c4cc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.notification-item.unread {
  background: #f0f7ff;
  border-color: #b3d8ff;
}

.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #409eff;
  flex-shrink: 0;
  margin-top: 6px;
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.delete-btn {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s;
}

.notification-item:hover .delete-btn {
  opacity: 1;
}

.notification-title {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.notification-content {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.5;
}

.notification-time {
  font-size: 12px;
  color: #909399;
}
</style>
