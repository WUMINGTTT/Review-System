<script setup lang="ts">
/**
 * 审核管理页面
 *
 * 功能:
 * 1. 展示当前用户作为评审人需要审核的评价列表
 * 2. 支持审核通过和打回操作
 * 3. 打回需要填写原因
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMyReviews, approveReview, rejectReview } from '@/api/review'

const router = useRouter()

// 审核列表
const reviews = ref<any[]>([])
const loading = ref(false)

// 打回弹窗
const rejectDialogVisible = ref(false)
const rejectReason = ref('')
const rejectingId = ref<number | null>(null)

// 格式化日期
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

// 获取待审核列表
async function fetchReviews() {
  loading.value = true
  try {
    const res = await getMyReviews()
    // 兼容后端返回 { code: 200, data } 格式
    if (res.code === 200) {
      reviews.value = res.data
    }
  } catch (error) {
    console.error('获取待审核列表失败:', error)
    ElMessage.error('获取待审核列表失败')
  } finally {
    loading.value = false
  }
}

// 审核通过
async function handleApprove(id: number, title: string) {
  try {
    await ElMessageBox.confirm(
      `确定要通过评价"${title}"吗？`,
      '审核确认',
      { type: 'success' }
    )
    const res = await approveReview(id)
    if (res.code === 200) {
      ElMessage.success('审核通过')
      fetchReviews()
    }
  } catch {
    // 取消
  }
}

// 打开打回弹窗
function openRejectDialog(id: number) {
  rejectingId.value = id
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

// 确认打回
async function handleReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写打回原因')
    return
  }
  if (!rejectingId.value) return

  try {
    const res = await rejectReview(rejectingId.value, rejectReason.value.trim())
    if (res.code === 200) {
      ElMessage.success('已打回')
      rejectDialogVisible.value = false
      fetchReviews()
    }
  } catch (error) {
    console.error('打回失败:', error)
  }
}

// 查看评价详情
function goToDetail(id: number) {
  router.push(`/evaluations/${id}`)
}

onMounted(() => {
  fetchReviews()
})
</script>

<template>
  <div class="reviews-page" v-loading="loading">
    <!-- 空状态 -->
    <el-empty v-if="!loading && reviews.length === 0" description="暂无待审核的评价" />

    <!-- 审核列表 -->
    <el-table v-else :data="reviews" border stripe>
      <el-table-column type="index" label="序号" width="60" />
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
      <el-table-column label="被评价人数" width="100" align="center">
        <template #default="{ row }">
          {{ row._count?.participants || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.submittedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="success" link @click="handleApprove(row.id, row.title)">
            通过
          </el-button>
          <el-button type="warning" link @click="openRejectDialog(row.id)">
            打回
          </el-button>
          <el-button type="primary" link @click="goToDetail(row.id)">
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

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
.reviews-page {
  padding: 0;
}
</style>
