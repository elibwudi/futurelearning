# 认知图谱学习平台 - 系统功能说明书

**版本**: 1.0
**更新日期**: 2025-12-24
**系统名称**: 认知图谱学习平台 (Cognitive Map Learning Platform)

---

## 目录

1. [系统概述](#系统概述)
2. [系统架构](#系统架构)
3. [核心功能模块](#核心功能模块)
4. [用户角色与权限](#用户角色与权限)
5. [技术栈](#技术栈)
6. [数据模型](#数据模型)
7. [API接口文档](#api接口文档)
8. [安全机制](#安全机制)
9. [部署说明](#部署说明)
10. [系统配置](#系统配置)

---

## 系统概述

### 产品定位

认知图谱学习平台是一个基于AI驱动的智能教学系统，通过知识图谱可视化和自适应学习路径，为学生提供个性化的学习体验。

### 核心特性

- **AI自动生成**: 从PDF教材自动生成知识图谱
- **可视化学习路径**: 基于D3.js的交互式知识图谱展示
- **智能教学**: AI生成讲义、题库和实时答疑
- **自适应学习**: 根据测验结果自动调整学习路径
- **多角色协作**: 支持管理员、教师、学生三种角色
- **权限管理**: 精细化的课程权限控制

### 应用场景

- 在线教育平台
- 企业培训系统
- 知识库管理
- 个性化学习辅导

---

## 系统架构

### 总体架构

```mermaid
graph TB
    subgraph "前端层 Frontend"
        A[React应用<br/>Vite + TypeScript]
        A1[组件层<br/>10个核心组件]
        A2[服务层<br/>5个服务模块]
        A3[状态管理<br/>React Hooks]
    end
  
    subgraph "后端层 Backend"
        B[Node.js服务器<br/>Express + PostgreSQL]
        B1[API路由层<br/>RESTful API]
        B2[认证中间件<br/>JWT Token]
        B3[AI代理层<br/>多模型支持]
    end
  
    subgraph "数据层 Data"
        C[(PostgreSQL数据库)]
        C1[用户表]
        C2[课程表]
        C3[进度表]
        C4[权限表]
        C5[设置表]
        C6[内容缓存表]
    end
  
    subgraph "AI服务层"
        D[AI模型]
        D1[DeepSeek]
        D2[智谱AI]
        D3[Qwen]
        D4[Gemini]
        D5[Ollama本地]
    end
  
    A --> B
    B --> C
    B --> D
```

### 技术架构分层

| 层级             | 技术栈                 | 职责                         |
| ---------------- | ---------------------- | ---------------------------- |
| **展示层** | React 19 + TypeScript  | UI渲染、用户交互             |
| **业务层** | Express.js + Node.js   | 业务逻辑、API服务            |
| **数据层** | PostgreSQL 16 + Prisma | 数据持久化与高性能关系型查询 |
| **AI层**   | 多模型集成             | 内容生成、智能问答           |

---

## 核心功能模块

### 1. 用户认证模块

**功能说明**:

- 用户注册与登录
- JWT Token认证
- 角色权限验证
- 会话管理

**核心组件**:

- `AuthModal.tsx` - 登录/注册界面
- `authService.ts` - 认证服务

**关键功能**:

- ✅ 匿名用户自动创建
- ✅ 注册时数据迁移
- ✅ 24小时Token有效期
- ✅ 密码PBKDF2加密

---

### 2. 课程管理模块

**功能说明**:

- 课程创建与编辑
- 知识图谱设计
- 课程发布管理
- 课程可见性控制

**核心组件**:

- `Dashboard.tsx` - 课程列表展示
- `CourseCreator.tsx` - 课程创建/编辑器
- `ForceGraph.tsx` - 知识图谱可视化

**创建流程**:

```mermaid
graph LR
    A[上传PDF/输入文本] --> B[AI生成图谱]
    B --> C[手动调整节点]
    C --> D[一键生成全课内容]
    D --> E[发布课程]
```

**关键功能**:

- ✅ PDF文本提取
- ✅ AI自动生成40-45个知识点
- ✅ 可视化编辑节点和连线
- ✅ 批量生成讲义和题库
- ✅ 视频上传到知识点

---

### 3. 学习模块

**功能说明**:

- 知识点学习
- AI讲义生成
- 视频学习
- 实时AI答疑
- 测验系统

**核心组件**:

- `CourseLearner.tsx` - 课程学习界面
- `LearningPanel.tsx` - 学习面板
- `RichTextEditor.tsx` - 富文本编辑器

**学习流程**:

```mermaid
graph TB
    A[选择课程] --> B[查看知识图谱]
    B --> C[点击可学习节点]
    C --> D[阅读AI讲义]
    D --> E{观看视频?}
    E -->|是| F[观看教学视频]
    E -->|否| G[与AI导师对话]
    F --> G
    G --> H[开始测验]
    H --> I{是否通过?}
    I -->|是| J[节点标记为已掌握]
    I -->|否| K[进入补习模式]
    K --> D
    J --> L[解锁后续节点]
```

**关键功能**:

- ✅ 依赖关系锁定
- ✅ 自动AI讲义生成
- ✅ 补习模式重新讲解
- ✅ 3/3题目全对才通过
- ✅ 实时AI对话辅导

---

### 4. AI内容生成模块

**功能说明**:

- 知识图谱生成
- 讲义内容生成
- 题库生成
- 智能答疑

**核心组件**:

- `geminiService.ts` - AI服务集成

**支持的AI模型**:

| 模型       | 提供商   | 用途     |
| ---------- | -------- | -------- |
| DeepSeek   | DeepSeek | 通用对话 |
| GLM-4      | 智谱AI   | 中文理解 |
| Qwen       | 阿里云   | 快速响应 |
| Gemini     | Google   | 多模态   |
| openAI兼容 | 本地部署 | 离线使用 |

**内容缓存机制**:

- ✅ 讲义内容缓存
- ✅ 补习内容缓存
- ✅ 题库缓存（10题池）
- ✅ 避免重复生成

---

### 5. 权限管理模块

**功能说明**:

- 课程权限分配
- 教师团队管理
- 权限级别控制

**核心组件**:

- `CoursePermissionsModal.tsx` - 权限管理界面
- `UserManagement.tsx` - 用户管理

**权限级别**:

| 级别              | 名称         | 权限                      |
| ----------------- | ------------ | ------------------------- |
| **owner**   | 课程责任教师 | 全部权限（编辑结构+内容） |
| **member**  | 课程团队成员 | 仅编辑内容                |
| **student** | 学生         | 仅学习                    |

**关键功能**:

- ✅ 细粒度权限控制
- ✅ 权限继承
- ✅ 批量授权
- ✅ 权限审计

---

### 6. 系统设置模块

**功能说明**:

- AI模型配置
- 用户管理
- 系统参数设置

**核心组件**:

- `SettingsModal.tsx` - 设置界面

**管理员功能**:

- ✅ 创建教师账号
- ✅ 重置密码
- ✅ 删除用户
- ✅ 配置AI参数
- ✅ 查看系统状态

---

## 用户角色与权限

### 角色定义

```mermaid
graph TD
    A[用户角色] --> B[管理员 Admin]
    A --> C[教师 Teacher]
    A --> D[学生 Student]
  
    B --> B1[所有权限]
    B --> B2[用户管理]
    B --> B3[系统设置]
    B --> B4[查看所有课程]
  
    C --> C1[创建课程]
    C --> C2[编辑授权课程]
    C --> C3[管理课程权限]
    C --> C4[查看已授权课程]
  
    D --> D1[学习课程]
    D --> D2[查看进度]
    D --> D3[与AI对话]
```

### 权限矩阵

| 功能               | 管理员 | 教师           | 学生 |
| ------------------ | ------ | -------------- | ---- |
| **用户管理** |        |                |      |
| 创建教师账号       | ✅     | ❌             | ❌   |
| 重置密码           | ✅     | ❌             | ❌   |
| 删除用户           | ✅     | ❌             | ❌   |
| **课程管理** |        |                |      |
| 创建课程           | ✅     | ✅             | ❌   |
| 编辑自己的课程     | ✅     | ✅             | ❌   |
| 编辑他人课程       | ✅     | ⚠️ 需授权    | ❌   |
| 删除课程           | ✅     | ✅ (owner)     | ❌   |
| 查看隐藏课程       | ✅     | ⚠️ 作者/授权 | ❌   |
| 管理课程权限       | ✅     | ✅ (owner)     | ❌   |
| **学习功能** |        |                |      |
| 学习课程           | ✅     | ✅             | ✅   |
| 查看进度           | ✅     | ✅             | ✅   |
| AI对话             | ✅     | ✅             | ✅   |
| **系统设置** |        |                |      |
| 配置AI模型         | ✅     | ❌             | ❌   |
| 查看系统设置       | ✅     | ⚠️ 只读      | ❌   |

---

## 技术栈

### 前端技术栈

| 技术                   | 版本    | 用途         |
| ---------------------- | ------- | ------------ |
| **React**        | 19.2.0  | UI框架       |
| **TypeScript**   | 5.8.2   | 类型系统     |
| **Vite**         | 6.2.0   | 构建工具     |
| **D3.js**        | 7.9.0   | 图谱可视化   |
| **TipTap**       | 3.14.0  | 富文本编辑器 |
| **Lucide React** | 0.555.0 | 图标库       |
| **PDF.js**       | 4.10.38 | PDF解析      |

### 后端技术栈

| 技术              | 版本    | 用途     |
| ----------------- | ------- | -------- |
| **Node.js** | 24.11.1 | 运行环境 |
| **Express** | 最新    | Web框架  |
| **PostgreSQL**  | 3       | 数据库   |
| **JWT**     | 最新    | 身份认证 |
| **Multer**  | 最新    | 文件上传 |
| **Crypto**  | 内置    | 密码加密 |

### AI集成

- DeepSeek API
- 智谱AI API
- Qwen API
- Google Gemini API
- openAI兼容

## 数据模型

### 数据库设计

#### ER图

```mermaid
erDiagram
    USERS ||--o{ COURSES : creates
    USERS ||--o{ USER_PROGRESS : has
    COURSES ||--o{ USER_PROGRESS : tracks
    COURSES ||--o{ COURSE_PERMISSIONS : grants
    USERS ||--o{ COURSE_PERMISSIONS : receives
    COURSES ||--o{ CONTENT_CACHE : stores
  
    USERS {
        string id PK
        string username UK
        string name
        string salt
        string hash
        string role
        int isAnonymous
    }
  
    COURSES {
        string id PK
        string title
        text description
        text rawText
        text graphData
        int createdAt
        string status
        string authorId FK
    }
  
    USER_PROGRESS {
        int id PK
        string userId FK
        string courseId FK
        text progress
        int updatedAt
    }
  
    COURSE_PERMISSIONS {
        int id PK
        string courseId FK
        string userId FK
        string permissionLevel
        int grantedAt
        string grantedBy
    }
  
    CONTENT_CACHE {
        int id PK
        string courseId FK
        string nodeId
        string type
        text data
        int createdAt
    }
  
    SETTINGS {
        int id PK
        string provider
        text apiKeys
        text models
    }
```

### 核心表结构

> **更新声明 (v1.1)**: 系统底层数据库已由单文件 PostgreSQL 全面升级至关系型数据库 **PostgreSQL 16**。所有的底层数据交互目前由 **Prisma ORM** 接管。以下展示的 SQL 结构现已统一映射至后端的 `server/prisma/schema.prisma` 模型中。

#### 1. users - 用户表

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    name TEXT NOT NULL,
    salt TEXT,
    hash TEXT,
    role TEXT DEFAULT 'student',
    isAnonymous INTEGER DEFAULT 0
);
```

**说明**:

- `id`: 用户唯一标识
- `username`: 登录用户名
- `salt/hash`: PBKDF2加密密码
- `role`: student | teacher | admin
- `isAnonymous`: 是否匿名用户

#### 2. courses - 课程表

```sql
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    rawText TEXT,
    graphData TEXT,
    createdAt INTEGER,
    status TEXT DEFAULT 'draft',
    authorId TEXT
);
```

**说明**:

- `graphData`: JSON格式的知识图谱
- `status`: draft | ready | hidden
- `authorId`: 课程创建者ID

#### 3. user_progress - 学习进度表

```sql
CREATE TABLE user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    courseId TEXT NOT NULL,
    progress TEXT,
    updatedAt INTEGER,
    UNIQUE(userId, courseId)
);
```

**说明**:

- `progress`: JSON格式，存储每个节点的学习状态

#### 4. course_permissions - 课程权限表

```sql
CREATE TABLE course_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId TEXT NOT NULL,
    userId TEXT NOT NULL,
    permissionLevel TEXT DEFAULT 'member',
    grantedAt INTEGER,
    grantedBy TEXT,
    UNIQUE(courseId, userId)
);
```

**说明**:

- `permissionLevel`: owner | member

#### 5. content_cache - 内容缓存表

```sql
CREATE TABLE content_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId TEXT NOT NULL,
    nodeId TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT,
    createdAt INTEGER,
    UNIQUE(courseId, nodeId, type)
);
```

**说明**:

- `type`: lesson | remediation | quiz_pool

#### 6. settings - 系统设置表

```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    provider TEXT,
    deepseekApiKey TEXT,
    deepseekModel TEXT,
    zhipuApiKey TEXT,
    zhipuModel TEXT,
    ollamaBaseUrl TEXT,
    ollamaModel TEXT,
    qwenApiKey TEXT,
    qwenModel TEXT,
    geminiApiKey TEXT,
    geminiModel TEXT
);
```

---

## API接口文档

### 认证相关

#### POST /api/auth/signup

**说明**: 用户注册
**请求体**:

```json
{
  "username": "string",
  "password": "string",
  "name": "string",
  "tempId": "string (optional)"
}
```

**响应**:

```json
{
  "user": { "id": "...", "name": "...", "role": "..." },
  "token": "JWT_TOKEN"
}
```

#### POST /api/auth/login

**说明**: 用户登录
**认证**: 无
**请求体**:

```json
{
  "username": "string",
  "password": "string"
}
```

### 课程相关

#### GET /api/courses

**说明**: 获取课程列表
**认证**: 可选
**响应**: 返回用户可见的课程列表

#### GET /api/courses/:id

**说明**: 获取课程详情
**认证**: 可选
**响应**: 课程完整信息 + 权限标识

#### POST /api/courses

**说明**: 创建/更新课程
**认证**: ✅ 必需
**请求体**:

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "rawText": "string",
  "graphData": { "nodes": [], "edges": [] },
  "status": "draft | ready | hidden"
}
```

#### DELETE /api/courses/:id

**说明**: 删除课程
**认证**: ✅ 必需
**权限**: admin | owner

#### PUT /api/courses/:id/visibility

**说明**: 切换课程可见性
**认证**: ✅ 必需
**权限**: admin | owner

### 权限管理

#### GET /api/courses/:id/permissions

**说明**: 获取课程权限列表
**认证**: ✅ 必需

#### POST /api/courses/:id/permissions

**说明**: 添加课程权限
**认证**: ✅ 必需
**权限**: admin | owner
**请求体**:

```json
{
  "teacherId": "string",
  "permissionLevel": "owner | member"
}
```

#### DELETE /api/courses/:id/permissions/:userId

**说明**: 移除课程权限
**认证**: ✅ 必需
**权限**: admin | owner

### 学习进度

#### GET /api/progress/:courseId/:userId

**说明**: 获取学习进度
**认证**: ✅ 必需

#### POST /api/progress

**说明**: 保存学习进度
**认证**: ✅ 必需
**请求体**:

```json
{
  "userId": "string",
  "courseId": "string",
  "progress": { "nodeId": { "status": "...", "score": 0 } }
}
```

### AI相关

#### POST /api/ai/chat

**说明**: AI对话
**认证**: ❌ 无
**请求体**:

```json
{
  "prompt": "string",
  "systemInstruction": "string",
  "jsonMode": boolean
}
```

### 文件上传

#### POST /api/upload/video

**说明**: 上传视频
**认证**: ✅ 必需
**限制**: 2GB
**格式**: multipart/form-data

#### POST /api/upload/image

**说明**: 上传图片
**认证**: ✅ 必需
**限制**: 10MB
**格式**: multipart/form-data

### 系统设置

#### GET /api/settings

**说明**: 获取AI配置
**认证**: ❌ 无

#### POST /api/settings

**说明**: 保存AI配置
**认证**: ✅ 必需
**权限**: admin

### 用户管理

#### GET /api/users

**说明**: 获取用户列表
**认证**: ✅ 必需

#### POST /api/users

**说明**: 创建用户
**认证**: ✅ 必需
**权限**: admin

#### DELETE /api/users/:id

**说明**: 删除用户
**认证**: ✅ 必需
**权限**: admin

#### PUT /api/users/:id/reset-password

**说明**: 重置密码
**认证**: ✅ 必需
**权限**: admin

---

## 安全机制

### 1. 身份认证

- **JWT Token**: 24小时有效期
- **密码加密**: PBKDF2 + Salt
- **密码策略**: 最短6位
- **会话管理**: LocalStorage存储

### 2. 权限控制

- **角色基础**: RBAC模型
- **细粒度权限**: 课程级别权限
- **权限继承**: 管理员 > owner > member
- **动态权限**: 运行时验证

### 3. API安全

- **认证中间件**: authenticateToken
- **Token验证**: JWT签名验证
- **CORS配置**: 跨域请求控制
- **输入验证**: 参数校验

### 4. 文件上传安全

- **认证保护**: 必须登录
- **文件类型**: 白名单限制
- **大小限制**: 视频2GB、图片10MB
- **路径安全**: 防止目录遍历

### 5. 数据安全

- **SQL注入防护**: 参数化查询
- **XSS防护**: 内容过滤
- **CSRF保护**: Token验证
- **敏感信息**: 不在前端存储

---

## 部署说明

### 环境要求

**硬件要求**:

- CPU: 2核心以上
- 内存: 4GB以上
- 磁盘: 20GB以上

**软件要求**:

- Node.js 18+
- npm 8+
- PostgreSQL 3

### 安装与部署指南

#### 1. 克隆代码

```bash
git clone <repository-url>
cd fl1202
```

#### 2. 安装依赖包

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
```

#### 3. 配置数据库与环境变量

在 `server/` 目录下创建 `.env` 文件，并填入以下内容（请根据您的 PostgreSQL 实际情况修改）：

```env
# PostgreSQL 数据库连接字符串
DATABASE_URL="postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202"

# JWT 安全密钥
JWT_SECRET="your-secret-key-change-this-in-production"

# 后端服务端口
PORT=3008
```

#### 4. 初始化数据库

确保您本地已经安装并运行了 PostgreSQL 数据库。然后执行数据库结构同步：

```bash
cd server
# 生成 Prisma Client
npx prisma generate

# 将数据表结构推送到数据库
npx prisma db push
```

#### 5. 启动服务

**开发环境**:

```bash
# 终端1：启动后端API与静态服务
cd server
node server.js

# 终端2：启动前端Vite热更新服务
npm run dev
```

**生产环境 (Windows 系统服务或后台运行)**:

```bash
# 1. 构建前端产物
npm run build

# 2. 启动混合模式服务 (包含API和前端静态网页)
cd server
node server.js
```

### 目录结构

```
fl1202/
├── components/          # React组件
│   ├── Dashboard.tsx
│   ├── CourseCreator.tsx
│   ├── CourseLearner.tsx
│   └── ...
├── services/           # 服务层
│   ├── authService.ts
│   ├── geminiService.ts
│   └── storageService.ts
├── server/            # 后端服务
│   ├── server.js
│   ├── database.PostgreSQL
│   └── public/
│       └── uploads/   # 上传文件
├── types.ts           # TypeScript类型
├── App.tsx            # 主应用
└── package.json
```

---

## 系统配置

### 默认账号

| 用户名  | 密码               | 角色   |
| ------- | ------------------ | ------ |
| admin   | ***8888*** | 管理员 |
| teacher | teer123            | 教师   |

**⚠️ 生产环境请立即修改默认密码**

### AI模型配置

在系统设置中配置：

1. 选择AI提供商
2. 输入API Key
3. 选择模型
4. 保存配置

### 端口配置

- 前端开发服务器: `3008`
- 后端API服务器: `3001`
- 生产环境: `3001` (同时提供静态文件和API)

### 文件存储

- 视频文件: `server/public/uploads/videos/`
- 图片文件: `server/public/uploads/images/`
- 数据库: `server/database.PostgreSQL`

---

## 附录

### A. 常见问题

**Q: 如何添加新的AI模型？**
A: 在 `server/server.js`的 `proxyAIRequest`函数中添加新provider的处理逻辑。

**Q: 如何备份数据？**
A: 复制 `server/database.PostgreSQL`文件和 `server/public/uploads`目录。

**Q: 如何重置管理员密码？**
A: 使用 `server/cleanup-course.js`脚本重置。

### B. 更新日志

**v1.0 (2025-12-24)**

- ✅ 完整的JWT认证系统
- ✅ 文件上传安全加固
- ✅ 课程权限管理
- ✅ 多AI模型支持
- ✅ 知识图谱可视化

### C. 联系方式

- 技术支持: [elibwudi@gmail.com]
- 问题反馈: [GitHub Issues]
- 文档更新: [2026.05.16]

---

**© 2025 认知图谱学习平台 | 版本 1.1**
