# 部署指南

> 记录项目部署流程与踩坑经验，供后续 session 参考。
> 当前阶段：Vercel 静态托管 + 微信公众号 H5

---

## 一、技术栈说明

| 层级 | 方案 |
|------|------|
| 游戏引擎 | `packages/core`（纯 TypeScript，无 DOM 依赖）|
| 调试 UI | `packages/debug-ui`（Vite + 原生 HTML/CSS）|
| 托管平台 | Vercel（静态托管，免费，自动 HTTPS）|
| 访问入口 | 微信公众号菜单 → 跳转网页 |

---

## 二、Vercel 部署配置

### 正确配置（已验证）

| 字段 | 值 |
|------|-----|
| Root Directory | **空**（不填，从仓库根目录运行）|
| Build Command | `pnpm --filter @haunted/core build && pnpm --filter @haunted/debug-ui build` |
| Output Directory | `packages/debug-ui/dist` |
| Install Command | `pnpm install` |
| Framework | 无（设为 None / Other）|

以上配置也写在仓库根目录的 `vercel.json` 中：

```json
{
  "buildCommand": "pnpm --filter @haunted/core build && pnpm --filter @haunted/debug-ui build",
  "outputDirectory": "packages/debug-ui/dist",
  "installCommand": "pnpm install",
  "framework": null
}
```

### 构建顺序说明

`debug-ui` 依赖 `core` 的编译产物（`packages/core/dist/`），因此必须先 build core 再 build debug-ui，不能用 `pnpm --filter './packages/*' build`（无法保证顺序）。

---

## 三、踩坑记录

### 坑1：esbuild 安装脚本被 pnpm v10 屏蔽

**现象**：Vercel 使用 pnpm v10，构建时出现 `Ignored build scripts: esbuild` 警告，vite build 无声失败。

**原因**：pnpm v10 收紧了 lifecycle scripts 权限，`.npmrc` 的 `onlyBuiltDependencies[]` 格式不被识别。

**解决**：在根 `package.json` 加：
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

---

### 坑2：Output Directory 路径冲突

**现象**：反复出现 `No Output Directory named "dist" found`，即使 `vercel.json` 配置正确。

**原因**：Vercel UI 的 Override 开关优先级高于 `vercel.json`，UI 里的旧值会覆盖配置文件。

**解决原则**：
- **不要在 Vercel UI 里设置 Root Directory**（保持空白）
- Output Directory 填 `packages/debug-ui/dist`（从仓库根目录出发的相对路径）
- 如果 Root Directory 设成了 `packages/debug-ui`，则 Output Directory 要改成 `dist`（但此时 Build Command 需要 `cd ../..` 回到根目录，容易出错，不推荐）

**结论**：Root Directory 留空是最干净的配置，所有路径统一从仓库根目录出发。

---

### 坑3：vite.config.ts 用了 `__dirname`

**现象**：vite build 无声失败，`dist/` 目录没有生成。

**原因**：项目是 `"type": "module"` 的 ESM 包，`__dirname` 在 ESM 中不存在，导致 vite 配置加载崩溃。

**解决**：删除 `vite.config.ts`。pnpm workspace 已能正确解析 `@haunted/core`，不需要手动配 alias。

---

## 四、本地开发

```bash
# 启动开发服务器（热更新）
pnpm dev

# 完整构建（验证 Vercel 构建是否能过）
pnpm build:deploy

# 测试模式（费用全1，手牌5张）
# 浏览器访问 http://localhost:5173/?test=1
```

---

## 五、微信公众号接入（待完成）

1. 在 Vercel 获取部署 URL（如 `xxx.vercel.app`）
2. 微信公众号后台 → 设置与开发 → 公众号设置 → 功能设置 → **业务域名**，填入该 URL
3. 下载验证文件，放到 `packages/debug-ui/public/` 目录，push 触发重新部署
4. 公众号后台 → 自定义菜单 → 添加菜单项，类型选「跳转网页」，填入 URL

---

## 六、后续部署演进计划

| 阶段 | 方案 |
|------|------|
| 当前（单机 PvE）| Vercel 静态托管，零后端 |
| PvP 联机 | 腾讯云轻量服务器 + Node.js + Socket.io，需要域名和 ICP 备案 |
