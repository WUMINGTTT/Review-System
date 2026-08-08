<script setup lang="ts">
/**
 * 评价评分页面（独立页面）
 *
 * 功能:
 * 1. 左侧：评分表单（被评价人标签栏 + 维度分数输入 + 底部固定导航）
 * 2. 右侧：评分总览（实时显示所有被评价人各维度分数和加权总分）
 * 3. 加载已有评分数据，支持中途保存
 *
 * 路由参数:
 * - id: 评价活动 ID
 */
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getEvaluationById, submitRatings } from '@/api/evaluation';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// 评价数据
const evaluation = ref<any>(null);
const loading = ref(false);
const submitting = ref(false);

// 评价 ID
const evaluationId = computed(() => Number(route.params.id));

// 被评价人列表
const participants = computed(() => evaluation.value?.participants || []);

// 评分维度列表
const dimensions = computed(() => evaluation.value?.scoreDimensions || []);

// 当前正在评分的被评价人索引
const currentIndex = ref(0);

// 被评价人标签栏容器 ref（用于滚动当前选中项到可见位置）
const tabsContainerRef = ref<HTMLElement | null>(null);

// 评分数据：每个被评价人对应一组维度分数和评语
const ratings = ref<{ participantId: number; scores: Record<number, number>; comment: string }[]>(
  [],
);

// 当前被评价人
const currentParticipant = computed(() => participants.value[currentIndex.value]);

// 当前评分数据
const currentRating = computed(() => ratings.value[currentIndex.value]);

// 已完成评分的被评价人数量（所有维度都有 >0 的分数）
const completedCount = computed(() => {
  return ratings.value.filter((r) =>
    dimensions.value.every((d: any) => {
      const score = r.scores[d.id];
      return score !== undefined && score > 0 && score <= d.maxScore;
    }),
  ).length;
});

// 计算当前被评价人的加权总分
const currentWeightedTotal = computed(() => {
  if (!currentRating.value) return '0.00';
  let total = 0;
  for (const dim of dimensions.value) {
    const score = currentRating.value.scores[dim.id] ?? 0;
    total += score * (dim.weight / 100);
  }
  return total.toFixed(2);
});

// 计算每个被评价人的加权总分（供右侧总览使用）
function calcWeightedTotal(rating: { scores: Record<number, number> }) {
  let total = 0;
  for (const dim of dimensions.value) {
    total += (rating.scores[dim.id] ?? 0) * (dim.weight / 100);
  }
  return total.toFixed(2);
}

// 获取各被评价人的评分完成情况
function getParticipantScore(dimId: number, participantId: number): number | string {
  const rating = ratings.value.find((r) => r.participantId === participantId);
  if (!rating) return '-';
  const score = rating.scores[dimId];
  return score !== undefined && score > 0 ? score : '-';
}

// 初始化评分数据：尝试从已有评分记录恢复
function initRatings() {
  const existingItems = evaluation.value?.ratingItems || [];
  const myItems = existingItems.filter((r: any) => r.reviewerId === userStore.userInfo?.id);

  ratings.value = participants.value.map((p: any) => {
    const existing = myItems.find((r: any) => r.participantId === p.id);
    if (existing && existing.dimensionScores) {
      const scores: Record<number, number> = {};
      for (const ds of existing.dimensionScores) {
        scores[ds.dimensionId] = ds.score;
      }
      return {
        participantId: p.id,
        scores,
        comment: existing.comment || '',
      };
    }
    return {
      participantId: p.id,
      scores: {} as Record<number, number>,
      comment: '',
    };
  });
}

// 检查某个被评价人是否评分完成
function isParticipantComplete(index: number): boolean {
  const r = ratings.value[index];
  if (!r) return false;
  return dimensions.value.every((d: any) => {
    const score = r.scores[d.id];
    return score !== undefined && score > 0 && score <= d.maxScore;
  });
}

// 滚动当前选中的标签到可见位置
function scrollTabIntoView() {
  nextTick(() => {
    const container = tabsContainerRef.value;
    if (!container) return;
    const activeTab = container.querySelector('.tab-item.active') as HTMLElement | null;
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  });
}

// 切换被评价人
function switchParticipant(index: number) {
  currentIndex.value = index;
  scrollTabIntoView();
}

// 上一位
function goPrev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    scrollTabIntoView();
  }
}

// 下一位
function goNext() {
  if (currentIndex.value < participants.value.length - 1) {
    currentIndex.value++;
    scrollTabIntoView();
  }
}

// 获取评价详情
async function fetchDetail() {
  loading.value = true;
  try {
    const res = await getEvaluationById(evaluationId.value);
    if (res.success) {
      evaluation.value = res.data;
      initRatings();
    }
  } catch (error) {
    console.error('获取评价详情失败:', error);
    ElMessage.error('获取评价详情失败');
  } finally {
    loading.value = false;
  }
}

// 保存评分
async function handleSave() {
  submitting.value = true;
  try {
    const data = ratings.value.map((r) => ({
      participantId: r.participantId,
      scores: dimensions.value.map((d: any) => ({
        dimensionId: d.id,
        score: r.scores[d.id] ?? 0,
      })),
      comment: r.comment || undefined,
    }));

    const res = await submitRatings(evaluationId.value, data);
    if (res.success) {
      ElMessage.success('评分已保存');
      router.push(`/evaluations/${evaluationId.value}`);
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchDetail();
});
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
          <el-button type="primary" :loading="submitting" @click="handleSave"> 保存评分 </el-button>
        </div>
      </div>

      <!-- 被评价人标签栏（单行横向滚动，跨整行） -->
      <div ref="tabsContainerRef" class="participant-tabs">
        <div
          v-for="(p, index) in participants"
          :key="p.id"
          class="tab-item"
          :class="{
            active: currentIndex === Number(index),
            complete: isParticipantComplete(Number(index)),
          }"
          @click="switchParticipant(Number(index))"
        >
          <span class="tab-index">{{ Number(index) + 1 }}</span>
          <span class="tab-name">{{ p.name }}</span>
        </div>
      </div>

      <!-- 左右两栏布局 -->
      <div class="rate-layout">
        <!-- 左侧：评分表单 -->
        <div class="rate-left">
          <!-- 评分表单卡片（内部滚动） -->
          <div v-if="currentRating" class="rating-area">
            <div class="participant-info">
              <h3>
                正在为 <strong>{{ currentParticipant?.name }}</strong> 评分：
              </h3>
              <p v-if="currentParticipant?.description" class="desc">
                {{ currentParticipant.description }}
              </p>
            </div>

            <div class="rating-form-body">
              <el-form label-width="120px">
                <el-form-item v-for="dim in dimensions" :key="dim.id" :label="dim.name">
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
                  <span class="dim-hint">/{{ dim.maxScore }}分</span>
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
                  />
                </el-form-item>
              </el-form>
            </div>
          </div>

          <!-- 导航按钮（始终固定在左侧底部） -->
          <div class="nav-bar">
            <el-button :disabled="currentIndex === 0" @click="goPrev"> 上一位 </el-button>
            <span class="nav-info"> {{ currentIndex + 1 }} / {{ participants.length }} </span>
            <el-button :disabled="currentIndex >= participants.length - 1" @click="goNext">
              下一位
            </el-button>
          </div>
        </div>

        <!-- 右侧：评分总览 -->
        <div class="rate-right">
          <el-card class="summary-card">
            <template #header>
              <span class="section-title">评分总览</span>
            </template>
            <div class="summary-table-wrapper">
              <el-table :data="participants" border stripe size="small" max-height="100%">
                <el-table-column type="index" label="#" width="40" />
                <el-table-column prop="name" label="被评价人" min-width="80" />
                <el-table-column
                  v-for="dim in dimensions"
                  :key="dim.id"
                  :label="dim.name"
                  width="70"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ getParticipantScore(dim.id, row.id) }}
                  </template>
                </el-table-column>
                <el-table-column label="总分" width="70" align="center">
                  <template #default="{ row }">
                    <span class="summary-total">
                      {{
                        calcWeightedTotal(
                          ratings.find((r) => r.participantId === row.id) || { scores: {} },
                        )
                      }}
                    </span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ========== 页面整体 ========== */
.rate-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
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

/* ========== 被评价人标签栏（整行跨域，单行横向滚动） ========== */
.participant-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
  flex-shrink: 0;
  padding-bottom: 4px;
  margin-bottom: 12px;
  scroll-behavior: smooth;
}

.participant-tabs::-webkit-scrollbar {
  height: 4px;
}
.participant-tabs::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 2px;
}

/* ========== 左右两栏布局 ========== */
.rate-layout {
  flex: 1;
  display: flex;
  gap: 20px;
  min-height: 0;
  overflow: hidden;
}

.rate-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rate-right {
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  flex-shrink: 0;
  white-space: nowrap;
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

/* ========== 评分表单区域（卡片式，内部滚动） ========== */
.rating-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
}

.rating-area::-webkit-scrollbar {
  width: 6px;
}
.rating-area::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 3px;
}

.participant-info {
  margin-bottom: 16px;
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
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
}

.weighted-total {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

/* ========== 导航栏（固定在左侧底部） ========== */
.nav-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  margin-top: 12px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  flex-shrink: 0;
}

.nav-info {
  font-size: 14px;
  color: #909399;
}

/* ========== 右侧总览 ========== */
.summary-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.summary-card :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.summary-table-wrapper {
  flex: 1;
  overflow: auto;
}

.section-title {
  font-weight: 600;
}

.summary-total {
  font-weight: 600;
  color: #409eff;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .rate-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .rate-layout {
    flex-direction: column;
  }

  .rate-left {
    overflow: visible;
  }

  .rating-area {
    overflow: visible;
    flex: none;
  }

  .rate-right {
    width: 100%;
    overflow: visible;
  }

  .summary-card {
    flex: none;
  }
}
</style>
