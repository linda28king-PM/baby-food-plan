# 🌾 宝宝辅食计划

一个为 6-12 月龄宝宝量身定制的辅食计划工具，无需登录、无需服务器，纯静态页面，完美适配微信打开。

## ✨ 特性

- 📅 **按月龄智能展示**：输入宝宝出生日期，自动定位当前月龄阶段
- 🗓️ **按周/按日筛选食谱**：一周食谱可按"周一~周日"或"看全周"切换
- ✅ **已尝试食材打勾管理**：60+ 种食材按分类（谷物/蔬菜/水果/肉鱼蛋/乳制品）管理
- 🌱 **过敏观察记录**：新食材连续 3 天观察，自动统计安全/疑似过敏
- 🔗 **URL 分享**：把宝宝的辅食计划生成链接发给家人朋友，他们打开就看到你的设置
- 💾 **本地自动保存**：数据存在浏览器，下次打开免输入
- 📱 **移动端优化**：专为微信内打开设计，单手操作友好

## 🚀 部署到 GitHub Pages

### 方法 1：网页操作（最简单）

1. 在 GitHub 创建一个新仓库，例如 `baby-food`
2. 将本项目所有文件上传到仓库（保持目录结构）
3. 进入仓库 **Settings → Pages**
4. 在 "Source" 下选择 **Deploy from a branch**
5. 选择 `main` 分支、`/ (root)` 目录，点击 Save
6. 等待 1-2 分钟，访问 `https://你的用户名.github.io/baby-food/` 即可

### 方法 2：命令行

```bash
# 1. 克隆/初始化仓库
git init
git add .
git commit -m "init: baby food planner"

# 2. 关联远程仓库
git remote add origin https://github.com/你的用户名/baby-food.git
git branch -M main
git push -u origin main

# 3. 在 GitHub 网页上启用 Pages（同方法 1 第 3-5 步）
```

## 📂 项目结构

```
baby-food/
├── index.html          # 入口页面
├── assets/
│   ├── styles.css      # 样式
│   ├── storage.js      # 本地存储 + URL 编码
│   └── app.js          # 主应用逻辑
├── data/
│   └── foods.js        # 辅食数据库（6-12月龄）
└── README.md
```

## 🎨 自定义

### 修改辅食数据

编辑 `data/foods.js`：
- `stages` - 各月龄阶段的目标、奶量、餐次、时间表
- `foods` - 食材库（按 `firstMonth` 标记首次引入月龄）
- `weeklyMenus` - 一周食谱模板
- `quantityRef` - 食物量参考表
- `tips` - 总体提醒（do / dont）

### 修改样式

`assets/styles.css` 顶部 `:root` 定义了所有颜色变量，调一下就能整体换肤。

## 🔐 隐私

- 所有宝宝数据**只存在你自己的浏览器里**（localStorage）
- 分享链接的数据用 base64 编码在 URL 的 `#` 之后，**不会发送到服务器**
- GitHub Pages 没有任何后端、没有任何分析脚本
- 无 cookie、无追踪

## 📱 微信打开兼容性

- ✅ iOS 微信内置浏览器
- ✅ 安卓微信内置浏览器（基于 Chrome 内核）
- ✅ Safari / Chrome / Edge / Firefox
- ⚠️ 微信里点"复制链接"可能弹出"复制到剪贴板"的系统提示，这是正常的

## 📚 数据来源

- 《中国居民膳食指南（2022）》中国营养学会
- 世界卫生组织（WHO）婴幼儿喂养建议
- 国家卫健委《婴幼儿营养喂养评估服务指南》

## ⚠️ 免责声明

本工具仅供参考。每个宝宝的发育情况不同，实际辅食添加请咨询儿科医生或儿保医生，特别是在以下情况：
- 有过敏家族史
- 早产、低出生体重
- 消化系统疾病
- 添加新食材后出现任何异常反应

## 📄 License

MIT
