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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
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
import * as echarts from 'echarts/core';
import { RadarChart, BarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Edit } from '@element-plus/icons-vue';

echarts.use([RadarChart, BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// 响应式判断
const isMobile = computed(() => window.innerWidth < 768);

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
  // 创建者：DRAFT/REJECTED（评分+提交），APPROVED/ARCHIVED（删除），SUBMITTED 无操作
  if (isCreator.value && (status === 'DRAFT' || status === 'REJECTED' || status === 'APPROVED' || status === 'ARCHIVED')) return true;
  // 审核者：SUBMITTED（通过+打回），APPROVED（归档）
  if (isReviewer.value && (status === 'SUBMITTED' || status === 'APPROVED')) return true;
  // 管理员（非审核者）：APPROVED（归档）
  if (isAdmin.value && status === 'APPROVED' && !isReviewer.value) return true;
  return false;
});

// 当前用户是否已有评分记录
const hasAnyRatings = computed(() => {
  if (!evaluation.value) return false;
  const ratingItems = evaluation.value.ratingItems || [];
  return ratingItems.some((r: any) => r.reviewerId === currentUserId.value);
});

// 当前用户已完成的评分数量（所有维度都有 >0 分数的被评价人数）
const completedCount = computed(() => {
  if (!evaluation.value) return 0;
  const participants = evaluation.value.participants || [];
  const ratingItems = evaluation.value.ratingItems || [];
  const dimensions = evaluation.value.scoreDimensions || [];
  if (dimensions.length === 0) return 0;
  const myRatings = ratingItems.filter((r: any) => r.reviewerId === currentUserId.value);
  return participants.filter((p: any) => {
    const rating = myRatings.find((r: any) => r.participantId === p.id);
    if (!rating) return false;
    return dimensions.every((d: any) => {
      const score = rating.dimensionScores?.find((ds: any) => ds.dimensionId === d.id)?.score;
      return score !== undefined && score > 0;
    });
  }).length;
});

// 判断是否已为所有被评价人评分（且每个被评人的所有维度都评分完成）
const isAllRated = computed(() => {
  if (!evaluation.value) return false;
  const participants = evaluation.value.participants || [];
  return completedCount.value === participants.length && participants.length > 0;
});

// 评分按钮文案
const rateButtonText = computed(() => {
  if (evaluation.value?.status === 'REJECTED') return '修改评分';
  if (!hasAnyRatings.value) return '开始评分';
  if (!isAllRated.value) return '继续评分';
  return '修改评分';
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

// ========== 图表 ==========
const chartRef = ref<HTMLDivElement>();
let chartInstance: echarts.ECharts | null = null;
const chartType = ref<'radar' | 'bar'>('radar');

const chartColors = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b8d0',
];

function initChart() {
  if (!chartRef.value || !scoreSummary.value.length) return;

  const dimensions = evaluation.value?.scoreDimensions || [];
  if (!dimensions.length) return;

  if (chartInstance) {
    chartInstance.dispose();
  }

  chartInstance = echarts.init(chartRef.value);

  let option: echarts.EChartsCoreOption;

  if (chartType.value === 'radar') {
    // 雷达图
    const indicator = dimensions.map((d: any) => ({ name: d.name, max: 100 }));
    const seriesData = scoreSummary.value.map((item: any, index: number) => ({
      name: item.name,
      value: dimensions.map((d: any) => item.scores[d.id] ?? 0),
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: chartColors[index % chartColors.length] },
    }));

    option = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12 } },
      radar: {
        indicator,
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#606266', fontSize: 12 },
        splitArea: { areaStyle: { color: ['#fff', '#f5f7fa', '#fff', '#f5f7fa'] } },
      },
      series: [{ type: 'radar', data: seriesData }],
    };
  } else {
    // 柱状图
    const categories = dimensions.map((d: any) => d.name);
    const barSeries = scoreSummary.value.map((item: any, index: number) => ({
      name: item.name,
      type: 'bar' as const,
      data: dimensions.map((d: any) => item.scores[d.id] ?? 0),
      itemStyle: { color: chartColors[index % chartColors.length], borderRadius: [4, 4, 0, 0] },
    }));

    option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12 } },
      grid: { left: 40, right: 20, top: 20, bottom: 50 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#606266', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: '#909399' },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: barSeries,
    };
  }

  chartInstance.setOption(option);
}

function switchChartType(type: 'radar' | 'bar') {
  chartType.value = type;
  nextTick(() => initChart());
}

function handleChartResize() {
  chartInstance?.resize();
}

// 监听数据变化重新渲染
watch(scoreSummary, () => {
  nextTick(() => initChart());
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
    await ElMessageBox.confirm('确认提交此评价吗？提交后将进入审核流程。', '提交确认', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
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
    await ElMessageBox.confirm('确认过审此评价吗？', '审核确认', {
      type: 'success',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    const res = await approveEvaluation(evaluationId.value);
    if (res.success) {
      ElMessage.success('审核通过');
      // 审核通过后返回审核管理页面（APPROVED 状态仅创建者可见）
      router.push('/reviews');
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
      // 打回后返回审核管理页面（REJECTED 状态仅创建者可见）
      router.push('/reviews');
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
      confirmButtonText: '确定',
      cancelButtonText: '取消',
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

// 导出 PDF
async function handleExport() {
  if (!evaluation.value) return;

  const loading = ElMessage({ message: '正在生成 PDF...', type: 'info', duration: 0 });

  try {
    const ev = evaluation.value;
    const dimensions = ev.scoreDimensions || [];
    const participants = ev.participants || [];
    const reviewers = ev.reviewers || [];

    // 获取雷达图图片
    let chartImage = '';
    if (chartInstance) {
      chartImage = chartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    }

    // 构建报告 HTML
    const html = `
      <div id="pdf-report" style="width: 800px; padding: 40px; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; color: #303133; line-height: 1.6;">
        <!-- 标题 -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #409eff;">
          <h1 style="margin: 0 0 10px; font-size: 28px; color: #1a2332;">${ev.title}</h1>
          <div style="font-size: 14px; color: #606266;">
            <span style="display: inline-block; padding: 2px 12px; border-radius: 12px; background: ${ev.status === 'ARCHIVED' ? '#e6f7e6' : '#fff3e6'}; color: ${ev.status === 'ARCHIVED' ? '#52c41a' : '#fa8c16'}; margin-right: 16px;">
              ${statusMap[ev.status]?.label || ev.status}
            </span>
            组织者：${ev.creator?.realName || ev.creator?.username || '-'}
          </div>
        </div>

        <!-- 基本信息 -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">基本信息</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 12px; background: #f5f7fa; width: 100px; color: #606266;">可见性</td><td style="padding: 8px 12px;">${visibilityMap[ev.visibility] || ev.visibility}</td></tr>
            <tr><td style="padding: 8px 12px; background: #f5f7fa; color: #606266;">创建时间</td><td style="padding: 8px 12px;">${formatDate(ev.createdAt)}</td></tr>
            <tr><td style="padding: 8px 12px; background: #f5f7fa; color: #606266;">提交时间</td><td style="padding: 8px 12px;">${formatDate(ev.submittedAt)}</td></tr>
            <tr><td style="padding: 8px 12px; background: #f5f7fa; color: #606266;">审核时间</td><td style="padding: 8px 12px;">${formatDate(ev.reviewedAt)}</td></tr>
            <tr><td style="padding: 8px 12px; background: #f5f7fa; color: #606266;">归档时间</td><td style="padding: 8px 12px;">${formatDate(ev.archivedAt)}</td></tr>
            ${ev.description ? `<tr><td style="padding: 8px 12px; background: #f5f7fa; color: #606266;">评价说明</td><td style="padding: 8px 12px;">${ev.description}</td></tr>` : ''}
          </table>
        </div>

        <!-- 被评价人 -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">被评价人（${participants.length} 人）</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f7fa;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">序号</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">姓名</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">说明</th>
              </tr>
            </thead>
            <tbody>
              ${participants.map((p: any, i: number) => `
                <tr style="border-bottom: 1px solid #ebeef5;">
                  <td style="padding: 8px 12px;">${i + 1}</td>
                  <td style="padding: 8px 12px;">${p.name}</td>
                  <td style="padding: 8px 12px; color: #909399;">${p.description || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 评审人 -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">评审人（${reviewers.length} 人）</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f7fa;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">序号</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">姓名</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">用户名</th>
              </tr>
            </thead>
            <tbody>
              ${reviewers.map((r: any, i: number) => `
                <tr style="border-bottom: 1px solid #ebeef5;">
                  <td style="padding: 8px 12px;">${i + 1}</td>
                  <td style="padding: 8px 12px;">${r.reviewer?.realName || r.reviewer?.username || '-'}</td>
                  <td style="padding: 8px 12px; color: #909399;">${r.reviewer?.username || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 评分维度 -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">评分维度（${dimensions.length} 个）</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f7fa;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">序号</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">维度名称</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">权重</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">满分</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">说明</th>
              </tr>
            </thead>
            <tbody>
              ${dimensions.map((d: any, i: number) => `
                <tr style="border-bottom: 1px solid #ebeef5;">
                  <td style="padding: 8px 12px;">${i + 1}</td>
                  <td style="padding: 8px 12px;">${d.name}</td>
                  <td style="padding: 8px 12px;">${d.weight}%</td>
                  <td style="padding: 8px 12px;">${d.maxScore} 分</td>
                  <td style="padding: 8px 12px; color: #909399;">${d.description || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 雷达图 -->
        ${chartImage ? `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">评分雷达图</h2>
          <div style="text-align: center;">
            <img src="${chartImage}" style="max-width: 100%; height: auto;" />
          </div>
        </div>
        ` : ''}

        <!-- 评分总览 -->
        ${scoreSummary.value.length ? `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #1a2332; border-left: 4px solid #409eff; padding-left: 12px; margin-bottom: 16px;">评分总览</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f7fa;">
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">被评价人</th>
                ${dimensions.map((d: any) => `<th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">${d.name}</th>`).join('')}
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">加权总分</th>
                <th style="padding: 8px 12px; text-align: left; border-bottom: 1px solid #ebeef5;">评语</th>
              </tr>
            </thead>
            <tbody>
              ${scoreSummary.value.map((item: any) => `
                <tr style="border-bottom: 1px solid #ebeef5;">
                  <td style="padding: 8px 12px; font-weight: 500;">${item.name}</td>
                  ${dimensions.map((d: any) => `<td style="padding: 8px 12px;">${item.scores[d.id] ?? '-'}</td>`).join('')}
                  <td style="padding: 8px 12px; font-weight: 600; color: #409eff;">${item.total}</td>
                  <td style="padding: 8px 12px; color: #606266; max-width: 200px;">${item.comment || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- 页脚 -->
        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ebeef5; text-align: center; font-size: 12px; color: #909399;">
          导出时间：${new Date().toLocaleString()} | 评价系统
        </div>
      </div>
    `;

    // 创建临时容器
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    // 使用 html2canvas 渲染
    const canvas = await html2canvas(container.querySelector('#pdf-report') as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    // 移除临时容器
    document.body.removeChild(container);

    // 创建 PDF
    const imgWidth = 210; // A4 宽度 mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // 分页处理
    const pageHeight = 297; // A4 高度 mm
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 保存文件
    pdf.save(`${ev.title}_评价报告.pdf`);
    loading.close();
    ElMessage.success('导出成功');
  } catch (error) {
    loading.close();
    console.error('导出 PDF 失败:', error);
    ElMessage.error('导出失败');
  }
}

// 页面加载
onMounted(() => {
  fetchDetail();
  window.addEventListener('resize', handleChartResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleChartResize);
  chartInstance?.dispose();
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

    <!-- 操作栏 -->
    <div v-if="evaluation && hasActions" class="action-bar">
      <!-- 导出按钮：APPROVED 禁用提示需归档，ARCHIVED 可导出 -->
      <el-tooltip
        v-if="evaluation.status === 'APPROVED' || evaluation.status === 'ARCHIVED'"
        :disabled="evaluation.status === 'ARCHIVED'"
        content="请先归档后再导出"
        placement="top"
      >
        <el-button
          type="success"
          plain
          :disabled="evaluation.status === 'APPROVED'"
          @click="handleExport"
        >
          <el-icon style="margin-right: 4px"><Download /></el-icon>
          导出 PDF
        </el-button>
      </el-tooltip>

      <!-- 审核者操作：SUBMITTED 可通过/打回，APPROVED 可归档 -->
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

      <!-- 管理员（非审核者）操作：APPROVED 可归档 -->
      <el-button
        v-if="isAdmin && !isReviewer && evaluation.status === 'APPROVED'"
        type="info"
        plain
        @click="handleArchive"
      >
        归档
      </el-button>

      <!-- 创建者操作：DRAFT/REJECTED 可编辑+评分+提交，DRAFT/APPROVED/ARCHIVED 可删除 -->
      <template v-if="isCreator">
        <el-button
          v-if="evaluation.status === 'DRAFT' || evaluation.status === 'REJECTED'"
          type="primary"
          plain
          @click="router.push(`/evaluations/${evaluationId}/edit`)"
        >
          <el-icon style="margin-right: 4px"><Edit /></el-icon>
          编辑
        </el-button>
        <el-button
          v-if="evaluation.status === 'DRAFT' || evaluation.status === 'REJECTED'"
          type="warning"
          @click="router.push(`/evaluations/${evaluationId}/rate`)"
        >
          {{ rateButtonText }}
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
        <el-button
          v-if="
            evaluation.status === 'DRAFT' ||
            evaluation.status === 'APPROVED' ||
            evaluation.status === 'ARCHIVED'
          "
          type="danger"
          plain
          @click="handleDelete"
        >
          删除
        </el-button>
      </template>
    </div>

    <template v-if="evaluation">
      <!-- 基本信息 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title">基本信息</span>
        </template>
        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="评价标题">{{ evaluation.title }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusMap[evaluation.status]?.type">
              {{ statusMap[evaluation.status]?.label }}
            </el-tag>
            <!-- 已驳回且已修改的标签 -->
            <el-tag
              v-if="evaluation.status === 'REJECTED' && evaluation.modifiedAt"
              type="success"
              size="small"
              effect="plain"
              style="margin-left: 8px"
            >
              已修改
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

      <!-- 评分进度提示 -->
      <el-alert
        v-if="isCreator && (evaluation.status === 'DRAFT' || evaluation.status === 'REJECTED')"
        :title="
          evaluation.status === 'REJECTED'
            ? '评价已被驳回，请修改后重新提交'
            : isAllRated
              ? '评分已完成，可以提交审核'
              : `评分未完成：已评 ${completedCount} / ${evaluation.participants?.length || 0} 人`
        "
        :type="evaluation.status === 'REJECTED' ? 'error' : isAllRated ? 'success' : 'warning'"
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
        <div class="info-grid">
          <div v-for="(p, index) in evaluation.participants" :key="p.id" class="info-item">
            <div class="info-item-header">
              <span class="info-index">{{ index + 1 }}</span>
              <span class="info-name">{{ p.name }}</span>
            </div>
            <div v-if="p.description" class="info-detail">
              <span class="info-label">说明</span>
              <span class="info-value">{{ p.description }}</span>
            </div>
            <div v-if="p.phone" class="info-detail">
              <span class="info-label">联系方式</span>
              <span class="info-value">{{ p.phone }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 评审人 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title">评审人（{{ evaluation.reviewers?.length || 0 }} 人）</span>
        </template>
        <div class="info-grid">
          <div v-for="(r, index) in evaluation.reviewers" :key="r.id" class="info-item">
            <div class="info-item-header">
              <span class="info-index">{{ index + 1 }}</span>
              <span class="info-name">{{ r.reviewer?.realName || r.reviewer?.username }}</span>
            </div>
            <div class="info-detail">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ r.reviewer?.username }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 评分维度 -->
      <el-card class="section-card">
        <template #header>
          <span class="section-title"
            >评分维度（{{ evaluation.scoreDimensions?.length || 0 }} 个）</span
          >
        </template>
        <div class="info-grid">
          <div v-for="(dim, index) in evaluation.scoreDimensions" :key="dim.id" class="info-item">
            <div class="info-item-header">
              <span class="info-index">{{ index + 1 }}</span>
              <span class="info-name">{{ dim.name }}</span>
              <span class="info-badge">{{ dim.weight }}%</span>
            </div>
            <div v-if="dim.description" class="info-detail">
              <span class="info-label">说明</span>
              <span class="info-value">{{ dim.description }}</span>
            </div>
            <div class="info-detail">
              <span class="info-label">满分</span>
              <span class="info-value">{{ dim.maxScore }} 分</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 评分总览（仅当有评分记录时显示） -->
      <el-card v-if="evaluation.ratingItems?.length" class="section-card">
        <template #header>
          <div class="chart-header">
            <span class="section-title">评分总览</span>
            <div class="chart-toggle">
              <el-button-group size="small">
                <el-button :type="chartType === 'radar' ? 'primary' : ''" @click="switchChartType('radar')">雷达图</el-button>
                <el-button :type="chartType === 'bar' ? 'primary' : ''" @click="switchChartType('bar')">柱状图</el-button>
              </el-button-group>
            </div>
          </div>
        </template>
        <!-- 图表 -->
        <div ref="chartRef" class="score-chart"></div>
        <!-- 分数卡片 -->
        <div class="info-grid">
          <div v-for="item in scoreSummary" :key="item.name" class="score-item">
            <div class="score-item-header">
              <span class="info-name">{{ item.name }}</span>
              <span class="score-total">{{ item.total }}</span>
            </div>
            <div class="score-dimensions">
              <span
                v-for="dim in evaluation.scoreDimensions"
                :key="dim.id"
                class="score-dim"
              >
                {{ dim.name }}: {{ item.scores[dim.id] ?? '-' }}
              </span>
            </div>
            <div v-if="item.comment && item.comment !== '-'" class="score-comment">
              {{ item.comment }}
            </div>
          </div>
        </div>
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
            placeholder="请填写打回原因，以便创建者了解需要修改的内容"
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
  flex-wrap: wrap;
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

/* 让删除按钮始终靠右 */
.action-bar :deep(.el-button--danger.is-plain) {
  margin-left: auto;
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

/* 信息卡片网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.info-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.info-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.info-index {
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

.info-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.info-badge {
  margin-left: auto;
  font-size: 12px;
  color: #409eff;
  font-weight: 500;
}

.info-detail {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
}

.info-label {
  color: #909399;
  flex-shrink: 0;
}

.info-value {
  color: #606266;
  word-break: break-all;
}

/* 图表 */
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-chart {
  width: 100%;
  height: 320px;
  margin-bottom: 20px;
}

/* 评分总览卡片 */
.score-item {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.score-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.score-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}

.score-dim {
  font-size: 12px;
  color: #606266;
  background: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.score-comment {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .action-bar {
    padding: 12px;
    gap: 8px;
  }

  .action-bar :deep(.el-button) {
    min-width: auto;
    flex: 1;
  }

  .section-card :deep(.el-descriptions) {
    --el-descriptions-item-bordered-label-width: 80px;
  }

  /* 所有表格横向滚动 */
  .section-card :deep(.el-table) {
    display: block;
    overflow-x: auto;
  }

  /* 评分总览表格滚动 */
  .section-card :deep(.el-table__body-wrapper) {
    overflow-x: auto;
  }

  /* 弹窗宽度适配 */
  :deep(.el-dialog) {
    width: 95vw !important;
    margin: 10px auto;
  }

  .score-chart {
    height: 260px;
  }
}
</style>
