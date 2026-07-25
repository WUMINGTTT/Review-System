<script setup lang="ts">
/**
 * 应用根组件
 *
 * 所有页面都在 <router-view> 中渲染
 * 路由切换时，<router-view> 会渲染对应的页面组件
 */
</script>

<template>
  <!-- router-view 渲染当前路由匹配的组件 -->
  <router-view />
</template>

<style>
/* 全局基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
