<script setup lang="ts">
/**
 * 审核管理页面
 *
 * 功能:
 * 1. 展示当前用户作为评审人的评价列表
 * 2. 支持筛选：未审核（SUBMITTED）/ 已审核（APPROVED + ARCHIVED）
 * 3. 桌面端表格展示，移动端卡片展示
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getMyReviews } from '@/api/review';

const router = useRouter();

const reviews = ref<any[]>([]);
const loading = ref(false);
const isMobile = computed(() => window.innerWidth < 768);

// 筛选状态：pending=未审核, reviewed=已审核
const activeTab = ref<'pending' | 'reviewed'>('pending');

// 分页
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

const statusOptions: { label: string; value: 'pending' | 'reviewed' }[] = [
  { label: '未审核', value: 'pending' },
  { label: '已审核', value: 'reviewed' },
];

// 状态映射
const statusMap: Record<string, { label: string; type: string }> = {
  SUBMITTED: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  ARCHIVED: { label: '已归档', type: '' },
};

function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

async function fetchReviews() {
  loading.value = true;
  try {
    const res = await getMyReviews({
      status: activeTab.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    if (res.success) {
      reviews.value = res.data.list;
      pagination.value.total = res.data.total;
    }
  } catch (error) {
    console.error('获取审核列表失败:', error);
    ElMessage.error('获取审核列表失败');
  } finally {
    loading.value = false;
  }
}

function goToDetail(id: number) {
  router.push(`/evaluations/${id}`);
}

// 切换标签时重新获取数据
function handleTabChange() {
  pagination.value.page = 1;
  fetchReviews();
}

// 分页变化
function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchReviews();
}

onMounted(() => {
  fetchReviews();
});
</script>

<template>
  <div class="reviews-page">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <div class="filter-area">
        <!-- 桌面端 radio group -->
        <el-radio-group v-if="!isMobile" v-model="activeTab" @change="handleTabChange">
          <el-radio-button v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
        <!-- 手机端下拉 -->
        <el-select
          v-else
          v-model="activeTab"
          placeholder="筛选状态"
          @change="handleTabChange"
          style="width: 130px"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="total-count">共 {{ pagination.total }} 个审核</span>
      </div>
    </div>

    <div v-loading="loading">
      <!-- 空状态 -->
      <el-empty
        v-if="!loading && reviews.length === 0"
        :description="activeTab === 'pending' ? '暂无待审核的评价' : '暂无已审核的评价'"
      />

      <!-- 桌面端表格 -->
      <el-table v-else-if="!isMobile" :data="reviews" border stripe>
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="评价标题" min-width="200">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)">{{ row.title }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type as any" size="small">
              {{ statusMap[row.status]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建者" width="120">
          <template #default="{ row }">
            {{ row.creator?.realName || row.creator?.username }}
          </template>
        </el-table-column>
        <el-table-column label="被评价人数" width="120" align="center">
          <template #default="{ row }">
            {{ row._count?.participants || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.id)"> 详情 </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 手机端卡片列表 -->
      <div v-else class="card-list">
        <div
          v-for="item in reviews"
          :key="item.id"
          class="review-card"
          @click="goToDetail(item.id)"
        >
          <div class="card-top">
            <span class="card-id">#{{ item.id }}</span>
            <el-tag :type="statusMap[item.status]?.type as any" size="small" effect="plain">
              {{ statusMap[item.status]?.label }}
            </el-tag>
          </div>
          <h3 class="card-title">{{ item.title }}</h3>
          <div class="card-meta">
            <span>{{ item.creator?.realName || item.creator?.username }}</span>
            <span>{{ item._count?.participants || 0 }} 人</span>
            <span>{{ formatDate(item.submittedAt) }}</span>
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
.reviews-page {
  padding: 0;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.filter-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total-count {
  font-size: 14px;
  color: #909399;
  white-space: nowrap;
  margin-left: 8px;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.review-card:hover {
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
