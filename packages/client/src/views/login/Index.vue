<script setup lang="ts">
/**
 * 登录/注册页面
 */
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { registerApi } from '@/api/auth';
import type { FormInstance } from 'element-plus';
import { Promotion, User as UserIcon, Lock, Refresh } from '@element-plus/icons-vue';

const router = useRouter();
const userStore = useUserStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const isLogin = ref(true);

const loginForm = reactive({
  username: '',
  password: '',
});

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  realName: '',
  email: '',
});

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 个字符', trigger: 'blur' },
  ],
};

const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少 3 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
};

// ========== 数学验证码 ==========
const captchaQuestion = ref('');
const captchaAnswer = ref(0);
const captchaInput = ref('');

function generateCaptcha() {
  const ops = ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
      break;
    case '×':
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      answer = a * b;
      break;
    default:
      a = 1;
      b = 1;
      answer = 2;
  }

  captchaQuestion.value = `${a} ${op} ${b} = ?`;
  captchaAnswer.value = answer;
  captchaInput.value = '';
}

// 初始化验证码
generateCaptcha();

function switchMode() {
  isLogin.value = !isLogin.value;
  formRef.value?.resetFields();
  generateCaptcha();
}

async function handleLogin() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (Number(captchaInput.value) !== captchaAnswer.value) {
    ElMessage.error('验证码错误');
    generateCaptcha();
    return;
  }

  loading.value = true;
  try {
    const success = await userStore.login(loginForm.username, loginForm.password);
    if (success) {
      ElMessage.success('登录成功');
      router.push('/');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '登录失败');
  } finally {
    loading.value = false;
    generateCaptcha();
  }
}

async function handleRegister() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (Number(captchaInput.value) !== captchaAnswer.value) {
    ElMessage.error('验证码错误');
    generateCaptcha();
    return;
  }

  loading.value = true;
  try {
    const res = await registerApi({
      username: registerForm.username,
      password: registerForm.password,
      realName: registerForm.realName,
      email: registerForm.email || undefined,
    });
    if (res.success) {
      ElMessage.success('注册成功，请登录');
      isLogin.value = true;
      loginForm.username = registerForm.username;
      loginForm.password = '';
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '注册失败');
  } finally {
    loading.value = false;
    generateCaptcha();
  }
}

function handleSubmit() {
  if (isLogin.value) {
    handleLogin();
  } else {
    handleRegister();
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧装饰区（桌面端） -->
    <div class="left-panel">
      <div class="left-content">
        <div class="brand-icon">
          <el-icon :size="48"><Promotion /></el-icon>
        </div>
        <h1 class="brand-title">评价系统</h1>
        <p class="brand-desc">高效、便捷的在线评价管理平台</p>
      </div>
    </div>

    <!-- 手机端品牌条 -->
    <div class="mobile-brand">
      <el-icon :size="20" color="#409eff"><Promotion /></el-icon>
      <span>评价系统</span>
    </div>

    <!-- 右侧表单区 -->
    <div class="right-panel">
      <div class="form-card">
        <div class="form-header">
          <h2>{{ isLogin ? '欢迎回来' : '创建账号' }}</h2>
          <p>{{ isLogin ? '请登录您的账号' : '填写信息完成注册' }}</p>
        </div>

        <el-form
          ref="formRef"
          :model="isLogin ? loginForm : registerForm"
          :rules="isLogin ? loginRules : registerRules"
          @keyup.enter="handleSubmit"
          class="auth-form"
        >
          <template v-if="isLogin">
            <el-form-item prop="username">
              <el-input v-model="loginForm.username" placeholder="用户名" size="large">
                <template #prefix>
                  <el-icon><UserIcon /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                show-password
                size="large"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </template>

          <template v-else>
            <div class="form-row">
              <el-form-item prop="realName" class="form-row-item">
                <el-input v-model="registerForm.realName" placeholder="真实姓名" size="large" />
              </el-form-item>
              <el-form-item prop="username" class="form-row-item">
                <el-input v-model="registerForm.username" placeholder="用户名" size="large" />
              </el-form-item>
            </div>
            <el-form-item prop="email">
              <el-input v-model="registerForm.email" placeholder="邮箱（选填）" size="large" />
            </el-form-item>
            <div class="form-row">
              <el-form-item prop="password" class="form-row-item">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  placeholder="密码"
                  show-password
                  size="large"
                />
              </el-form-item>
              <el-form-item prop="confirmPassword" class="form-row-item">
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  placeholder="确认密码"
                  show-password
                  size="large"
                />
              </el-form-item>
            </div>
          </template>

          <el-form-item class="captcha-item">
            <div class="captcha-row">
              <span class="captcha-question">{{ captchaQuestion }}</span>
              <el-input
                v-model="captchaInput"
                placeholder="请输入答案"
                size="large"
                class="captcha-input"
                @keyup.enter="handleSubmit"
              />
              <el-button size="large" @click="generateCaptcha" class="captcha-refresh">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </el-form-item>

          <el-form-item class="submit-item">
            <el-button
              type="primary"
              :loading="loading"
              size="large"
              class="submit-btn"
              @click="handleSubmit"
            >
              {{ isLogin ? '登 录' : '注 册' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="switch-mode">
          <span>{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
          <el-button style="transform: translateY(-1.3px)" type="primary" link @click="switchMode">
            {{ isLogin ? '立即注册' : '返回登录' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

/* 左侧装饰区 */
.left-panel {
  flex: 1;
  background: linear-gradient(135deg, #1a2332 0%, #2d3a4a 50%, #1e3a5f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.left-panel::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at 30% 50%, rgba(64, 158, 255, 0.1) 0%, transparent 50%);
}

.left-panel::after {
  content: '';
  position: absolute;
  bottom: -30%;
  right: -20%;
  width: 60%;
  height: 60%;
  background: radial-gradient(circle, rgba(64, 158, 255, 0.06) 0%, transparent 60%);
}

.left-content {
  text-align: center;
  position: relative;
  z-index: 1;
}

.brand-icon {
  color: #409eff;
  margin-bottom: 20px;
}

.brand-title {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
  letter-spacing: 4px;
}

.brand-desc {
  font-size: 16px;
  color: #8b9bb4;
  margin: 0;
  letter-spacing: 1px;
}

/* 手机端品牌条 */
.mobile-brand {
  display: none;
}

/* 右侧表单区 */
.right-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.form-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.form-header {
  margin-bottom: 28px;
  text-align: center;
}

.form-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: #1a2332;
  margin: 0 0 6px 0;
}

.form-header p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.auth-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  padding: 4px 12px;
}

.auth-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

.auth-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409eff inset;
}

/* 注册表单两列布局 */
.form-row {
  display: flex;
  gap: 12px;
}

.form-row-item {
  flex: 1;
}

.submit-item {
  margin-bottom: 0;
}

/* 验证码 */
.captcha-item {
  margin-bottom: 0;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.captcha-question {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  background: #f5f7fa;
  padding: 0 14px;
  height: 40px;
  line-height: 40px;
  border-radius: 10px;
  white-space: nowrap;
  letter-spacing: 2px;
  user-select: none;
}

.captcha-input {
  flex: 1;
  min-width: 0;
}

.captcha-refresh {
  flex-shrink: 0;
  border-radius: 10px !important;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 10px;
  letter-spacing: 2px;
  margin-top: 20px;
}

.switch-mode {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #606266;
}

/* ========== 手机端适配 ========== */
@media (max-width: 767px) {
  .login-page {
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .left-panel {
    display: none;
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 0 16px;
    font-size: 18px;
    font-weight: 600;
    color: #1a2332;
    flex-shrink: 0;
  }

  .right-panel {
    flex: 1;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .form-card {
    padding: 24px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  .form-header {
    margin-bottom: 20px;
  }

  .form-header h2 {
    font-size: 22px;
  }

  /* 注册表单手机端单列 */
  .form-row {
    flex-direction: column;
    gap: 0;
  }

  .auth-form :deep(.el-form-item) {
    margin-bottom: 14px;
  }

  .submit-btn {
    height: 40px;
  }
}
</style>
