<script setup lang="ts">
/**
 * 审核管理页面
 *
 * 功能:
 * 1. 展示当前用户作为评审人需要审核的评价列表
 * 2. 点击详情跳转评价详情页进行审核操作
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getMyReviews } from '@/api/review';

const router = useRouter();

// 审核列表
const reviews = ref<any[]>([]);
const loading = ref(false);

// 格式化日期
function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

// 获取待审核列表
async function fetchReviews() {
  loading.value = true;
  try {
    const res = await getMyReviews();
    if (res.success) {
      reviews.value = res.data;
    }
  } catch (error) {
    console.error('获取待审核列表失败:', error);
    ElMessage.error('获取待审核列表失败');
  } finally {
    loading.value = false;
  }
}

// 查看评价详情
function goToDetail(id: number) {
  router.push(`/evaluations/${id}`);
}

onMounted(() => {
  fetchReviews();
});
</script>

<template>
  <div class="reviews-page" v-loading="loading">
    <!-- 空状态 -->
    <el-empty v-if="!loading && reviews.length === 0" description="暂无待审核的评价" />

    <!-- 审核列表 -->
    <el-table v-else :data="reviews" border stripe>
      <el-table-column type="index" label="序号" width="60" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="评价标题" min-width="200">
        <template #default="{ row }">
          <el-button type="primary" link @click="goToDetail(row.id)">
            {{ row.title }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="组织者" width="120">
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
  </div>
</template>

<style scoped>
.reviews-page {
  padding: 0;
}
</style>
