import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi, getUserInfo, register as registerApi } from '@/api/auth'
import { ElMessage } from 'element-plus'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref({})
  const userType = ref(localStorage.getItem('userType') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userType.value === 'admin')

  async function login(data) {
    try {
      const res = await loginApi(data)
      if (res.data) {
        token.value = res.data.token
        userInfo.value = res.data
        userType.value = res.data.type
        
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('userType', res.data.type)
        
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await logoutApi()
        // 不管后端响应如何，都清除本地状态
        clearUserState()
      }
    } catch (error) {
      console.error('Logout error:', error)
      // 即使请求失败也清除本地状态
      clearUserState()
    }
  }

  // 抽取清除状态的逻辑为单独的函数
  function clearUserState() {
    token.value = ''
    userType.value = ''
    userInfo.value = {}
    localStorage.removeItem('token')
    localStorage.removeItem('userType')
  }

  async function fetchUserInfo() {
    if (token.value) {
      try {
        const res = await getUserInfo()
        if (res.data) {
          userInfo.value = res.data
        }
      } catch (error) {
        console.error('Fetch user info error:', error)
        if (error.response?.status === 401) {
          logout()
        }
      }
    }
  }

  async function register(data) {
    try {
      const res = await registerApi(data)
      
      if (res.data) {
        // 注册成功，但不保存登录状态
        // 用户需要重新登录
        return res.data
      }
      throw new Error('注册失败，请稍后重试')
    } catch (error) {
      console.error('Register error:', error)
      throw error
    }
  }

  return {
    token,
    userInfo,
    userType,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchUserInfo,
    register
  }
}) 