<script setup lang="ts">
/**
 * 评价评分页面（独立页面）
 *
 * 功能:
 * 1. 加载评价详情（被评价人、评分维度）
 * 2. 为每个被评价人逐个打分
 * 3. 支持上一位/下一位切换
 * 4. 提交所有评分
 *
 * 路由参数:
 * - id: 评价活动 ID
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEvaluationById, submitRatings } from '@/api/evaluation'

const route = useRoute()
const router = useRouter()

// 评价数据
const evaluation = ref<any>(null)
const loading = ref(false)
const submitting = ref(false)

// 评价 ID
const evaluationId = computed(() => Number(route.params.id))

// 被评价人列表
const participants = computed(() => evaluation.value?.participants || [])

// 评分维度列表
const dimensions = computed(() => evaluation.value?.scoreDimensions || [])

// 当前正在评分的被评价人索引
const currentIndex = ref(0)

// 评分数据：每个被评价人对应一组维度分数和评语
const ratings = ref<{ participantId: number; scores: Record<number, number>; comment: string }[]>([])

// 当前被评价人
const currentParticipant = computed(() => participants.value[currentIndex.value])

// 当前评分数据
const currentRating = computed(() => ratings.value[currentIndex.value])

// 已完成评分的被评价人数量
const completedCount = computed(() => {
  return ratings.value.filter((r) =>
    dimensions.value.every((d: any) => {
      const score = r.scores[d.id]
      return score !== undefined && score > 0 && score <= d.maxScore
    })
  ).length
})

// 是否全部完成
const isAllComplete = computed(() => {
  return completedCount.value === participants.value.length
})

// 计算当前被评价人的加权总分
const currentWeightedTotal = computed(() => {
  if (!currentRating.value) return '0.00'
  let total = 0
  for (const dim of dimensions.value) {
    const score = currentRating.value.scores[dim.id] ?? 0
    total += score * (dim.weight / 100)
  }
  return total.toFixed(2)
})

// 初始化评分数据
function initRatings() {
  ratings.value = participants.value.map((p: any) => ({
    participantId: p.id,
    scores: {} as Record<number, number>,
    comment: '',
  }))
}

// 检查某个被评价人是否评分完成
function isParticipantComplete(index: number): boolean {
  const r = ratings.value[index]
  if (!r) return false
  return dimensions.value.every((d: any) => {
    const score = r.scores[d.id]
    return score !== undefined && score > 0 && score <= d.maxScore
  })
}

// 切换被评价人
function switchParticipant(index: number) {
  currentIndex.value = index
}

// 上一位
function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

// 下一位
function goNext() {
  if (currentIndex.value < participants.value.length - 1) {
    currentIndex.value++
  }
}

// 获取评价详情
async function fetchDetail() {
  loading.value = true
  try {
    const res = await getEvaluationById(evaluationId.value)
    if (res.success) {
      evaluation.value = res.data
      initRatings()
    }
  } catch (error) {
    console.error('获取评价详情失败:', error)
    ElMessage.error('获取评价详情失败')
  } finally {
    loading.value = false
  }
}

// 保存评分
async function handleSave() {
  submitting.value = true
  try {
    const data = ratings.value.map((r) => ({
      participantId: r.participantId,
      scores: dimensions.value.map((d: any) => ({
        dimensionId: d.id,
        score: r.scores[d.id],
      })),
      comment: r.comment || undefined,
    }))

    const res = await submitRatings(evaluationId.value, data)
    if (res.success) {
      ElMessage.success('评分已保存')
      router.push(`/evaluations/${evaluationId.value}`)
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<template>
  <div class="rate-page" v-loading="loading">
    <template v-if="evaluation">
      <!-- 顶部信息 -->
      <div class="rate-header">
        <div class="header-left">
          <h2 class="title">{{ evaluation.title }}</h2>
        </div>
        <div class="header-right">
          <span class="progress-text">
            已完成 {{ completedCount }} / {{ participants.length }}
          </span>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleSave"
          >
            保存评分
          </el-button>
        </div>
      </div>

      <!-- 被评价人标签栏 -->
      <div class="participant-tabs">
        <div
          v-for="(p, index) in participants"
          :key="p.id"
          class="tab-item"
          :class="{
            active: currentIndex === index,
            complete: isParticipantComplete(index),
          }"
          @click="switchParticipant(index)"
        >
          <span class="tab-index">{{ index + 1 }}</span>
          <span class="tab-name">{{ p.name }}</span>
        </div>
      </div>

      <!-- 评分区域 -->
      <div v-if="currentRating" class="rating-area">
        <!-- 被评价人信息 -->
        <div class="participant-info">
          <h3>
            正在为 <strong>{{ currentParticipant?.name }}</strong> 评分
          </h3>
          <p v-if="currentParticipant?.description" class="desc">
            {{ currentParticipant.description }}
          </p>
        </div>

        <!-- 评分表单 -->
        <el-card class="rating-card">
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
                v-model="currentRating.scores[dim.id]"
                :min="0"
                :max="dim.maxScore"
                controls-position="right"
              />
              <span class="dim-hint">/ {{ dim.maxScore }} 分</span>
              <span v-if="dim.description" class="dim-desc">{{ dim.description }}</span>
            </el-form-item>

            <!-- 加权总分 -->
            <el-form-item label="加权总分">
              <span class="weighted-total">{{ currentWeightedTotal }}</span>
            </el-form-item>

            <!-- 评语 -->
            <el-form-item label="评语">
              <el-input
                v-model="currentRating.comment"
                type="textarea"
                :rows="3"
                placeholder="请输入评语（可选）"
                style="max-width: 500px"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 导航按钮 -->
        <div class="nav-bar">
          <el-button :disabled="currentIndex === 0" @click="goPrev">
            上一位
          </el-button>
          <span class="nav-info">
            {{ currentIndex + 1 }} / {{ participants.length }}
          </span>
          <el-button :disabled="currentIndex >= participants.length - 1" @click="goNext">
            下一位
          </el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rate-page {
  padding: 0;
}

.rate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left .title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.progress-text {
  font-size: 14px;
  color: #606266;
}

/* 被评价人标签栏 */
.participant-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.tab-item:hover {
  border-color: #409eff;
  color: #409eff;
}

.tab-item.active {
  background-color: #409eff;
  border-color: #409eff;
  color: #fff;
}

.tab-item.complete {
  border-color: #67c23a;
  color: #67c23a;
}

.tab-item.complete.active {
  background-color: #67c23a;
  border-color: #67c23a;
  color: #fff;
}

.tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f0f0f0;
  font-size: 12px;
  font-weight: bold;
}

.tab-item.active .tab-index {
  background-color: rgba(255, 255, 255, 0.3);
}

.tab-item.complete .tab-index {
  background-color: #67c23a;
  color: #fff;
}

.tab-item.complete.active .tab-index {
  background-color: rgba(255, 255, 255, 0.3);
}

/* 评分区域 */
.rating-area {
  max-width: 700px;
}

.participant-info {
  margin-bottom: 20px;
}

.participant-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: normal;
}

.participant-info .desc {
  margin: 0;
  color: #909399;
  font-size: 13px;
}

.rating-card {
  margin-bottom: 20px;
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
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.weighted-total {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

/* 导航栏 */
.nav-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.nav-info {
  font-size: 14px;
  color: #909399;
}
</style>
