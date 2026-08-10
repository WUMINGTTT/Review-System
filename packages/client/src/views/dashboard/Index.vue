<script setup lang="ts">
/**
 * 工作台页面
 *
 * 功能:
 * 1. 统计卡片（评价总数、待评分、待审核、已完成）
 * 2. 待办事项列表
 * 3. 最近动态（通知记录）
 * 4. 快捷操作卡片
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getDashboardStats } from '@/api/stats';
import { getMyReviews } from '@/api/review';
import { getEvaluations } from '@/api/evaluation';
import { getNotifications } from '@/api/notification';
import StatCard from '@/components/StatCard.vue';
import {
  Document,
  Check,
  Folder,
  Bell,
  Plus,
  List,
  Stamp,
  ArrowRight,
  Clock,
  User,
} from '@element-plus/icons-vue';

const router = useRouter();

// 统计数据
const stats = ref({
  draftCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  archivedCount: 0,
});

// 待办事项
const todoItems = ref<any[]>([]);
const todoLoading = ref(false);

// 最近动态
const recentNotifications = ref<any[]>([]);
const notificationsLoading = ref(false);

const loading = ref(false);

// 格式化时间（相对时间）
function formatRelativeTime(date: string | null | undefined) {
  if (!date) return '';
  const now = new Date();
  const target = new Date(date);
  const diff = now.getTime() - target.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return target.toLocaleDateString();
}

// 获取统计数据
async function fetchStats() {
  loading.value = true;
  try {
    const res = await getDashboardStats();
    if (res.success) {
      stats.value = res.data;
    }
  } catch (error) {
    console.error('获取统计数据失败:', error);
  } finally {
    loading.value = false;
  }
}

// 待办事项类型
type TodoType = 'pending' | 'draft' | 'rating' | 'rejected';

interface TodoItem {
  id: number;
  title: string;
  type: TodoType;
  typeName: string;
  typeColor: string;
  creator?: { realName?: string; username?: string };
  createdAt?: string;
  submittedAt?: string;
  updatedAt?: string;
}

// 检查评价是否已完成所有评分
function isRatingComplete(evaluation: any): boolean {
  const participants = evaluation.participants || [];
  const dimensions = evaluation.scoreDimensions || [];
  const ratingItems = evaluation.ratingItems || [];

  if (participants.length === 0 || dimensions.length === 0) {
    return false;
  }

  // 检查每个被评价人是否都有所有维度的评分
  return participants.every((p: any) => {
    return dimensions.every((d: any) => {
      return ratingItems.some(
        (r: any) =>
          r.participantId === p.id &&
          r.dimensionScores?.some((ds: any) => ds.dimensionId === d.id && ds.score > 0),
      );
    });
  });
}

// 获取待办事项（待审核 + 待评分/待提交 + 被打回）
async function fetchTodoItems() {
  todoLoading.value = true;
  try {
    const [pendingRes, draftRes, rejectedRes] = await Promise.all([
      getMyReviews({ status: 'pending' }),
      getEvaluations({ status: 'DRAFT' }),
      getEvaluations({ status: 'REJECTED' }),
    ]);

    const items: TodoItem[] = [];

    // 待审核评价（用户作为审核者）
    if (pendingRes.success && pendingRes.data?.list) {
      pendingRes.data.list.forEach((item: any) => {
        items.push({
          ...item,
          type: 'pending',
          typeName: '待审核',
          typeColor: '#e6a23c',
        });
      });
    }

    // 草稿评价（用户创建的）- 区分待评分和待提交
    if (draftRes.success && draftRes.data?.list) {
      draftRes.data.list.forEach((item: any) => {
        const isComplete = isRatingComplete(item);
        items.push({
          ...item,
          type: isComplete ? 'rating' : 'draft',
          typeName: isComplete ? '待提交' : '待评分',
          typeColor: isComplete ? '#67c23a' : '#409eff',
        });
      });
    }

    // 被打回评价（用户创建的）
    if (rejectedRes.success && rejectedRes.data?.list) {
      rejectedRes.data.list.forEach((item: any) => {
        items.push({
          ...item,
          type: 'rejected',
          typeName: '待修改',
          typeColor: '#f56c6c',
        });
      });
    }

    todoItems.value = items.slice(0, 8);
  } catch (error) {
    console.error('获取待办事项失败:', error);
  } finally {
    todoLoading.value = false;
  }
}

// 获取最近动态
async function fetchRecentNotifications() {
  notificationsLoading.value = true;
  try {
    const res = await getNotifications({ pageSize: 6 });
    if (res.success) {
      recentNotifications.value = res.data?.list || [];
    }
  } catch (error) {
    console.error('获取最近动态失败:', error);
  } finally {
    notificationsLoading.value = false;
  }
}

// 通知类型映射
const notifyTypeMap: Record<string, { label: string; color: string }> = {
  EVALUATION_SUBMITTED: { label: '提交审核', color: '#e6a23c' },
  EVALUATION_APPROVED: { label: '审核通过', color: '#67c23a' },
  EVALUATION_REJECTED: { label: '审核驳回', color: '#f56c6c' },
  EVALUATION_ARCHIVED: { label: '已归档', color: '#909399' },
  ASSIGNED_AS_REVIEWER: { label: '分配审核', color: '#409eff' },
  DEADLINE_REMINDER: { label: '截止提醒', color: '#f56c6c' },
};

onMounted(() => {
  fetchStats();
  fetchTodoItems();
  fetchRecentNotifications();
});
</script>

<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6">
        <StatCard
          title="我的草稿"
          :value="stats.draftCount"
          :icon="Document"
          color="#409eff"
          @click="router.push('/evaluations?status=DRAFT')"
        />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard
          title="待审核"
          :value="stats.pendingCount"
          :icon="Check"
          color="#e6a23c"
          @click="router.push('/evaluations?status=SUBMITTED')"
        />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard
          title="已通过"
          :value="stats.approvedCount"
          :icon="Folder"
          color="#67c23a"
          @click="router.push('/evaluations?status=APPROVED')"
        />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard
          title="已归档"
          :value="stats.archivedCount"
          :icon="Folder"
          color="#909399"
          @click="router.push('/evaluations?status=ARCHIVED')"
        />
      </el-col>
    </el-row>

    <!-- 待办事项 + 最近动态 -->
    <div class="content-grid">
      <el-card class="section-card" v-loading="todoLoading">
        <template #header>
          <div class="section-header">
            <div class="section-title">
              <el-icon class="section-icon" color="#e6a23c"><Clock /></el-icon>
              <span>待办事项</span>
            </div>
          </div>
        </template>
        <div v-if="todoItems.length === 0 && !todoLoading" class="empty-state">
          <el-empty description="暂无待办事项" :image-size="80" />
        </div>
        <div v-else class="todo-list">
          <div
            v-for="item in todoItems"
            :key="`${item.type}-${item.id}`"
            class="todo-item"
            @click="router.push(`/evaluations/${item.id}`)"
          >
            <div class="todo-info">
              <div class="todo-title">
                <el-tag
                  :color="item.typeColor"
                  size="small"
                  effect="dark"
                  class="todo-type-tag"
                >
                  {{ item.typeName }}
                </el-tag>
                <span class="todo-title-text">{{ item.title }}</span>
              </div>
              <div class="todo-meta">
                <span class="todo-creator">
                  {{ item.creator?.realName || item.creator?.username }}
                </span>
                <span class="todo-time">
                  {{ formatRelativeTime(item.submittedAt || item.updatedAt) }}
                </span>
              </div>
            </div>
            <el-icon class="todo-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </el-card>

      <el-card class="section-card" v-loading="notificationsLoading">
        <template #header>
          <div class="section-header">
            <div class="section-title">
              <el-icon class="section-icon" color="#409eff"><Bell /></el-icon>
              <span>最近动态</span>
            </div>
            <el-button type="primary" link @click="router.push('/notifications')">
              查看全部 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </template>
        <div v-if="recentNotifications.length === 0 && !notificationsLoading" class="empty-state">
          <el-empty description="暂无最近动态" :image-size="80" />
        </div>
        <div v-else class="activity-list">
          <div
            v-for="item in recentNotifications"
            :key="item.id"
            class="activity-item"
            @click="router.push(`/notifications/${item.id}`)"
          >
            <div
              class="activity-dot"
              :style="{ backgroundColor: notifyTypeMap[item.type]?.color || '#909399' }"
            ></div>
            <div class="activity-content">
              <div class="activity-text">{{ item.title || item.content }}</div>
              <div class="activity-time">{{ formatRelativeTime(item.createdAt) }}</div>
            </div>
            <el-tag
              v-if="notifyTypeMap[item.type]"
              :color="notifyTypeMap[item.type]?.color"
              size="small"
              effect="dark"
              class="activity-tag"
            >
              {{ notifyTypeMap[item.type]?.label }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 快捷操作 -->
    <el-card class="quick-actions-card">
      <template #header>
        <div class="section-header">
          <div class="section-title">
            <el-icon class="section-icon" color="#67c23a"><Plus /></el-icon>
            <span>快捷操作</span>
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :xs="12" :sm="8" :lg="6">
          <div class="action-card" @click="router.push('/evaluations/create')">
            <div class="action-icon" style="background: linear-gradient(135deg, #409eff, #337ecc)">
              <el-icon :size="28"><Plus /></el-icon>
            </div>
            <div class="action-text">创建评价</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="6">
          <div class="action-card" @click="router.push('/evaluations')">
            <div class="action-icon" style="background: linear-gradient(135deg, #67c23a, #529b2e)">
              <el-icon :size="28"><List /></el-icon>
            </div>
            <div class="action-text">评价管理</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="6">
          <div class="action-card" @click="router.push('/reviews')">
            <div class="action-icon" style="background: linear-gradient(135deg, #e6a23c, #b88230)">
              <el-icon :size="28"><Stamp /></el-icon>
            </div>
            <div class="action-text">审核管理</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :lg="6">
          <div class="action-card" @click="router.push('/profile')">
            <div class="action-icon" style="background: linear-gradient(135deg, #909399, #73767a)">
              <el-icon :size="28"><User /></el-icon>
            </div>
            <div class="action-text">个人中心</div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stat-row {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.content-grid {
  flex: 1;
  min-height: 0;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* 区域卡片 */
.section-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-card :deep(.el-card__header) {
  flex-shrink: 0;
  padding: 16px 20px;
}

.section-card :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 0 20px 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.section-icon {
  font-size: 18px;
}

/* 待办事项 */
.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-item:hover {
  background-color: #f5f7fa;
  margin: 0 -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.todo-info {
  flex: 1;
  min-width: 0;
}

.todo-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
}

.todo-type-tag {
  flex-shrink: 0;
  border: none;
  font-size: 12px;
  height: 22px;
  line-height: 22px;
  padding: 0 8px;
}

.todo-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.todo-creator {
  color: #606266;
}

.todo-arrow {
  color: #c0c4cc;
  margin-left: 12px;
}

/* 最近动态 */
.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-item:hover {
  background-color: #f5f7fa;
  margin: 0 -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-text {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.activity-time {
  font-size: 12px;
  color: #909399;
}

.activity-tag {
  margin-left: 12px;
  flex-shrink: 0;
}

/* 空状态 */
.empty-state {
  padding: 20px 0;
}

/* 快捷操作 */
.quick-actions-card {
  flex-shrink: 0;
  margin-bottom: 0;
}

.quick-actions-card :deep(.el-card__header) {
  padding: 16px 20px;
}

.quick-actions-card :deep(.el-card__body) {
  padding: 0 20px 16px;
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fff;
  border: 1px solid #e4e7ed;
  margin-bottom: 8px;
  margin-top: 18px;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: transparent;
}

.action-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 12px;
  transition: transform 0.3s;
}

.action-card:hover .action-icon {
  transform: scale(1.1);
}

.action-text {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .dashboard {
    height: auto;
    overflow: visible;
  }

  .stat-row {
    margin-bottom: 12px;
  }

  .content-grid {
    grid-template-columns: 1fr;
    margin-bottom: 12px;
    flex: none;
  }

  .section-card {
    margin-bottom: 12px;
  }

  .section-card :deep(.el-card__body) {
    overflow: visible;
  }

  .action-card {
    padding: 16px 12px;
  }

  .action-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }
}
</style>
