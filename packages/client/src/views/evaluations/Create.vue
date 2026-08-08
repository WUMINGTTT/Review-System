<script setup lang="ts">
/**
 * 创建评价页面 - 多步骤表单
 *
 * 功能:
 * 1. 基本信息：标题、描述、可见性
 * 2. 被评价人：弹窗添加，列表展示，支持编辑/删除
 * 3. 评审人：选择评审人
 * 4. 评分维度：弹窗添加，列表展示，支持编辑/删除
 * 5. 确认提交：查看汇总信息并提交
 */
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createEvaluation } from '@/api/evaluation';
import { getUserOptions } from '@/api/user';
import { useUserStore } from '@/stores/user';
import type { FormInstance } from 'element-plus';
import { Plus, Delete, Edit } from '@element-plus/icons-vue';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const currentStep = ref(0);
const isMobile = computed(() => window.innerWidth < 768);

// ========== 步骤 1: 基本信息 ==========
const step1FormRef = ref<FormInstance>();
const step1Form = reactive({
  title: '',
  description: '',
  visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
});
const step1Rules = {
  title: [{ required: true, message: '请输入评价标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入评价描述', trigger: 'blur' }],
};

// ========== 步骤 2: 被评价人 ==========
const participants = ref<{ name: string; description: string; phone: string }[]>([]);
const participantDialogVisible = ref(false);
const participantFormRef = ref<FormInstance>();
const participantForm = reactive({
  name: '',
  description: '',
  phone: '',
});
const participantRules = {
  name: [{ required: true, message: '请输入被评价人姓名', trigger: 'blur' }],
};
const editingParticipantIndex = ref<number>(-1);

// ========== 步骤 3: 评审人 ==========
const reviewerIds = ref<number[]>([]);
const userOptions = ref<{ id: number; username: string; realName: string }[]>([]);
const userOptionsLoading = ref(false);

// 用户选项：将自己置顶显示
const filteredUserOptions = computed(() => {
  const currentUser = userOptions.value.find((user) => user.id === userStore.userInfo?.id);
  const others = userOptions.value.filter((user) => user.id !== userStore.userInfo?.id);
  if (currentUser) {
    return [currentUser, ...others];
  }
  return others;
});

// ========== 步骤 4: 评分维度 ==========
const scoreDimensions = ref<
  { name: string; description: string; maxScore: number; weight: number }[]
>([]);
const dimensionDialogVisible = ref(false);
const dimensionFormRef = ref<FormInstance>();
const dimensionForm = reactive({
  name: '',
  description: '',
  maxScore: 100,
  weight: 0,
});
const dimensionRules = {
  name: [{ required: true, message: '请输入维度名称', trigger: 'blur' }],
  weight: [{ required: true, message: '请输入权重', trigger: 'blur' }],
};
const editingDimensionIndex = ref<number>(-1);

// ========== 步骤 5: 确认提交 ==========
const totalWeight = computed(() => {
  return scoreDimensions.value.reduce((sum, dim) => sum + (dim.weight || 0), 0);
});

const isWeightValid = computed(() => totalWeight.value === 100);

// ========== 步骤控制 ==========
const steps = [
  { title: '基本信息', description: '填写评价标题和描述' },
  { title: '被评价人', description: '添加被评价人列表' },
  { title: '评审人', description: '选择评审人' },
  { title: '评分维度', description: '设置评分维度和权重' },
  { title: '确认提交', description: '查看汇总信息并提交' },
];

// 页面加载时获取用户选项
onMounted(() => {
  loadUserOptions();
});

// 验证当前步骤
async function validateCurrentStep(): Promise<boolean> {
  try {
    if (currentStep.value === 0) {
      await step1FormRef.value?.validate();
      return true;
    }
    if (currentStep.value === 1) {
      if (participants.value.length === 0) {
        ElMessage.warning('请至少添加一个被评价人');
        return false;
      }
      return true;
    }
    if (currentStep.value === 2) {
      if (reviewerIds.value.length === 0) {
        ElMessage.warning('请至少选择一个评审人');
        return false;
      }
      return true;
    }
    if (currentStep.value === 3) {
      if (scoreDimensions.value.length === 0) {
        ElMessage.warning('请至少添加一个评分维度');
        return false;
      }
      if (!isWeightValid.value) {
        ElMessage.warning(`评分维度权重之和必须为 100，当前为 ${totalWeight.value}`);
        return false;
      }
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

// 下一步
async function handleNext() {
  const valid = await validateCurrentStep();
  if (!valid) return;
  currentStep.value++;
}

// 上一步
function handlePrev() {
  currentStep.value--;
}

// ========== 步骤 2: 被评价人操作 ==========
function openAddParticipantDialog() {
  editingParticipantIndex.value = -1;
  participantForm.name = '';
  participantForm.description = '';
  participantForm.phone = '';
  participantDialogVisible.value = true;
}

function openEditParticipantDialog(index: number) {
  editingParticipantIndex.value = index;
  const p = participants.value[index];
  participantForm.name = p.name;
  participantForm.description = p.description;
  participantForm.phone = p.phone;
  participantDialogVisible.value = true;
}

async function handleParticipantConfirm() {
  try {
    await participantFormRef.value?.validate();
  } catch {
    return;
  }

  if (editingParticipantIndex.value === -1) {
    participants.value.push({
      name: participantForm.name,
      description: participantForm.description,
      phone: participantForm.phone,
    });
  } else {
    participants.value[editingParticipantIndex.value] = {
      name: participantForm.name,
      description: participantForm.description,
      phone: participantForm.phone,
    };
  }

  participantDialogVisible.value = false;
}

async function removeParticipant(index: number) {
  try {
    await ElMessageBox.confirm('确定要删除该被评价人吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    participants.value.splice(index, 1);
  } catch {
    // 取消删除
  }
}

// ========== 步骤 3: 评审人操作 ==========
async function loadUserOptions() {
  userOptionsLoading.value = true;
  try {
    const res = await getUserOptions();
    if (res.success) {
      userOptions.value = res.data;
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取用户列表失败');
  } finally {
    userOptionsLoading.value = false;
  }
}

// ========== 步骤 4: 评分维度操作 ==========
function openAddDimensionDialog() {
  editingDimensionIndex.value = -1;
  dimensionForm.name = '';
  dimensionForm.description = '';
  dimensionForm.maxScore = 100;
  dimensionForm.weight = 0;
  dimensionDialogVisible.value = true;
}

function openEditDimensionDialog(index: number) {
  editingDimensionIndex.value = index;
  const d = scoreDimensions.value[index];
  dimensionForm.name = d.name;
  dimensionForm.description = d.description;
  dimensionForm.maxScore = d.maxScore;
  dimensionForm.weight = d.weight;
  dimensionDialogVisible.value = true;
}

async function handleDimensionConfirm() {
  try {
    await dimensionFormRef.value?.validate();
  } catch {
    return;
  }

  if (editingDimensionIndex.value === -1) {
    scoreDimensions.value.push({
      name: dimensionForm.name,
      description: dimensionForm.description,
      maxScore: dimensionForm.maxScore,
      weight: dimensionForm.weight,
    });
  } else {
    scoreDimensions.value[editingDimensionIndex.value] = {
      name: dimensionForm.name,
      description: dimensionForm.description,
      maxScore: dimensionForm.maxScore,
      weight: dimensionForm.weight,
    };
  }

  dimensionDialogVisible.value = false;
}

async function removeDimension(index: number) {
  try {
    await ElMessageBox.confirm('确定要删除该评分维度吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    scoreDimensions.value.splice(index, 1);
  } catch {
    // 取消删除
  }
}

// ========== 步骤 5: 提交 ==========
async function handleSubmit() {
  loading.value = true;
  try {
    const data = {
      title: step1Form.title,
      description: step1Form.description,
      visibility: step1Form.visibility,
      participants: participants.value.map((p) => ({
        name: p.name,
        description: p.description || undefined,
        phone: p.phone || undefined,
      })),
      reviewerIds: reviewerIds.value,
      scoreDimensions: scoreDimensions.value.map((dim) => ({
        name: dim.name,
        description: dim.description || undefined,
        maxScore: dim.maxScore || 100,
        weight: dim.weight,
      })),
    };

    const res = await createEvaluation(data);
    if (res.success) {
      ElMessage.success('评价创建成功');
      router.push(`/evaluations/${res.data.id}`);
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '创建失败');
  } finally {
    loading.value = false;
  }
}

// 获取评审人显示名称
function getReviewerName(id: number): string {
  const user = userOptions.value.find((u) => u.id === id);
  return user ? `${user.realName} (${user.username})` : `用户 ${id}`;
}
</script>

<template>
  <div class="create-page">
    <!-- 步骤条 -->
    <el-card class="steps-card">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step
          v-for="(step, index) in steps"
          :key="index"
          :title="step.title"
          :description="step.description"
        />
      </el-steps>
    </el-card>

    <!-- 步骤内容 -->
    <el-card class="content-card">
      <!-- 步骤 1: 基本信息 -->
      <div v-show="currentStep === 0" class="step-section">
        <div class="section-header">
          <span>填写基本信息</span>
        </div>
        <el-form
          ref="step1FormRef"
          :model="step1Form"
          :rules="step1Rules"
          label-position="top"
          class="step1-form"
        >
          <el-form-item label="评价标题" prop="title">
            <el-input v-model="step1Form.title" placeholder="请输入评价标题" size="large" />
          </el-form-item>

          <el-form-item label="评价描述" prop="description">
            <el-input
              v-model="step1Form.description"
              type="textarea"
              :rows="4"
              placeholder="请输入评价描述"
            />
          </el-form-item>

          <el-form-item label="可见性">
            <el-radio-group v-model="step1Form.visibility" class="visibility-group">
              <el-radio value="PUBLIC">
                <div class="radio-label">
                  <span class="radio-title">公开</span>
                  <span class="radio-desc">所有人可见评分结果</span>
                </div>
              </el-radio>
              <el-radio value="PRIVATE">
                <div class="radio-label">
                  <span class="radio-title">私有</span>
                  <span class="radio-desc">仅创建者和审核者可见</span>
                </div>
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

      <!-- 步骤 2: 被评价人 -->
      <div v-show="currentStep === 1">
        <div class="section-header">
          <span>被评价人列表</span>
          <el-button type="primary" :icon="Plus" @click="openAddParticipantDialog">
            添加被评价人
          </el-button>
        </div>

        <!-- 桌面端表格 -->
        <el-table v-if="!isMobile" :data="participants" border style="width: 100%">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="姓名" min-width="120" />
          <el-table-column prop="description" label="说明" min-width="150">
            <template #default="{ row }">{{ row.description || '-' }}</template>
          </el-table-column>
          <el-table-column prop="phone" label="联系方式" min-width="120">
            <template #default="{ row }">{{ row.phone || '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="center">
            <template #default="{ $index }">
              <el-button type="primary" link :icon="Edit" @click="openEditParticipantDialog($index)">编辑</el-button>
              <el-button type="danger" link :icon="Delete" @click="removeParticipant($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <!-- 手机端卡片 -->
        <div v-else class="item-grid">
          <div v-for="(p, index) in participants" :key="index" class="item-card">
            <div class="item-card-header">
              <span class="item-index">{{ index + 1 }}</span>
              <span class="item-name">{{ p.name }}</span>
              <div class="item-actions">
                <el-button type="primary" link size="small" @click="openEditParticipantDialog(index)">编辑</el-button>
                <el-button type="danger" link size="small" @click="removeParticipant(index)">删除</el-button>
              </div>
            </div>
            <div v-if="p.description" class="item-detail">
              <span class="item-label">说明</span>
              <span class="item-value">{{ p.description }}</span>
            </div>
            <div v-if="p.phone" class="item-detail">
              <span class="item-label">联系方式</span>
              <span class="item-value">{{ p.phone }}</span>
            </div>
          </div>
        </div>

        <div v-if="participants.length === 0" class="empty-tip">
          暂无被评价人，请点击上方按钮添加
        </div>
      </div>

      <!-- 被评价人弹窗 -->
      <el-dialog
        v-model="participantDialogVisible"
        :title="editingParticipantIndex === -1 ? '添加被评价人' : '编辑被评价人'"
        :width="isMobile ? '95vw' : '500px'"
        destroy-on-close
      >
        <el-form
          ref="participantFormRef"
          :model="participantForm"
          :rules="participantRules"
          label-width="80px"
        >
          <el-form-item label="姓名" prop="name">
            <el-input v-model="participantForm.name" placeholder="请输入被评价人姓名" />
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="participantForm.description" placeholder="请输入说明（选填）" />
          </el-form-item>
          <el-form-item label="联系方式">
            <el-input v-model="participantForm.phone" placeholder="请输入联系方式（选填）" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="participantDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleParticipantConfirm">确定</el-button>
        </template>
      </el-dialog>

      <!-- 步骤 3: 评审人 -->
      <div v-show="currentStep === 2">
        <div class="section-header">
          <span>选择评审人</span>
          <span class="tip">至少选择 1 人</span>
        </div>

        <div v-loading="userOptionsLoading" class="reviewer-list">
          <el-empty
            v-if="!userOptionsLoading && filteredUserOptions.length === 0"
            description="暂无可用用户"
          />
          <el-checkbox-group v-model="reviewerIds">
            <el-checkbox
              v-for="user in filteredUserOptions"
              :key="user.id"
              :value="user.id"
              class="reviewer-item"
            >
              <span class="reviewer-name">{{ user.realName }}</span>
              <span class="reviewer-username">({{ user.username }})</span>
              <el-tag
                v-if="user.id === userStore.userInfo?.id"
                size="small"
                type="warning"
                effect="plain"
                style="margin-left: 8px"
              >
                我
              </el-tag>
            </el-checkbox>
          </el-checkbox-group>
        </div>

        <div v-if="reviewerIds.length > 0" class="selected-reviewers">
          <span>已选择 {{ reviewerIds.length }} 人：</span>
          <el-tag
            v-for="id in reviewerIds"
            :key="id"
            closable
            @close="reviewerIds = reviewerIds.filter((r) => r !== id)"
            style="margin-left: 8px"
          >
            {{ getReviewerName(id) }}
          </el-tag>
        </div>
      </div>

      <!-- 步骤 4: 评分维度 -->
      <div v-show="currentStep === 3">
        <div class="section-header">
          <span>评分维度设置</span>
          <div>
            <span class="weight-info" :class="{ 'weight-error': !isWeightValid }">
              权重总和：{{ totalWeight }}%
            </span>
            <el-button
              type="primary"
              :icon="Plus"
              @click="openAddDimensionDialog"
              style="margin-left: 16px"
            >
              添加维度
            </el-button>
          </div>
        </div>

        <!-- 桌面端表格 -->
        <el-table v-if="!isMobile" :data="scoreDimensions" border style="width: 100%">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="维度名称" min-width="120" />
          <el-table-column prop="description" label="说明" min-width="150">
            <template #default="{ row }">{{ row.description || '-' }}</template>
          </el-table-column>
          <el-table-column prop="maxScore" label="满分值" width="100" align="center" />
          <el-table-column label="权重" width="100" align="center">
            <template #default="{ row }"> {{ row.weight }}% </template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="center">
            <template #default="{ $index }">
              <el-button type="primary" link :icon="Edit" @click="openEditDimensionDialog($index)">编辑</el-button>
              <el-button type="danger" link :icon="Delete" @click="removeDimension($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <!-- 手机端卡片 -->
        <div v-else class="item-grid">
          <div v-for="(dim, index) in scoreDimensions" :key="index" class="item-card">
            <div class="item-card-header">
              <span class="item-index">{{ index + 1 }}</span>
              <span class="item-name">{{ dim.name }}</span>
              <span class="item-badge">{{ dim.weight }}%</span>
              <div class="item-actions">
                <el-button type="primary" link size="small" @click="openEditDimensionDialog(index)">编辑</el-button>
                <el-button type="danger" link size="small" @click="removeDimension(index)">删除</el-button>
              </div>
            </div>
            <div v-if="dim.description" class="item-detail">
              <span class="item-label">说明</span>
              <span class="item-value">{{ dim.description }}</span>
            </div>
            <div class="item-detail">
              <span class="item-label">满分</span>
              <span class="item-value">{{ dim.maxScore }} 分</span>
            </div>
          </div>
        </div>

        <div v-if="scoreDimensions.length === 0" class="empty-tip">
          暂无评分维度，请点击上方按钮添加
        </div>
      </div>

      <!-- 评分维度弹窗 -->
      <el-dialog
        v-model="dimensionDialogVisible"
        :title="editingDimensionIndex === -1 ? '添加评分维度' : '编辑评分维度'"
        :width="isMobile ? '95vw' : '500px'"
        destroy-on-close
      >
        <el-form
          ref="dimensionFormRef"
          :model="dimensionForm"
          :rules="dimensionRules"
          label-width="80px"
        >
          <el-form-item label="维度名称" prop="name">
            <el-input v-model="dimensionForm.name" placeholder="请输入维度名称" />
          </el-form-item>
          <el-form-item label="维度说明">
            <el-input v-model="dimensionForm.description" placeholder="请输入维度说明（选填）" />
          </el-form-item>
          <el-form-item label="满分值">
            <el-input-number
              v-model="dimensionForm.maxScore"
              :min="1"
              :max="1000"
              style="width: 90%"
            />
            <span class="weight-suffix" style="width: 5%">分</span>
          </el-form-item>
          <el-form-item label="权重">
            <el-input-number
              v-model="dimensionForm.weight"
              :min="1"
              :max="100"
              style="width: 90%"
            />
            <span class="weight-suffix" style="width: 5%">%</span>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dimensionDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleDimensionConfirm">确定</el-button>
        </template>
      </el-dialog>

      <!-- 步骤 5: 确认提交 -->
      <div v-show="currentStep === 4" class="confirm-section">
        <div class="confirm-block">
          <h4 class="confirm-block-title">基本信息</h4>
          <el-descriptions label-width="150px" :column="1" border>
            <el-descriptions-item label="评价标题">{{ step1Form.title }}</el-descriptions-item>
            <el-descriptions-item label="评价描述">{{
              step1Form.description || '-'
            }}</el-descriptions-item>
            <el-descriptions-item label="可见性">
              {{ step1Form.visibility === 'PUBLIC' ? '公开' : '私有' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="confirm-block">
          <h4 class="confirm-block-title">被评价人（{{ participants.length }} 人）</h4>
          <!-- 桌面端表格 -->
          <el-table v-if="!isMobile" :data="participants" border style="width: 100%">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="name" label="姓名" />
            <el-table-column prop="description" label="说明">
              <template #default="{ row }">{{ row.description || '-' }}</template>
            </el-table-column>
            <el-table-column prop="phone" label="联系方式">
              <template #default="{ row }">{{ row.phone || '-' }}</template>
            </el-table-column>
          </el-table>
          <!-- 手机端卡片 -->
          <div v-else class="item-grid">
            <div v-for="(p, index) in participants" :key="index" class="item-card">
              <div class="item-card-header">
                <span class="item-index">{{ index + 1 }}</span>
                <span class="item-name">{{ p.name }}</span>
              </div>
              <div v-if="p.description" class="item-detail">
                <span class="item-label">说明</span>
                <span class="item-value">{{ p.description }}</span>
              </div>
              <div v-if="p.phone" class="item-detail">
                <span class="item-label">联系方式</span>
                <span class="item-value">{{ p.phone }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="confirm-block">
          <h4 class="confirm-block-title">评审人（{{ reviewerIds.length }} 人）</h4>
          <div class="reviewer-tags">
            <el-tag
              v-for="id in reviewerIds"
              :key="id"
              style="margin-right: 8px; margin-bottom: 8px"
            >
              {{ getReviewerName(id) }}
            </el-tag>
          </div>
        </div>

        <div class="confirm-block">
          <h4 class="confirm-block-title">评分维度（{{ scoreDimensions.length }} 个）</h4>
          <!-- 桌面端表格 -->
          <el-table v-if="!isMobile" :data="scoreDimensions" border style="width: 100%">
            <el-table-column prop="name" label="维度名称" />
            <el-table-column prop="description" label="说明">
              <template #default="{ row }">{{ row.description || '-' }}</template>
            </el-table-column>
            <el-table-column prop="maxScore" label="满分值" width="100" align="center" />
            <el-table-column label="权重" width="100" align="center">
              <template #default="{ row }"> {{ row.weight }}% </template>
            </el-table-column>
          </el-table>
          <!-- 手机端卡片 -->
          <div v-else class="item-grid">
            <div v-for="(dim, index) in scoreDimensions" :key="index" class="item-card">
              <div class="item-card-header">
                <span class="item-index">{{ index + 1 }}</span>
                <span class="item-name">{{ dim.name }}</span>
                <span class="item-badge">{{ dim.weight }}%</span>
              </div>
              <div v-if="dim.description" class="item-detail">
                <span class="item-label">说明</span>
                <span class="item-value">{{ dim.description }}</span>
              </div>
              <div class="item-detail">
                <span class="item-label">满分</span>
                <span class="item-value">{{ dim.maxScore }} 分</span>
              </div>
            </div>
          </div>
          <div class="weight-summary" :class="{ 'weight-error': !isWeightValid }">
            权重总和：{{ totalWeight }}%
            <span v-if="!isWeightValid">（必须为 100%）</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button v-if="currentStep > 0" @click="handlePrev">上一步</el-button>
        <el-button @click="router.back()">取消</el-button>
        <el-button v-if="currentStep < steps.length - 1" type="primary" @click="handleNext">
          下一步
        </el-button>
        <el-button
          v-if="currentStep === steps.length - 1"
          type="primary"
          :loading="loading"
          :disabled="!isWeightValid"
          @click="handleSubmit"
        >
          确认创建
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.create-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.steps-card {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.content-card {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-card :deep(.el-card__body) {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 0 20px 0 20px;
}

/* 自定义滚动条样式 */
.content-card :deep(.el-card__body)::-webkit-scrollbar {
  width: 6px;
}

.content-card :deep(.el-card__body)::-webkit-scrollbar-track {
  background: transparent;
}

.content-card :deep(.el-card__body)::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 3px;
}

.content-card :deep(.el-card__body)::-webkit-scrollbar-thumb:hover {
  background-color: #c0c4cc;
}

/* 步骤区域 */
.step-section {
  max-width: 640px;
}

/* 基本信息表单 */
.step1-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #303133;
  padding-bottom: 4px;
}

.step1-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.visibility-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.visibility-group :deep(.el-radio) {
  height: auto;
  margin-right: 0;
}

.radio-label {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.radio-title {
  font-weight: 500;
  color: #303133;
}

.radio-desc {
  font-size: 12px;
  color: #909399;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: bold;
  position: sticky;
  top: 0;
  background-color: #fff;
  padding: 20px 0 12px 0;
  z-index: 5;
  border-bottom: 1px solid #ebeef5;
}

.section-header .tip {
  font-size: 14px;
  color: #909399;
  font-weight: normal;
}

.empty-tip {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}

.reviewer-list {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.reviewer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.reviewer-name {
  font-weight: bold;
}

.reviewer-username {
  color: #909399;
}

.selected-reviewers {
  margin-top: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.weight-suffix {
  margin-left: 8px;
  color: #909399;
}

.weight-info {
  font-size: 14px;
  color: #67c23a;
}

.weight-error {
  color: #f56c6c;
}

.weight-summary {
  margin-top: 12px;
  text-align: right;
  font-size: 14px;
  font-weight: bold;
  color: #67c23a;
}

.weight-summary.weight-error {
  color: #f56c6c;
}

/* 信息卡片网格 */
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.item-card {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.item-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.item-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e4e7ed;
  font-size: 11px;
  color: #606266;
  flex-shrink: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.item-badge {
  margin-left: auto;
  font-size: 12px;
  color: #409eff;
  font-weight: 500;
}

.item-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.item-detail {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  font-size: 13px;
}

.item-label {
  color: #909399;
  flex-shrink: 0;
}

.item-value {
  color: #606266;
  word-break: break-all;
}

.reviewer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 确认页面样式 */
.confirm-section {
  padding: 0 20px;
}

.confirm-block {
  margin-bottom: 32px;
}

.confirm-block-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  margin-top: 16px;
  color: #303133;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

/* 固定底部按钮 */
.action-buttons {
  position: sticky;
  bottom: 0;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  background-color: #fff;
  border-top: 1px solid #ebeef5;
  margin-top: auto;
  z-index: 10;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .steps-card :deep(.el-step__title) {
    font-size: 12px;
  }

  .steps-card :deep(.el-step__description) {
    display: none;
  }

  .content-card :deep(.el-card__body) {
    padding: 0 12px;
  }

  .section-header {
    padding: 12px 0 8px 0;
    font-size: 14px;
    flex-wrap: wrap;
    gap: 8px;
  }

  /* 所有表格横向滚动 */
  :deep(.el-table) {
    display: block;
    overflow-x: auto;
  }

  .action-buttons {
    padding: 12px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action-buttons :deep(.el-button) {
    flex: 1;
    min-width: 0;
  }

  /* 确认页面 */
  .confirm-section {
    padding: 0 8px;
  }

  .confirm-block-title {
    font-size: 14px;
  }
}
</style>
