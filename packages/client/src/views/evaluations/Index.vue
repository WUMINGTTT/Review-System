<script setup lang="ts">
/**
 * 评价管理列表页面
 *
 * 设计说明:
 * - 使用表格形式展示评价列表
 * - 操作栏展示详情按钮
 */
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getEvaluations } from '@/api/evaluation';

const router = useRouter();
const route = useRoute();

const evaluations = ref<any[]>([]);
const loading = ref(false);
const statusFilter = ref((route.query.status as string) || '');

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
  return new Date(date).toLocaleString();
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
    <el-empty v-if="!loading && evaluations.length === 0" description="暂无评价" />

    <!-- 表格 -->
    <el-table v-else :data="evaluations" v-loading="loading" border stripe>
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
</style>
