<script setup lang="ts">
/**
 * 管理员评价管理页面
 *
 * 功能:
 * 1. 展示所有状态的所有评价
 * 2. 列表展示，分页显示
 * 3. 提供搜索与状态分类筛选
 * 4. 点击详情跳转到评价详情页
 * 5. 可删除评价（唯一操作项）
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getEvaluations, adminDeleteEvaluation } from '@/api/evaluation';

const router = useRouter();
const isMobile = computed(() => window.innerWidth < 768);

const evaluations = ref<any[]>([]);
const loading = ref(false);

const pagination = ref({
  page: 1,
  pageSize: 15,
  total: 0,
});

const keyword = ref('');
const statusFilter = ref('');

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
      keyword: keyword.value || undefined,
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

function handleSearch() {
  pagination.value.page = 1;
  fetchEvaluations();
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

async function handleDelete(evaluation: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除评价"${evaluation.title}"吗？此操作不可恢复。`,
      '删除确认',
      {
        type: 'error',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
      },
    );
    const res = await adminDeleteEvaluation(evaluation.id);
    if (res.success) {
      ElMessage.success('删除成功');
      fetchEvaluations();
    }
  } catch {
    // 取消
  }
}

onMounted(() => {
  fetchEvaluations();
});
</script>

<template>
  <div class="admin-evaluations-page">
    <!-- 顶部筛选栏 -->
    <div class="top-bar">
      <div class="filter-area">
        <el-input
          v-model="keyword"
          placeholder="搜索评价标题、描述"
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
        <!-- 桌面端 radio group -->
        <el-radio-group v-if="!isMobile" v-model="statusFilter" @change="handleStatusChange">
          <el-radio-button v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <!-- 手机端下拉 -->
        <el-select
          v-else
          v-model="statusFilter"
          placeholder="筛选状态"
          clearable
          @change="handleStatusChange"
          style="width: 130px"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="total-count">共 {{ pagination.total }} 个评价</span>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!loading && evaluations.length === 0" description="暂无评价" />

    <!-- 桌面端表格 -->
    <el-table v-else-if="!isMobile" :data="evaluations" v-loading="loading" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="评价标题" min-width="200" show-overflow-tooltip />
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
      <el-table-column label="审核者数" width="90" align="center">
        <template #default="{ row }">
          {{ row._count?.reviewers || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link @click="goToDetail(row.id)">详情</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手机端卡片列表 -->
    <div v-else v-loading="loading" class="card-list">
      <div v-for="item in evaluations" :key="item.id" class="eval-card">
        <div class="card-top" @click="goToDetail(item.id)">
          <div class="card-info">
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
        <div class="card-actions">
          <el-button type="primary" link size="small" @click="goToDetail(item.id)">详情</el-button>
          <el-button type="danger" link size="small" @click="handleDelete(item)">删除</el-button>
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
.admin-evaluations-page {
  padding: 0;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.total-count {
  font-size: 14px;
  color: #909399;
  white-space: nowrap;
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
  transition: all 0.2s ease;
}

.eval-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: #d0d5db;
}

.card-top {
  cursor: pointer;
  margin-bottom: 10px;
}

.card-info {
  display: flex;
  align-items: center;
  gap: 8px;
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

.card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  height: 30px;
}

/* ========== 响应式 ========== */
@media (max-width: 767px) {
  .top-bar {
    margin-bottom: 16px;
  }

  .top-bar :deep(.el-input) {
    width: 100% !important;
  }

  .filter-area {
    width: 100%;
  }
}
</style>
