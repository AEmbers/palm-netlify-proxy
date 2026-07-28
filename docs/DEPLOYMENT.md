# 部署指南

## 架构概览

```
┌─────────────┐     HTTP/HTTPS     ┌──────────────────┐
│  用户设备     │ ◄──────────────── │  Node.js 服务器   │
│  (手机/平板/  │                    │  (Express)       │
│   电脑)      │                    │                  │
└─────────────┘                    │  ┌────────────┐  │
                                   │  │ SQLite DB  │  │
                                   │  │ (用户数据)  │  │
                                   │  └────────────┘  │
                                   │                  │
                                   │  ┌────────────┐  │
                                   │  │ 静态文件    │  │
                                   │  │ (src/)     │  │
                                   │  └────────────┘  │
                                   └──────────────────┘
```

## 本地开发

```bash
# 1. 安装依赖
cd server
npm install

# 2. 启动服务器
npm start

# 3. 访问
# 本机: http://localhost:3000
# 局域网: http://<你的IP>:3000
```

## 部署到云服务器（VPS）

### 1. 上传代码到服务器

```bash
# 方法一：git clone
git clone <你的仓库地址>
cd learning-hub-project/server
npm install

# 方法二：scp 上传
scp -r learning-hub-project/ user@your-server:/path/to/
```

### 2. 使用 PM2 保持服务运行

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd server
pm2 start index.js --name learning-hub

# 设置开机自启
pm2 startup
pm2 save
```

### 3. Nginx 反向代理（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. 启用 HTTPS（推荐）

```bash
# 使用 certbot 申请免费 SSL 证书
sudo certbot --nginx -d your-domain.com
```

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| PORT | 3000 | 服务器端口 |
| JWT_SECRET | learning-hub-secret-key-2026 | JWT 签名密钥（生产环境务必修改） |

```bash
# 设置环境变量
export JWT_SECRET="your-very-secret-key-here"
export PORT=8080
node index.js
```

## 快速内网穿透（无需服务器）

如果只想临时让手机访问，可以使用内网穿透工具：

### 方法一：localtunnel

```bash
npm install -g localtunnel
lt --port 3000
# 会生成一个 https://xxx.loca.lt 链接
```

### 方法二：ngrok

```bash
ngrok http 3000
# 会生成一个 https://xxx.ngrok.io 链接
```

## 数据备份

```bash
# 备份数据库
cp server/data/learning-hub.db server/data/learning-hub.db.bak

# 恢复数据库
cp server/data/learning-hub.db.bak server/data/learning-hub.db
```

## API 接口文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户 |
| PUT | /api/auth/profile | 更新个人资料 |

### 学习进度

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/progress | 获取所有进度 |
| POST | /api/progress | 批量保存进度 |
| GET | /api/progress/summary | 课程汇总 |
| GET | /api/progress/:courseId | 指定课程进度 |

### 测验结果

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/quiz-results | 保存测验结果 |
| GET | /api/quiz-results | 获取所有结果 |
| GET | /api/quiz-results/stats | 统计数据 |
| GET | /api/quiz-results/:courseId | 指定课程结果 |

### 用户设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/settings | 获取设置 |
| PUT | /api/settings | 更新设置 |

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT + bcrypt
- **前端**: 原生 HTML/CSS/JS
- **依赖**: 见 server/package.json
