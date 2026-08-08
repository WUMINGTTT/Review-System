<script setup lang="ts">
/**
 * 评价管理列表页面
 *
 * 设计说明:
 * - 桌面端表格展示，移动端卡片展示
 * - 操作栏展示详情按钮
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getEvaluations } from '@/api/evaluation';

const router = useRouter();
const route = useRoute();

const evaluations = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref((route.query.status as string) || '');
const isMobile = computed(() => window.innerWidth < 768);

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

const statusMap: Record<
  string,
  { label: string; type: 'info' | 'warning' | 'success' | 'danger' | undefined; color: string }
> = {
  DRAFT: { label: '草稿', type: 'info', color: '#909399' },
  SUBMITTED: { label: '待审核', type: 'warning', color: '#e6a23c' },
  APPROVED: { label: '已通过', type: 'success', color: '#67c23a' },
  REJECTED: { label: '已驳回', type: 'danger', color: '#f56c6c' },
  ARCHIVED: { label: '已归档', type: undefined, color: '#409eff' },
};

const statusOptions = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '待审核', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已归档', value: 'ARCHIVED' },
];

function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

async function fetchEvaluations() {
  loading.value = true;
  try {
    const res = await getEvaluations({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value || undefined,
    });
    if (res.success) {
      evaluations.value = res.data.list;
      pagination.value.total = res.data.total;
    }
  } catch (error) {
    console.error('获取评价列表失败:', error);
  } finally {
    loading.value = false;
  }
}

function handleStatusChange(val: string | number | boolean | undefined) {
  statusFilter.value = String(val || '');
  pagination.value.page = 1;
  fetchEvaluations();
}

function handlePageChange(page: number) {
  pagination.value.page = page;
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
      <div class="filter-area">
        <!-- 桌面端 radio group -->
        <el-radio-group v-if="!isMobile" v-model="statusFilter" @change="handleStatusChange">
          <el-radio-button v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <!-- 手机端下拉 -->
        <el-select v-else v-model="statusFilter" placeholder="筛选状态" clearable @change="handleStatusChange" style="width: 130px">
          <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>
      <el-button type="primary" @click="router.push('/evaluations/create')"> 创建评价 </el-button>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && evaluations.length === 0" description="暂无评价" />

    <!-- 桌面端表格 -->
    <el-table v-else-if="!isMobile" :data="evaluations" v-loading="loading" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="评价标题" min-width="180" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.type" size="small" effect="plain">
            {{ statusMap[row.status]?.label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建者" width="100">
        <template #default="{ row }">
          {{ row.creator?.realName || row.creator?.username }}
        </template>
      </el-table-column>
      <el-table-column label="被评价人数" width="100" align="center">
        <template #default="{ row }">
          {{ row._count?.participants || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link @click="goToDetail(row.id)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手机端卡片列表 -->
    <div v-else v-loading="loading" class="card-list">
      <div
        v-for="item in evaluations"
        :key="item.id"
        class="eval-card"
        @click="goToDetail(item.id)"
      >
        <div class="card-top">
          <span class="card-id">#{{ item.id }}</span>
          <el-tag :type="statusMap[item.status]?.type" size="small" effect="plain">
            {{ statusMap[item.status]?.label }}
          </el-tag>
        </div>
        <h3 class="card-title">{{ item.title }}</h3>
        <div class="card-meta">
          <span>{{ item.creator?.realName || item.creator?.username }}</span>
          <span>{{ item._count?.participants || 0 }} 人</span>
          <span>{{ formatDate(item.createdAt) }}</span>
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
.evaluations-page {
  padding: 0;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 手机端卡片列表 */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.eval-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.eval-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: #d0d5db;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.card-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.card-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}
</style>
