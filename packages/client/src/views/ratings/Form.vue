<script setup lang="ts">
/**
 * 评分表单页面
 *
 * 功能:
 * 1. 展示评价的评分维度，每个维度可输入分数
 * 2. 支持填写评语
 * 3. 支持暂存（保存但不提交）和提交（确认提交不可修改）
 * 4. 已提交的评分只读展示
 *
 * 路由参数:
 * - id: RatingItem 的 ID
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRatingById, saveRating, submitRating } from '@/api/rating'

const route = useRoute()
const router = useRouter()

// 评分数据
const rating = ref<any>(null)
const loading = ref(false)
const submitting = ref(false)

// 评分表单：各维度分数
const scores = ref<Record<number, number>>({})
// 评语
const comment = ref('')

// 是否已提交（只读状态）
const isSubmitted = computed(() => rating.value?.status === 'SUBMITTED')

// 评价维度列表
const dimensions = computed(() => rating.value?.evaluation?.scoreDimensions || [])

// 计算加权总分
const weightedTotal = computed(() => {
  if (!dimensions.value.length) return 0
  let total = 0
  for (const dim of dimensions.value) {
    const score = scores.value[dim.id] ?? 0
    total += score * (dim.weight / 100)
  }
  return total.toFixed(2)
})

// 获取评分详情
async function fetchRating() {
  loading.value = true
  try {
    const id = Number(route.params.id)
    const res = await getRatingById(id)
    if (res.code === 200) {
      rating.value = res.data
      comment.value = res.data.comment || ''

      // 初始化已有分数
      const scoreMap: Record<number, number> = {}
      for (const dim of res.data.evaluation?.scoreDimensions || []) {
        const existing = res.data.dimensionScores?.find(
          (ds: any) => ds.dimensionId === dim.id
        )
        scoreMap[dim.id] = existing?.score ?? 0
      }
      scores.value = scoreMap
    }
  } catch (error) {
    console.error('获取评分详情失败:', error)
    ElMessage.error('获取评分详情失败')
  } finally {
    loading.value = false
  }
}

// 构建提交数据
function buildSubmitData() {
  return {
    comment: comment.value,
    scores: Object.entries(scores.value).map(([dimensionId, score]) => ({
      dimensionId: Number(dimensionId),
      score,
    })),
  }
}

// 暂存评分
async function handleSave() {
  try {
    const id = Number(route.params.id)
    const res = await saveRating(id, buildSubmitData())
    if (res.code === 200) {
      ElMessage.success('保存成功')
      fetchRating()
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

// 提交评分
async function handleSubmit() {
  // 验证所有维度都已评分
  for (const dim of dimensions.value) {
    const score = scores.value[dim.id]
    if (score === undefined || score === null || score === 0) {
      ElMessage.warning(`请为"${dim.name}"维度评分`)
      return
    }
    if (score > dim.maxScore) {
      ElMessage.warning(`"${dim.name}"的分数不能超过 ${dim.maxScore}`)
      return
    }
    if (score < 0) {
      ElMessage.warning(`"${dim.name}"的分数不能为负数`)
      return
    }
  }

  try {
    await ElMessageBox.confirm('提交后将无法修改，确认提交评分吗？', '提交确认', {
      type: 'warning',
    })
    submitting.value = true
    const id = Number(route.params.id)
    const res = await submitRating(id, buildSubmitData())
    if (res.code === 200) {
      ElMessage.success('提交成功')
      router.push('/ratings')
    }
  } catch {
    // 取消
  } finally {
    submitting.value = false
  }
}

// 返回列表
function handleBack() {
  router.push('/ratings')
}

onMounted(() => {
  fetchRating()
})
</script>

<template>
  <div class="rating-form-page" v-loading="loading">
    <template v-if="rating">
      <!-- 顶部信息 -->
      <el-card class="info-card">
        <div class="info-header">
          <div>
            <h2 class="title">{{ rating.evaluation?.title }}</h2>
            <p class="subtitle">
              被评价人：<strong>{{ rating.participant?.name }}</strong>
              <span v-if="rating.participant?.description" class="desc">
                （{{ rating.participant?.description }}）
              </span>
            </p>
          </div>
          <el-tag :type="isSubmitted ? 'success' : 'warning'" size="large">
            {{ isSubmitted ? '已提交' : rating.status === 'DRAFT' ? '已暂存' : '待评分' }}
          </el-tag>
        </div>
      </el-card>

      <!-- 评分维度 -->
      <el-card class="score-card">
        <template #header>
          <span class="section-title">评分维度</span>
        </template>

        <el-form label-width="120px">
          <el-form-item
            v-for="dim in dimensions"
            :key="dim.id"
            :label="dim.name"
          >
            <template #label>
              <div class="dim-label">
                <span>{{ dim.name }}</span>
                <span class="dim-weight">权重 {{ dim.weight }}%</span>
              </div>
            </template>
            <el-input-number
              v-model="scores[dim.id]"
              :min="0"
              :max="dim.maxScore"
              :disabled="isSubmitted"
              controls-position="right"
            />
            <span class="dim-hint">/ {{ dim.maxScore }} 分</span>
            <div v-if="dim.description" class="dim-desc">{{ dim.description }}</div>
          </el-form-item>

          <!-- 加权总分 -->
          <el-form-item label="加权总分">
            <span class="weighted-total">{{ weightedTotal }}</span>
          </el-form-item>

          <!-- 评语 -->
          <el-form-item label="评语">
            <el-input
              v-model="comment"
              type="textarea"
              :rows="4"
              :disabled="isSubmitted"
              placeholder="请输入评语（可选）"
              style="max-width: 600px"
            />
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <el-button @click="handleBack">返回列表</el-button>
        <div v-if="!isSubmitted" class="action-right">
          <el-button @click="handleSave" :loading="submitting">暂存</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">提交</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rating-form-page {
  padding: 0;
}

.info-card {
  margin-bottom: 20px;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.desc {
  color: #909399;
}

.score-card {
  margin-bottom: 20px;
}

.section-title {
  font-weight: 600;
}

.dim-label {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.dim-weight {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.dim-hint {
  margin-left: 8px;
  color: #909399;
}

.dim-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.weighted-total {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.action-right {
  display: flex;
  gap: 8px;
}
</style>
