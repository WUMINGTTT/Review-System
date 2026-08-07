<script setup lang="ts">
/**
 * 我的评分页面
 *
 * 功能:
 * 1. 展示当前用户需要评分的评价列表
 * 2. 按评价活动分组，显示每个被评价人的评分状态
 * 3. 支持跳转到评分表单页面
 *
 * 状态说明:
 * - PENDING: 待评分（尚未开始）
 * - DRAFT: 已暂存（填写了部分分数）
 * - SUBMITTED: 已提交（不可修改）
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getMyRatings } from '@/api/rating'

const route = useRoute()
const router = useRouter()

// 评分数据
const ratings = ref<any[]>([])
const loading = ref(false)

// 状态映射
const statusMap: Record<
  string,
  { label: string; type: 'info' | 'warning' | 'success' | 'danger' | undefined }
> = {
  PENDING: { label: '待评分', type: 'info' },
  DRAFT: { label: '已暂存', type: 'warning' },
  SUBMITTED: { label: '已提交', type: 'success' },
}

// 按评价活动分组
const groupedRatings = computed(() => {
  const groups = new Map<number, { evaluation: any; items: any[] }>()
  for (const item of ratings.value) {
    const evalId = item.evaluationId
    if (!groups.has(evalId)) {
      groups.set(evalId, {
        evaluation: item.evaluation,
        items: [],
      })
    }
    groups.get(evalId)!.items.push(item)
  }
  return Array.from(groups.values())
})

// 统计每个评价的完成情况
function getCompletionInfo(items: any[]) {
  const total = items.length
  const submitted = items.filter((i) => i.status === 'SUBMITTED').length
  return { total, submitted, pending: total - submitted }
}

// 获取评分列表
async function fetchRatings() {
  loading.value = true
  try {
    const evaluationId = route.query.evaluationId
      ? Number(route.query.evaluationId)
      : undefined
    const res = await getMyRatings(evaluationId)
    // 兼容后端返回 { code: 200, data } 格式
    if (res.code === 200) {
      ratings.value = res.data
    }
  } catch (error) {
    console.error('获取评分列表失败:', error)
    ElMessage.error('获取评分列表失败')
  } finally {
    loading.value = false
  }
}

// 监听路由参数变化（从评价活动页点击"开始评分"时触发）
watch(() => route.query.evaluationId, () => {
  fetchRatings()
})

// 跳转到评分页面
function goToRating(ratingId: number) {
  router.push(`/ratings/${ratingId}`)
}

onMounted(() => {
  fetchRatings()
})
</script>

<template>
  <div class="ratings-page" v-loading="loading">
    <!-- 空状态 -->
    <el-empty v-if="!loading && groupedRatings.length === 0" description="暂无待评分的评价活动" />

    <!-- 按评价活动分组展示 -->
    <div v-for="group in groupedRatings" :key="group.evaluation.id" class="evaluation-group">
      <el-card class="group-card">
        <template #header>
          <div class="group-header">
            <div class="group-title">
              <span class="title-text">{{ group.evaluation.title }}</span>
              <el-tag size="small" type="success">已通过</el-tag>
            </div>
            <div class="group-stats">
              <el-tag size="small" type="info">
                待评分: {{ getCompletionInfo(group.items).pending }}
              </el-tag>
              <el-tag size="small" type="success">
                已提交: {{ getCompletionInfo(group.items).submitted }}
              </el-tag>
              <span class="total-text">共 {{ getCompletionInfo(group.items).total }} 项</span>
            </div>
          </div>
        </template>

        <el-table :data="group.items" border stripe>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column label="被评价人" min-width="120">
            <template #default="{ row }">
              {{ row.participant?.name }}
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="200">
            <template #default="{ row }">
              {{ row.participant?.description || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusMap[row.status]?.type" size="small">
                {{ statusMap[row.status]?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status !== 'SUBMITTED'"
                type="primary"
                link
                @click="goToRating(row.id)"
              >
                去评分
              </el-button>
              <el-button
                v-else
                type="info"
                link
                @click="goToRating(row.id)"
              >
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.ratings-page {
  padding: 0;
}

.evaluation-group {
  margin-bottom: 20px;
}

.evaluation-group:last-child {
  margin-bottom: 0;
}

.group-card :deep(.el-card__header) {
  padding: 16px 20px;
  background-color: #f5f7fa;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-size: 16px;
  font-weight: 600;
}

.group-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total-text {
  color: #909399;
  font-size: 13px;
}
</style>
