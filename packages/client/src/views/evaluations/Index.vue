<script setup lang="ts">
/**
 * 评价活动列表页面
 *
 * 设计说明:
 * - 使用卡片形式展示评价列表
 * - 卡片仅展示关键信息，点击整卡跳转详情
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getEvaluations } from '@/api/evaluation';

const router = useRouter();

const evaluations = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref('');

const statusMap: Record<
  string,
  { label: string; type: 'info' | 'warning' | 'success' | 'danger' | undefined }
> = {
  DRAFT: { label: '草稿', type: 'info' },
  SUBMITTED: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
  ARCHIVED: { label: '已归档', type: undefined },
};

function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

async function fetchEvaluations() {
  loading.value = true;
  try {
    const res = await getEvaluations({
      page: 1,
      pageSize: 100,
      status: statusFilter.value || undefined,
    });
    if (res.success) {
      evaluations.value = res.data.list;
    }
  } catch (error) {
    console.error('获取评价列表失败:', error);
  } finally {
    loading.value = false;
  }
}

function handleStatusChange(status: string | number | boolean | undefined) {
  statusFilter.value = String(status || '');
  fetchEvaluations();
}

function goToDetail(id: number) {
  router.push(`/evaluations/${id}`);
}

onMounted(() => {
  fetchEvaluations();
});
</script>

<template>
  <div class="evaluations-page">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <el-radio-group v-model="statusFilter" @change="handleStatusChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="DRAFT">草稿</el-radio-button>
        <el-radio-button value="SUBMITTED">待审核</el-radio-button>
        <el-radio-button value="APPROVED">已通过</el-radio-button>
        <el-radio-button value="REJECTED">已驳回</el-radio-button>
        <el-radio-button value="ARCHIVED">已归档</el-radio-button>
      </el-radio-group>
      <el-button type="primary" @click="router.push('/evaluations/create')"> 创建评价 </el-button>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && evaluations.length === 0" description="暂无评价活动" />

    <!-- 卡片列表 -->
    <div v-loading="loading" class="card-grid">
      <div
        v-for="item in evaluations"
        :key="item.id"
        class="eval-card"
        @click="goToDetail(item.id)"
      >
        <!-- 左侧色条 -->
        <div class="card-stripe" :class="`stripe-${item.status.toLowerCase()}`" />

        <div class="card-body">
          <!-- 标题行：ID + 标题 + 状态 -->
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-id">#{{ item.id }}</span>
              <h3 class="card-title">{{ item.title }}</h3>
            </div>
            <div class="header-tags">
              <el-tag
                v-if="item.status === 'DRAFT'"
                :type="item._count?.ratingItems > 0 ? 'success' : 'info'"
                size="small"
                effect="plain"
              >
                {{ item._count?.ratingItems > 0 ? '已评分' : '未评分' }}
              </el-tag>
              <el-tag :type="statusMap[item.status]?.type" size="small" effect="plain">
                {{ statusMap[item.status]?.label }}
              </el-tag>
            </div>
          </div>

          <!-- 描述 -->
          <p class="card-desc">{{ item.description || '暂无描述' }}</p>

          <!-- 底部信息 -->
          <div class="card-footer">
            <span class="footer-item">
              <span class="footer-label">创建者</span>
              <span class="footer-value">{{
                item.creator?.realName || item.creator?.username
              }}</span>
            </span>
            <span class="footer-item">
              <span class="footer-label">被评价人</span>
              <span class="footer-value">{{ item._count?.participants || 0 }} 人</span>
            </span>
            <span class="footer-item">
              <span class="footer-label">创建时间</span>
              <span class="footer-value">{{ formatDate(item.createdAt) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.evaluations-page {
  padding: 0;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 卡片容器 */
.eval-card {
  display: flex;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
}

.eval-card:hover {
  border-color: #c0c4cc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

/* 左侧状态色条 */
.card-stripe {
  width: 4px;
  flex-shrink: 0;
  background-color: #dcdfe6;
}

.stripe-draft {
  background-color: #909399;
}

.stripe-submitted {
  background-color: #e6a23c;
}

.stripe-approved {
  background-color: #67c23a;
}

.stripe-rejected {
  background-color: #f56c6c;
}

.stripe-archived {
  background-color: #409eff;
}

/* 卡片主体 */
.card-body {
  flex: 1;
  padding: 16px 20px;
  min-width: 0;
}

/* 标题行 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.card-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
  flex-shrink: 0;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 描述 */
.card-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 底部信息栏 */
.card-footer {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 13px;
}

.footer-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-label {
  color: #909399;
}

.footer-value {
  color: #606266;
  font-weight: 500;
}
</style>
