<script setup lang="ts">
/**
 * 工作台页面
 *
 * 功能:
 * 1. 显示统计卡片（评价总数、待评分、待审核、已完成）
 * 2. 快捷操作按钮
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getDashboardStats } from '@/api/stats';
import StatCard from '@/components/StatCard.vue';
import { Document, Check, Folder } from '@element-plus/icons-vue';

const router = useRouter();

// 统计数据
const stats = ref({
  draftCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  archivedCount: 0,
});

const loading = ref(false);

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

// 页面加载时获取数据
onMounted(() => {
  fetchStats();
});
</script>

<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :xs="12" :sm="6">
        <StatCard
          title="我的草稿"
          :value="stats.draftCount"
          :icon="Document"
          color="#409eff"
        />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard title="待审核" :value="stats.pendingCount" :icon="Check" color="#e6a23c" />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard title="已通过" :value="stats.approvedCount" :icon="Folder" color="#67c23a" />
      </el-col>
      <el-col :xs="12" :sm="6">
        <StatCard title="已归档" :value="stats.archivedCount" :icon="Folder" color="#909399" />
      </el-col>
    </el-row>

    <!-- 快捷操作 -->
    <el-card class="quick-actions">
      <template #header>
        <span>快捷操作</span>
      </template>
      <el-space wrap>
        <el-button type="primary" @click="router.push('/evaluations/create')"> 创建评价 </el-button>
        <el-button @click="router.push('/evaluations')"> 查看评价 </el-button>
        <el-button @click="router.push('/ratings')"> 我的评分 </el-button>
        <el-button @click="router.push('/reviews')"> 审核管理 </el-button>
      </el-space>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 0;
}

.stat-row {
  margin-bottom: 20px;
}

.quick-actions {
  margin-top: 20px;
}
</style>
