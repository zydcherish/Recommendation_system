<template>
  <div class="admin-dashboard">
    <!-- 统计卡片区域 -->
    <el-row :gutter="20">
      <el-col :span="6" v-for="(card, index) in statCards" :key="card.title + index">
        <el-card class="stat-card" shadow="hover">
          <div class="card-content">
            <div class="icon-box" :class="card.type">
              <el-icon><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="title">{{ card.title }}</div>
              <div class="value">{{ card.value }}</div>
              <div class="trend" :class="{ 
                'up': card.trend > 0,
                'down': card.trend < 0 
              }">
                {{ Math.abs(card.trend) }}% 较上月
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :span="16">
        <el-card class="chart-card" shadow="hover">
          <div class="chart-header">
            <h3>订单趋势</h3>
            <el-radio-group v-model="timeRange" size="small">
              <el-radio-button value="week">本周</el-radio-button>
              <el-radio-button value="month">本月</el-radio-button>
            </el-radio-group>
          </div>
          <div class="chart-content">
            <v-chart :option="orderTrendOption" autoresize />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card" shadow="hover">
          <div class="chart-header">
            <h3>资源分布</h3>
          </div>
          <div class="chart-content">
            <v-chart 
              :option="resourceDistOption" 
              :autoresize="false"
              style="width: 100%; height: 300px;"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 动态区域 -->
    <el-row :gutter="20" class="activity-row">
      <el-col :span="16">
        <el-card class="activity-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="title">
                <el-icon><Timer /></el-icon>
                最新订单
              </span>
              <el-button type="primary" link @click="$router.push('/admin/orders')">
                查看全部
              </el-button>
            </div>
          </template>
          <el-scrollbar height="400px">
            <div class="timeline-wrapper">
              <el-timeline>
                <el-timeline-item
                  v-for="(order, index) in recentOrders"
                  :key="`order-${order.id || index}`"
                  :type="getOrderStatusType(order.status)"
                  :timestamp="formatDate(order.created_at)"
                  size="large"
                >
                  <div class="timeline-content">
                    <h4>{{ order.user.username }} 购买了 {{ order.product.name }}</h4>
                    <p class="amount">订单金额：¥{{ order.amount }}</p>
                  </div>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="notification-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <span class="title">
                <el-icon><Bell /></el-icon>
                系统通知
              </span>
              <el-button type="primary" link>全部已读</el-button>
            </div>
          </template>
          <el-scrollbar height="400px">
            <div class="notification-list">
              <div 
                v-for="(notice, index) in notifications" 
                :key="`notice-${notice.id || index}`"
                class="notification-item"
                :class="{ unread: !notice.read }"
              >
                <div class="icon-wrapper" :class="notice.type">
                  <el-icon><component :is="notice.icon" /></el-icon>
                </div>
                <div class="content">
                  <div class="title">{{ notice.title }}</div>
                  <div class="time">{{ notice.time }}</div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, markRaw, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { 
  User, 
  ShoppingCart, 
  Money, 
  Goods,
  Warning,
  SuccessFilled,
  InfoFilled,
  ArrowDown,
  DataAnalysis,
  Box,
  Collection,
  Timer,
  Bell
} from '@element-plus/icons-vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { 
  getAdminStats, 
  getOrderTrends, 
  getProductRanking,
  getDashboardStats,
  getResourceDistribution,
  getRecentOrders
} from '@/api/admin'
import { useIntervalFn } from '@vueuse/core'

// 注册必要的 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
])

const router = useRouter()

// 统计卡片数据
const statCards = ref([
  {
    title: '用户总数',
    value: '0',
    trend: '0',
    icon: markRaw(User),
    type: 'primary'
  },
  {
    title: '资源总数',
    value: '0',
    trend: '0',
    icon: markRaw(Box),
    type: 'success'
  },
  {
    title: '订单总数',
    value: '0',
    trend: '0',
    icon: markRaw(Collection),
    type: 'warning'
  },
  {
    title: '总收入',
    value: '¥0',
    trend: '0',
    icon: markRaw(Money),
    type: 'danger'
  }
])

// 订单趋势图配置
const timeRange = ref('week')
const orderTrendOption = ref({
  grid: {
    top: 40,
    right: 20,
    bottom: 30,
    left: 40
  },
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['总订单数', '已支付订单']
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  },
  yAxis: {
    type: 'value',
    splitLine: {
      lineStyle: {
        type: 'dashed'
      }
    }
  },
  series: [
    {
      name: '总订单数',
      type: 'line',
      smooth: true,
      data: [0, 0, 0, 0, 0, 0, 0],
      itemStyle: {
        color: '#409EFF'
      }
    },
    {
      name: '已支付订单',
      type: 'line',
      smooth: true,
      data: [0, 0, 0, 0, 0, 0, 0],
      itemStyle: {
        color: '#67C23A'
      }
    }
  ]
})

// 资源分布图配置
const resourceDistOption = ref({
  tooltip: {
    trigger: 'item',
    formatter: params => {
      const data = params.data
      return `${data.name}<br/>总数：${data.value || 0}台<br/>可用：${data.activeCount || 0}台<br/>占比：${params.percent}%`
    }
  },
  legend: {
    orient: 'horizontal',
    top: 10,
    left: 'center',
    itemWidth: 25,
    itemHeight: 14,
    itemGap: 30,
    textStyle: {
      fontSize: 14,
      color: '#666'
    }
  },
  series: [
    {
      name: '资源分布',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'outside',
        formatter: '{d}%',
        fontSize: 14,
        color: '#666'
      },
      labelLine: {
        show: true,
        length: 15,
        length2: 10
      },
      emphasis: {
        scale: true,
        scaleSize: 10
      },
      color: [
        '#409EFF',  // basic - 基础型
        '#67C23A',  // performance - 性能型
        '#E6A23C'   // premium - 高级型
      ],
      data: [
        { name: '基础型', value: 0, activeCount: 0 },
        { name: '性能型', value: 0, activeCount: 0 },
        { name: '高级型', value: 0, activeCount: 0 }
      ]
    }
  ]
})

// 最新订单数据
const recentOrders = ref([
  {
    id: 1,
    user: { username: '张三' },
    product: { name: '高性能云服务器' },
    amount: 199.99,
    status: 'pending',
    created_at: new Date(Date.now() - 1000 * 60 * 30) // 30分钟前
  },
  {
    id: 2,
    user: { username: '李四' },
    product: { name: '数据库服务' },
    amount: 299.99,
    status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 60) // 1小时前
  },
  {
    id: 3,
    user: { username: '王五' },
    product: { name: 'AI计算服务' },
    amount: 599.99,
    status: 'completed',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2小时前
  }
])

// 系统通知数据
const notifications = ref([
  {
    id: 1,
    type: 'user_register',
    title: '新用户注册',
    content: '用户 xiaoming 已注册成功',
    time: '10分钟前',
    read: false
  },
  {
    id: 2,
    type: 'order_create', 
    title: '新订单提交',
    content: '用户 xiaoming 提交了新订单 #12345',
    time: '30分钟前',
    read: false
  },
  {
    id: 3,
    type: 'order_pay',
    title: '订单支付成功',
    content: '订单 #12345 已完成支付',
    time: '1小时前',
    read: true
  }
])

// 获取统计数据
const fetchStats = async () => {
  try {
    const res = await getDashboardStats()
    if (res.code === 200 && res.data) {
      // 更新统计卡片数据
      statCards.value[0].value = res.data.userCount.value
      statCards.value[0].trend = res.data.userCount.trend
      statCards.value[1].value = res.data.resourceCount.value
      statCards.value[1].trend = res.data.resourceCount.trend
      statCards.value[2].value = res.data.orderCount.value
      statCards.value[2].trend = res.data.orderCount.trend
      statCards.value[3].value = res.data.totalIncome.value
      statCards.value[3].trend = res.data.totalIncome.trend
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 获取订单趋势数据
const fetchOrderTrends = async () => {
  try {
    const res = await getOrderTrends({ type: timeRange.value })
    if (res.code === 200 && res.data) {
      orderTrendOption.value.xAxis.data = res.data.dates
      orderTrendOption.value.series[0].data = res.data.series[0].data
      orderTrendOption.value.series[1].data = res.data.series[1].data
    }
  } catch (error) {
    console.error('获取订单趋势失败:', error)
  }
}

// 获取资源分布数据
const fetchResourceDistribution = async () => {
  try {
    console.log('Fetching resource distribution...')
    const res = await getResourceDistribution()
    console.log('API Response:', res)
    
    if (res.code === 200 && res.data) {
      // 确保数据存在且为数组
      if (!Array.isArray(res.data)) {
        console.error('Invalid data format:', res.data)
        return
      }

      const newData = res.data.map(item => ({
        name: item.name,
        value: Number(item.value),
        activeCount: Number(item.activeCount)
      }))
      
      console.log('Processed chart data:', newData)
      
      if (newData.length > 0) {
        resourceDistOption.value.series[0].data = newData
        console.log('Updated chart data:', resourceDistOption.value.series[0].data)
      }
    }
  } catch (error) {
    console.error('获取资源分布失败:', error)
  }
}

// 获取最新订单
const fetchRecentOrders = async () => {
  try {
    const res = await getRecentOrders()
    if (res.code === 200 && res.data) {
      recentOrders.value = res.data
    }
  } catch (error) {
    console.error('获取最新订单失败:', error)
  }
}

// 获取产品排行数据
const fetchProductRanking = async () => {
  try {
    const res = await getProductRanking()
    if (res.code === 200) {
      console.log('Product ranking data:', res.data)
    }
  } catch (error) {
    console.error('获取产品排行失败:', error)
  }
}

// 订单状态对应的类型
const getOrderStatusType = (status) => {
  const statusMap = {
    pending: 'warning',
    completed: 'success',
    cancelled: 'info'
  }
  return statusMap[status] || 'info'
}

// 格式化日期
const formatDate = (date) => {
  const now = new Date()
  const diff = now - new Date(date)
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

// 设置自动刷新间隔（例如每分钟刷新一次）
useIntervalFn(() => {
  fetchOrderTrends()
}, 60 * 1000)

// 监听图表类型变化
watch(timeRange, () => {
  fetchOrderTrends()
})

const initChart = async () => {
  await fetchResourceDistribution()
  // 强制重新渲染图表
  nextTick(() => {
    const chart = document.querySelector('.chart-content .echarts')
    if (chart) {
      chart.__vue__?.resize()
    }
  })
}

onMounted(async () => {
  Promise.all([
    fetchResourceDistribution(),
    fetchStats(),
    fetchOrderTrends(),
    fetchRecentOrders()
  ]).catch(error => {
    console.error('Failed to fetch data:', error)
  })
})

// 获取通知图标
const getNotificationIcon = (type) => {
  switch (type) {
    case 'user_register': return 'User'
    case 'order_create': return 'ShoppingCart'
    case 'order_pay': return 'Check'
    default: return 'Info'
  }
}

// 获取通知类型样式
const getNotificationClass = (type) => {
  switch (type) {
    case 'user_register': return 'primary'
    case 'order_create': return 'warning'
    case 'order_pay': return 'success'
    default: return 'info'
  }
}
</script>

<style lang="scss" scoped>
.admin-dashboard {
  padding: 20px;

  .el-row {
    margin-bottom: 20px;
  }

  .stat-card {
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-5px);
    }

    .card-content {
      display: flex;
      align-items: center;
      padding: 10px;
      
      .icon-box {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 15px;
        
        .el-icon {
          font-size: 24px;
          color: #fff;
        }
        
        &.primary { background-color: #409EFF; }
        &.success { background-color: #67C23A; }
        &.warning { background-color: #E6A23C; }
        &.danger { background-color: #F56C6C; }
      }

      .stat-info {
        flex: 1;
        
        .title {
          font-size: 14px;
          color: #909399;
          margin-bottom: 8px;
        }
        
        .value {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .trend {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }

  .chart-row {
    margin-top: 20px;

    .chart-card {
      .chart-header {
        padding: 15px 20px;
        border-bottom: 1px solid #EBEEF5;
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: normal;
        }
      }

      .chart-content {
        height: 350px;
        padding: 20px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;

        :deep(.echarts) {
          width: 100% !important;
          height: 300px !important;
        }
      }
    }
  }

  .activity-row {
    .activity-card {
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }

    .timeline-wrapper {
      padding: 20px;
      
      .timeline-content {
        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: normal;
          color: #303133;
        }
        
        .amount {
          margin: 5px 0 0;
          font-size: 13px;
          color: #67C23A;
          font-weight: bold;
        }
      }
    }

    .notification-card {
      .notification-list {
        .notification-item {
          padding: 10px 15px;
          
          .icon-wrapper {
            width: 32px;
            height: 32px;
            
            .el-icon {
              font-size: 16px;
            }
          }
          
          .content {
            .title {
              font-size: 13px;
            }
            
            .time {
              font-size: 11px;
            }
          }
        }
      }
    }
  }
}
</style>
