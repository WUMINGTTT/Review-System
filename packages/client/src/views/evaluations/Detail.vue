<script setup lang="ts">
/**
 * 评价详情页
 *
 * 功能:
 * 1. 展示评价活动的完整信息（基本信息、被评价人、评审人、评分维度）
 * 2. 根据当前用户角色和评价状态显示不同的操作按钮
 * 3. 支持提交、审核通过、打回、归档等操作
 *
 * 权限逻辑:
 * - 创建者（组织者）：可评分(DRAFT)、提交(DRAFT/REJECTED)、删除(DRAFT)
 * - 评审人：可审核通过(SUBMITTED)、打回(SUBMITTED)、归档(APPROVED)
 * - 管理员：可归档(APPROVED)
 */
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import {
  getEvaluationById,
  deleteEvaluation,
  submitEvaluation,
  approveEvaluation,
  rejectEvaluation,
  archiveEvaluation,
} from '@/api/evaluation';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// 评价数据
const evaluation = ref<any>(null);
const loading = ref(false);

// 打回弹窗
const rejectDialogVisible = ref(false);
const rejectReason = ref('');

// 评价 ID
const evaluationId = computed(() => Number(route.params.id));

// 当前用户 ID
const currentUserId = computed(() => userStore.userInfo?.id);

// 当前用户角色（store 中已统一处理为数组）
const currentUserRoles = computed<string[]>(() => {
  return userStore.userInfo?.roles || [];
});

// 判断当前用户是否是管理员
const isAdmin = computed(() => currentUserRoles.value.includes('admin'));

// 判断当前用户是否是创建者
const isCreator = computed(() => evaluation.value?.createdBy === currentUserId.value);

// 判断当前用户是否是评审人
const isReviewer = computed(() => {
  if (!evaluation.value?.reviewers) return false;
  return evaluation.value.reviewers.some((r: any) => r.reviewerId === currentUserId.value);
});

// 判断是否有可用操作
const hasActions = computed(() => {
  if (!evaluation.value) return false;
  const status = evaluation.value.status;
  // 创建者在 DRAFT/REJECTED 状态有操作
  if (isCreator.value && (status === 'DRAFT' || status === 'REJECTED')) return true;
  // 评审人在 SUBMITTED/APPROVED 状态有操作
  if (isReviewer.value && (status === 'SUBMITTED' || status === 'APPROVED')) return true;
  // 管理员在 APPROVED 状态有归档操作
  if (isAdmin.value && status === 'APPROVED' && !isReviewer.value) return true;
  return false;
});

// 判断是否已为所有被评价人评分
const isAllRated = computed(() => {
  if (!evaluation.value) return false;
  const participants = evaluation.value.participants || [];
  const ratingItems = evaluation.value.ratingItems || [];
  if (participants.length === 0) return false;
  // 当前用户（创建者）的评分记录
  const myRatings = ratingItems.filter((r: any) => r.reviewerId === currentUserId.value);
  // 每个被评价人都需要有对应的评分记录
  return participants.every((p: any) => myRatings.some((r: any) => r.participantId === p.id));
});

// 评分总览数据：每个被评价人的各维度分数和加权总分
const scoreSummary = computed(() => {
  if (!evaluation.value) return [];
  const participants = evaluation.value.participants || [];
  const ratingItems = evaluation.value.ratingItems || [];
  const dimensions = evaluation.value.scoreDimensions || [];

  return participants.map((p: any) => {
    const rating = ratingItems.find((r: any) => r.participantId === p.id);
    if (!rating) {
      return { name: p.name, scores: {}, total: '0.00', comment: '-' };
    }

    const scores: Record<number, number> = {};
    let total = 0;
    for (const ds of rating.dimensionScores || []) {
      scores[ds.dimensionId] = ds.score;
      const dim = dimensions.find((d: any) => d.id === ds.dimensionId);
      if (dim) {
        total += ds.score * (dim.weight / 100);
      }
    }

    return {
      name: p.name,
      scores,
      total: total.toFixed(2),
      comment: rating.comment || '-',
    };
  });
});

// 状态映射
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

// 可见性映射
const visibilityMap: Record<string, string> = {
  PUBLIC: '公开',
  PRIVATE: '隐藏',
};

// 格式化日期
function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return new Date(date).toLocaleString();
}

// 获取评价详情
async function fetchDetail() {
  loading.value = true;
  try {
    const res = await getEvaluationById(evaluationId.value);
    if (res.success) {
      evaluation.value = res.data;
    }
  } catch (error) {
    console.error('获取评价详情失败:', error);
    ElMessage.error('获取评价详情失败');
  } finally {
    loading.value = false;
  }
}

// 提交评价
async function handleSubmit() {
  try {
    await ElMessageBox.confirm('确定要提交此评价吗？提交后将进入审核流程。', '提交确认', {
      type: 'info',
    });
    const res = await submitEvaluation(evaluationId.value);
    if (res.success) {
      ElMessage.success('提交成功');
      fetchDetail();
    }
  } catch {
    // 取消
  }
}

// 审核通过
async function handleApprove() {
  try {
    await ElMessageBox.confirm('确定要审核通过此评价吗？', '审核确认', {
      type: 'success',
    });
    const res = await approveEvaluation(evaluationId.value);
    if (res.success) {
      ElMessage.success('审核通过');
      fetchDetail();
    }
  } catch {
    // 取消
  }
}

// 打开打回弹窗
function openRejectDialog() {
  rejectReason.value = '';
  rejectDialogVisible.value = true;
}

// 确认打回
async function handleReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写打回原因');
    return;
  }
  try {
    const res = await rejectEvaluation(evaluationId.value, rejectReason.value.trim());
    if (res.success) {
      ElMessage.success('已打回');
      rejectDialogVisible.value = false;
      fetchDetail();
    }
  } catch (error) {
    console.error('打回失败:', error);
  }
}

// 归档
async function handleArchive() {
  try {
    await ElMessageBox.confirm('确定要归档此评价吗？归档后数据将变为只读。', '归档确认', {
      type: 'warning',
    });
    const res = await archiveEvaluation(evaluationId.value);
    if (res.success) {
      ElMessage.success('归档成功');
      fetchDetail();
    }
  } catch {
    // 取消
  }
}

// 删除评价
async function handleDelete() {
  try {
    await ElMessageBox.confirm('确定要删除此评价吗？此操作不可恢复。', '删除确认', {
      type: 'error',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await deleteEvaluation(evaluationId.value);
    if (res.success) {
      ElMessage.success('删除成功');
      router.push('/evaluations');
    }
  } catch {
    // 取消
  }
}

// 页面加载
onMounted(() => {
  fetchDetail();
});
</script>

<template>
  <div class="detail-page" v-loading="loading">
    <!-- 顶部信息栏 -->
    <div class="detail-header">
      <div class="header-left">
        <h2 class="title">{{ evaluation?.title }}</h2>
      </div>
    </div>

    <!-- 操作栏（独立卡片式） -->
    <div v-if="evaluation && hasActions" class="action-bar">
      <!-- 创建者操作 -->
      <template v-if="isCreator">
        <el-button
          v-if="evaluation.status === 'DRAFT'"
          type="warning"
          @click="router.push(`/evaluations/${evaluationId}/rate`)"
        >
          {{ isAllRated ? '重新评分' : '开始评分' }}
        </el-button>
        <el-tooltip
          v-if="evaluation.status === 'DRAFT' || evaluation.status === 'REJECTED'"
          :disabled="isAllRated"
          content="请先完成所有被评价人的评分"
          placement="top"
        >
          <el-button type="success" :disabled="!isAllRated" @click="handleSubmit">
            提交审核
          </el-button>
        </el-tooltip>
        <el-button v-if="evaluation.status === 'DRAFT'" type="danger" plain @click="handleDelete">
          删除
        </el-button>
      </template>

      <!-- 评审人操作 -->
      <template v-if="isReviewer">
        <el-button v-if="evaluation.status === 'SUBMITTED'" type="success" @click="handleApprove">
          审核通过
        </el-button>
        <el-button
          v-if="evaluation.status === 'SUBMITTED'"
          type="warning"
          plain
          @click="openRejectDialog"
        >
          打回
        </el-button>
        <el-button v-if="evaluation.status === 'APPROVED'" type="info" plain @click="handleArchive">
          归档
        </el-button>
      </template>

      <!-- 管理员归档 -->
      <el-button
        v-if="isAdmin && evaluation.status === 'APPROVED' && !isReviewer"
        type="info"
        plain
        @click="handleArchive"
      >
        归档
      </el-button>
    </div>

    <template v-if="evaluation">
      <!-- 基本信息 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title">基本信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="评价标题">{{ evaluation.title }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusMap[evaluation.status]?.type">
              {{ statusMap[evaluation.status]?.label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="组织者">
            {{ evaluation.creator?.realName || evaluation.creator?.username }}
          </el-descriptions-item>
          <el-descriptions-item label="可见性">
            {{ visibilityMap[evaluation.visibility] || evaluation.visibility }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(evaluation.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ formatDate(evaluation.submittedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="审核时间">
            {{ formatDate(evaluation.reviewedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="归档时间">
            {{ formatDate(evaluation.archivedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="评价说明" :span="2">
            {{ evaluation.description || '-' }}
          </el-descriptions-item>
        </el-descriptions>
        <!-- 驳回原因 -->
        <div
          v-if="evaluation.status === 'REJECTED' && evaluation.rejectReason"
          class="reject-reason"
        >
          <strong>驳回原因：</strong>{{ evaluation.rejectReason }}
        </div>
      </el-card>

      <!-- 评分进度提示（仅创建者、DRAFT 状态显示） -->
      <el-alert
        v-if="isCreator && evaluation.status === 'DRAFT'"
        :title="
          isAllRated
            ? '评分已完成，可以提交审核'
            : `评分未完成：已评 ${evaluation.ratingItems?.filter((r: any) => r.reviewerId === currentUserId).length || 0} / ${evaluation.participants?.length || 0} 人`
        "
        :type="isAllRated ? 'success' : 'warning'"
        show-icon
        :closable="false"
        style="margin-bottom: 20px"
      />

      <!-- 被评价人 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title"
            >被评价人（{{ evaluation.participants?.length || 0 }} 人）</span
          >
        </template>
        <el-table :data="evaluation.participants" border stripe>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column prop="description" label="说明" min-width="200" />
          <el-table-column prop="phone" label="联系电话" width="140" />
        </el-table>
      </el-card>

      <!-- 评审人 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title">评审人（{{ evaluation.reviewers?.length || 0 }} 人）</span>
        </template>
        <el-table :data="evaluation.reviewers" border stripe>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column label="姓名" min-width="120">
            <template #default="{ row }">
              {{ row.reviewer?.realName || row.reviewer?.username }}
            </template>
          </el-table-column>
          <el-table-column label="用户名" min-width="120">
            <template #default="{ row }">
              {{ row.reviewer?.username }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 评分维度 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title"
            >评分维度（{{ evaluation.scoreDimensions?.length || 0 }} 个）</span
          >
        </template>
        <el-table :data="evaluation.scoreDimensions" border stripe>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="name" label="维度名称" min-width="120" />
          <el-table-column prop="description" label="说明" min-width="200" />
          <el-table-column prop="maxScore" label="满分" width="80" />
          <el-table-column label="权重" width="80">
            <template #default="{ row }"> {{ row.weight }}% </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 评分总览（仅当有评分记录时显示） -->
      <el-card v-if="evaluation.ratingItems?.length" class="section-card">
        <template #header>
          <span class="section-title">评分总览</span>
        </template>
        <el-table :data="scoreSummary" border stripe>
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="name" label="被评价人" min-width="120" />
          <el-table-column
            v-for="dim in evaluation.scoreDimensions"
            :key="dim.id"
            :label="`${dim.name}(${dim.weight}%)`"
            width="120"
          >
            <template #default="{ row }">
              {{ row.scores[dim.id] ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="total" label="加权总分" width="100">
            <template #default="{ row }">
              <span class="score-total">{{ row.total }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="comment" label="评语" min-width="160" show-overflow-tooltip />
        </el-table>
      </el-card>
    </template>

    <!-- 打回弹窗 -->
    <el-dialog v-model="rejectDialogVisible" title="打回评价" width="480px">
      <el-form label-width="80px">
        <el-form-item label="打回原因" required>
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="4"
            placeholder="请填写打回原因，以便组织者了解需要修改的内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="warning" @click="handleReject">确认打回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.detail-page {
  padding: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.action-bar :deep(.el-button) {
  min-width: 90px;
}

.section-card {
  margin-bottom: 20px;
}

.section-title {
  font-weight: 600;
}

.reject-reason {
  margin-top: 16px;
  padding: 12px 16px;
  background-color: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  color: #f56c6c;
  line-height: 1.6;
}

.score-total {
  font-weight: 600;
  color: #409eff;
}
</style>
