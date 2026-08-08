<!-- src/components/StatCard.vue -->
<script setup lang="ts">
/**
 * 统计卡片组件
 *
 * Props:
 * - title: 卡片标题
 * - value: 数值
 * - icon: 图标组件
 * - color: 图标颜色
 */
import type { Component } from 'vue';

defineProps<{
  title: string;
  value: number;
  icon: Component;
  color?: string;
}>();
</script>

<template>
  <el-card class="stat-card" shadow="hover" @click="$emit('click')">
    <div class="stat-content">
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">{{ value }}</div>
      </div>
      <div class="stat-icon" :style="{ backgroundColor: color || '#409eff' }">
        <el-icon :size="24">
          <component :is="icon" />
        </el-icon>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.stat-card {
  cursor: pointer;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
</style>
