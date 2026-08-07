<script setup lang="ts">
/**
 * 评价列表页面
 *
 * 功能:
 * 1. 展示评价列表（表格）
 * 2. 按状态筛选
 * 3. 分页
 * 4. 创建/删除评价
 */
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getEvaluations, deleteEvaluation } from '@/api/evaluation';

const router = useRouter();


// 列表数据
const evaluations = ref<any[]>([]);
const loading = ref(false);

// 分页参数
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

// 筛选状态
const statusFilter = ref('');

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

// 获取列表
async function fetchEvaluations() {
  loading.value = true;
  try {
    const res = await getEvaluations({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value || undefined,
    });
    if (res.success) {
      evaluations.value = res.data.list;
      pagination.value.total = res.data.total;
    }
  } catch (error) {
    console.error('获取评价列表失败:', error);
  } finally {
    loading.value = false;
  }
}

// 切换筛选
function handleStatusChange(status: string | number | boolean | undefined) {
  statusFilter.value = String(status || '');
  pagination.value.page = 1;
  fetchEvaluations();
}

// 切换页码
function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchEvaluations();
}

// 删除评价
async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定要删除这个评价吗？', '提示', {
      type: 'warning',
    });
    const res = await deleteEvaluation(id);
    if (res.success) {
      ElMessage.success('删除成功');
      fetchEvaluations();
    }
  } catch {
    // 取消
  }
}

// 页面加载
onMounted(() => {
  fetchEvaluations();
});
</script>

<template>
  <div class="evaluations-page">
    <!-- 筛选栏 -->
    <el-radio-group v-model="statusFilter" @change="handleStatusChange">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="DRAFT">草稿</el-radio-button>
      <el-radio-button value="SUBMITTED">待审核</el-radio-button>
      <el-radio-button value="APPROVED">已通过</el-radio-button>
      <el-radio-button value="REJECTED">已驳回</el-radio-button>
      <el-radio-button value="ARCHIVED">已归档</el-radio-button>
    </el-radio-group>

    <!-- 表格 -->
    <el-table :data="evaluations" v-loading="loading" style="margin-top: 20px">
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column label="组织者" width="120">
        <template #default="{ row }">
          {{ row.createdBy?.realName || row.createdBy?.username }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.type">
            {{ statusMap[row.status]?.label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'DRAFT'"
            type="primary"
            link
            @click="router.push(`/evaluations/${row.id}/edit`)"
          >
            编辑
          </el-button>
          <el-button v-if="row.status === 'DRAFT'" type="danger" link @click="handleDelete(row.id)">
            删除
          </el-button>
          <el-button type="primary" link @click="router.push(`/evaluations/${row.id}`)">
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      layout="total, prev, pager, next"
      @current-change="handlePageChange"
      style="margin-top: 20px; justify-content: flex-end"
    />
  </div>
</template>

<style scoped>
.evaluations-page {
  padding: 0;
}
</style>
