<script setup lang="ts">
/**
 * 通知详情页面
 *
 * 功能:
 * 1. 展示通知详细信息
 * 2. 如果有关联评价，展示评价简略信息
 * 3. 提供跳转到评价详情的按钮
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getNotificationById } from '@/api/notification';
import { getEvaluationById } from '@/api/evaluation';

const route = useRoute();
const router = useRouter();

const notification = ref<any>(null);
const evaluation = ref<any>(null);
const loading = ref(false);
const evalLoading = ref(false);

const notificationId = computed(() => Number(route.params.id));

// 通知类型映射
const typeMap: Record<string, { label: string; color: string }> = {
  EVALUATION_SUBMITTED: { label: '已提交', color: '#e6a23c' },
  EVALUATION_APPROVED: { label: '已通过', color: '#67c23a' },
  EVALUATION_REJECTED: { label: '已驳回', color: '#f56c6c' },
  EVALUATION_ARCHIVED: { label: '已归档', color: '#909399' },
  ASSIGNED_AS_REVIEWER: { label: '审核分配', color: '#409eff' },
  DEADLINE_REMINDER: { label: '截止提醒', color: '#e6a23c' },
};

// 评价状态映射
const statusMap: Record<string, { label: string; type: string }> = {
  DRAFT: { label: '草稿', type: 'info' },
  SUBMITTED: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
  ARCHIVED: { label: '已归档', type: '' },
};

// 评价是否可以查看详情
const canViewEvaluation = computed(() => {
  if (!evaluation.value) return false;
  const status = evaluation.value.status;
  return status === 'SUBMITTED' || status === 'APPROVED' || status === 'ARCHIVED';
});

// 格式化时间
function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

// 获取通知详情
async function fetchNotification() {
  loading.value = true;
  try {
    const res = await getNotificationById(notificationId.value);
    if (res.success) {
      notification.value = res.data;
      // 如果有关联评价，获取评价信息
      if (res.data.relatedId) {
        fetchEvaluation(res.data.relatedId);
      }
    }
  } catch (error) {
    console.error('获取通知详情失败:', error);
    ElMessage.error('获取通知详情失败');
  } finally {
    loading.value = false;
  }
}

// 获取关联评价信息
async function fetchEvaluation(evalId: number) {
  evalLoading.value = true;
  try {
    const res = await getEvaluationById(evalId);
    if (res.success) {
      evaluation.value = res.data;
    }
  } catch (error) {
    // 评价不可见时静默处理
    console.log('评价暂不可查看');
  } finally {
    evalLoading.value = false;
  }
}

// 跳转到评价详情
function goToEvaluation() {
  if (evaluation.value) {
    router.push(`/evaluations/${evaluation.value.id}`);
  }
}

onMounted(() => {
  fetchNotification();
});
</script>

<template>
  <div class="notification-detail" v-loading="loading">
    <!-- 通知信息卡片 -->
    <el-card v-if="notification" class="detail-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">通知详情</span>
          <el-tag
            v-if="typeMap[notification.type]"
            :color="typeMap[notification.type].color"
            effect="dark"
            size="small"
            style="border: none"
          >
            {{ typeMap[notification.type].label }}
          </el-tag>
        </div>
      </template>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">标题</span>
          <span class="info-value">{{ notification.title }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">时间</span>
          <span class="info-value">{{ formatDate(notification.createdAt) }}</span>
        </div>
        <div class="info-item full-width">
          <span class="info-label">内容</span>
          <span class="info-value">{{ notification.content }}</span>
        </div>
      </div>
    </el-card>

    <!-- 关联评价信息 -->
    <el-card v-if="notification?.relatedId" class="detail-card" style="margin-top: 20px">
      <template #header>
        <span class="card-title">关联评价</span>
      </template>

      <div v-loading="evalLoading">
        <!-- 评价可查看 -->
        <div v-if="evaluation" class="eval-preview">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">评价标题</span>
              <span class="info-value">{{ evaluation.title }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <span class="info-value">
                <el-tag :type="statusMap[evaluation.status]?.type as any" size="small">
                  {{ statusMap[evaluation.status]?.label }}
                </el-tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">创建者</span>
              <span class="info-value">{{
                evaluation.creator?.realName || evaluation.creator?.username
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">被评价人数</span>
              <span class="info-value">{{ evaluation.participants?.length || 0 }} 人</span>
            </div>
          </div>

          <div class="eval-actions">
            <el-button v-if="canViewEvaluation" type="primary" @click="goToEvaluation">
              前往评价详情
            </el-button>
            <el-alert
              v-else
              title="评价暂未提交审核，无法查看详情"
              type="info"
              show-icon
              :closable="false"
            />
          </div>
        </div>

        <!-- 评价不可查看 -->
        <el-empty v-else-if="!evalLoading" description="评价无法查看" />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.notification-detail {
  max-width: 800px;
  margin: 0 auto;
}

.detail-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item.full-width {
  grid-column: 1 / -1;
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

.eval-preview {
  margin-top: 8px;
}

.eval-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.back-actions {
  margin-top: 20px;
  text-align: center;
}

@media (max-width: 767px) {
  .info-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
