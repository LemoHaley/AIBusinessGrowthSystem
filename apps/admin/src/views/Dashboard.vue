<script setup lang="ts">
/**
 * 数据看板：四项经营统计卡 + 近 7 日报告数/积分消耗双折线图（ECharts）
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import { get } from '@/api/http';
import type { DashboardSummary } from '@/api/types';

const loading = ref(false);
const summary = ref<DashboardSummary | null>(null);

const reportRef = ref<HTMLDivElement>();
const consumeRef = ref<HTMLDivElement>();
let reportChart: echarts.ECharts | null = null;
let consumeChart: echarts.ECharts | null = null;

function renderCharts(): void {
  if (!summary.value || !reportRef.value || !consumeRef.value) return;
  reportChart = echarts.init(reportRef.value);
  reportChart.setOption({
    title: { text: '近 7 日 AI 报告数' },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: summary.value.reportTrend.map((t) => t.date) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '报告数',
        type: 'line',
        smooth: true,
        data: summary.value.reportTrend.map((t) => t.count),
      },
    ],
  });
  consumeChart = echarts.init(consumeRef.value);
  consumeChart.setOption({
    title: { text: '近 7 日积分消耗' },
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: summary.value.consumeTrend.map((t) => t.date) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '积分消耗',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: summary.value.consumeTrend.map((t) => t.points),
      },
    ],
  });
}

function handleResize(): void {
  reportChart?.resize();
  consumeChart?.resize();
}

onMounted(async () => {
  loading.value = true;
  try {
    summary.value = await get<DashboardSummary>('/dashboard/summary');
    await nextTick();
    renderCharts();
    window.addEventListener('resize', handleResize);
  } catch {
    // 错误提示由 axios 拦截器统一弹出
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  reportChart?.dispose();
  consumeChart?.dispose();
  reportChart = null;
  consumeChart = null;
});
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card>
          <div class="stat-label">学员总数</div>
          <div class="stat-value">{{ summary?.studentCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-label">班级总数</div>
          <div class="stat-value">{{ summary?.classCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-label">本月 AI 报告数</div>
          <div class="stat-value">{{ summary?.monthReportCount ?? '-' }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-label">本月积分消耗</div>
          <div class="stat-value">{{ summary?.monthPointsConsumed ?? '-' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <el-card>
          <div ref="reportRef" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <div ref="consumeRef" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.stat-label {
  font-size: 14px;
  color: #909399;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  margin-top: 8px;
}

.chart-row {
  margin-top: 16px;
}

.chart-box {
  height: 320px;
}
</style>
