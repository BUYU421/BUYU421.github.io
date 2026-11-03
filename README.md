# 资源站

个人资源站，静态托管于 GitHub Pages。首页是加密的：只有输入正确的账号与密码，页面内容才会在浏览器里解密显示。

**在线地址：** https://buyu421.github.io/

## 目录结构

### 仓库（会被发布，只放密文）

```
BUYU421.github.io/
├── index.html            门页：登录表单 + 加密后的首页内容
├── assets/
│   ├── site.css          全站样式（浅色极简）
│   └── gate.js           解密逻辑（PBKDF2 + AES-GCM）
├── simulator/            折纸模拟器（公开）
│   ├── index.html        单文件应用
│   └── about.html        功能与操作说明
├── 404.html
├── .nojekyll
└── README.md
```

### 源目录（不进仓库，只在本机）

```
_src/
├── build.js              加密构建脚本（Node，零依赖）
├── config.json           站点名、迭代次数、门页文案
├── .salt                 站点级 salt（首次构建自动生成，勿删）
└── pages/                明文页面
    └── index.html        资源站首页明文
```

**明文绝不能放进 `BUYU421.github.io/` 目录**，否则等于没加密。仓库里只有 `index.html` 这种密文页。

## 工作原理

1. 构建时，`_src/pages/*.html` 的整份明文用 AES-256-GCM 加密；
2. 密钥 = `PBKDF2-SHA256(账号 + \u001f + 密码, salt, 600000 次, 32 字节)`；
   账号参与派生，所以**账号和密码都必须正确**才能解开；
3. 仓库里的 `index.html` 只有表单、`window.__ENC`（salt / iv / 密文）和 `gate.js`；
4. 访客输入凭据 → 浏览器用 Web Crypto 派生密钥并解密 → `document.write` 出真正的页面；
5. 解密失败时 WebCrypto 抛 `OperationError`，页面只显示「账号或密码不正确」。

同一标签页内登录一次后，**派生密钥**（不是密码）会存进 `sessionStorage`，翻其他加密页免重复输入；关闭标签页即失效。页脚的「锁定并退出」会立即清除。

所有页面共用一个站点级 salt（`_src/.salt`），这样同一凭据在每一页派生出的密钥才一致，会话才能复用。删掉 `.salt` 会让所有已登录会话失效，重新登录即可。

## 安全边界（重要）

- **密文是公开的**：谁都能下载 `index.html`，看到那串 base64。安全性完全来自密码强度，请用长密码（12 位以上、非字典词）。密码弱，离线爆破就能解开。
- **不是服务端鉴权**：没有后端，无法挡住暴力尝试（每次尝试都在访客自己的机器上做）。因此迭代次数设得较高（60 万次），让每次猜测都变慢。
- **文件下载需要单独加密**：仓库里的 PDF、表格等文件是**公开可下载**的，加密 HTML 保护不了它们。要放私密文件，必须把文件本身加密后再放（目前站点还没有这个流程，需要时再加）。
- **模拟器是公开的**：`/simulator/` 不加密，任何知道地址的人都能用。
- **git 历史**：只要不把明文提交进仓库，历史里就没有明文。历史上曾有的旧版公开首页不含敏感内容。

## 首次设置 / 修改账号密码

在本机执行（`node` 需在 PATH 里；本项目使用 `C:\Users\BUYU\AppData\Local\Programs\node\node-v22.9.0-win-x64\node.exe`）：

```powershell
node _src\build.js --user 你的账号
```

按提示输入两次密码（不回显）。脚本会重新加密所有明文页面并写进仓库。

- 改密码：直接再跑一次，用新密码。
- 换账号：同上，账号参数改动即可。
- 想用命令行传密码：`--pass`（密码会留在命令历史里，不推荐）。

## 新增一个加密页面

1. 在 `_src/pages/` 下新建 `.html`（完整文档，`<head>` 里引 `/assets/site.css`）；
2. 跑一次 `node _src\build.js --user 你的账号`；
3. 提交仓库里的密文页并推送。

`_src/pages/` 里支持子目录，会按相对路径生成（例如 `pages/docs/a.html` → `docs/a.html`），路径下的门页同样可直接访问。

## 本地预览

```powershell
cd BUYU421.github.io
python -m http.server 8123
```

打开 <http://localhost:8123/>。注意：门页依赖 Web Crypto，`file://` 直接双击可能不可用，务必用 http/https 访问。

## 部署

GitHub Pages 从 `main` 分支根目录发布，无需 Actions：

```powershell
git add -A
git commit -m "更新站点"
git push
```

推送后一两分钟自动生效。

## 折纸模拟器

公开的单文件应用：6 种内置展开图 + 6×6 自定义网格、0°–90° 连续折叠、逐条折痕单折、相对面高亮与骰子标注、基准面固定、画笔/橡皮/印章、视角与自动旋转。零第三方依赖，Canvas 手写投影。
