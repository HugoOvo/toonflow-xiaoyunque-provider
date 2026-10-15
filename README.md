<div align="center">

# 小云雀 Pippit × Toonflow

**把「小云雀」（剪映 / Pippit）的 AI 视频与图片生成能力，直接接进 Toonflow 无限画布。**

用你自己小云雀账号里的积分就能出片，不需要再充值别的平台。

[![License](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.5.0-1f6feb.svg)](#)
[![Platform](https://img.shields.io/badge/platform-Toonflow-8957e5.svg)](#)
[![Models](https://img.shields.io/badge/models-16-f8d34a.svg)](#-支持的模型)
[![Official](https://img.shields.io/badge/%E9%9D%9E%E5%AE%98%E6%96%B9-unofficial-d1242f.svg)](#免责声明请先读)

[功能](#-能做什么) · [安装](#-安装) · [操作](#-怎么用) · [模型](#-支持的模型) · [注意](#-注意事项) · [FAQ](#-常见问题) · [English](#english)

</div>

---

> [!WARNING]
> ## 免责声明（请先读）
>
> **本项目是「小云雀」（字节跳动 / 剪映 / Pippit）的第三方非官方适配器，与字节跳动、剪映、小云雀官方没有任何关系，也不是官方发布的。**
>
> - 这是个**个人写的开源小工具**，只是把 Toonflow 的请求转发到你自己账号的小云雀官方接口。代码会直接调用小云雀的公开 API，并消耗**你自己账号里的积分**。
> - **不是官方产品，不提供任何担保。** 接口随时可能被官方调整而失效，这也是这类第三方适配器的常态。
> - 使用者需自行遵守小云雀官方的用户协议与服务条款。因使用本插件产生的积分消耗、账号风险或任何损失，**由使用者自行承担**。
> - 本项目**不收集、不上传、不转发**你的任何数据。你的 Access Key 只存在于你自己电脑上的 Toonflow 配置里，整套流程不经过任何第三方服务器。
> - 作者与 Toonflow 官方无隶属关系。

---

## 🎬 能做什么

| 能力 | 说明 |
| :--- | :--- |
| 🖼️ **AI 生成图片** | 文生图、参考图改图、多图参考。9 个图片模型可选 |
| 🎞️ **AI 生成视频** | 文生视频、参考图 / 参考视频 / 参考音频、首尾帧。7 个视频模型可选 |
| 📎 **素材自动上传** | 你从画布丢进去的图片、视频、音频会自动上传到小云雀，自己处理 ID |
| ⏳ **异步任务轮询** | 提交后自动查进度，视频最长等 30 分钟、图片最长等 15 分钟 |
| 💰 **积分余额查询** | 直接在 Toonflow 里查你还剩多少积分 |
| 🔍 **价格显示** | 节点上显示「按积分计费」的说明，不编造单价 |
| 🧩 **超大图自动压缩** | 参考图长边超过 4096 像素会先在本地等比压小再上传，提速用 |
| 🔑 **Key 容错** | 粘贴 Key 时多带了 `Bearer ` 前缀会自动去掉 |

### 实测效果

用真实账号跑通过，不是纸上谈兵：

- 🐱 **橘猫视频** — Seedance 2.0 Mini 体验版，4 秒 720P → 约 165 秒出片，扣 16 积分
- 🎩 **草帽猫图片** — Seedream 5.0 Flash，16:9 1.5K → 约 60 秒出图，扣 3 积分

---

## 📦 安装

### 方法一：一键脚本（推荐）

```powershell
# 在本仓库目录下执行
.\install.ps1
```

脚本会自动把 `xyq.ts` 复制到 Toonflow 的 `providers` 目录，并且在覆盖前自动备份旧文件。

### 方法二：手动安装

1. 下载本仓库的 `xyq.ts`
2. 复制到下面这个目录：

   ```
   %LOCALAPPDATA%\local.toonflow.desktop\stable\data\providers\
   ```

   完整路径一般是：
   `C:\Users\<你的用户名>\AppData\Local\local.toonflow.desktop\stable\data\providers\`

3. 重启 Toonflow

### 拿到 Access Key

1. 浏览器登录 <https://xyq.jianying.com>
2. 找到顶部【CLI/API】入口，切到【API】标签
3. 新建一个 Access Key，复制下来（**只显示一次**，丢了就重建）

---

## 🕹️ 怎么用

### 配置

1. Toonflow → **设置** → **媒体模型**
2. 找到供应商 **小云雀 Pippit**
3. 填入：

   | 字段 | 填什么 |
   | :--- | :--- |
   | `API Key` | 你的 Access Key（唯一必填项） |
   | `请求地址` | 保持默认 `https://xyq.jianying.com` |

### 生成视频

1. 画布上新建**视频节点**
2. 模型下拉里选「**小云雀 Pippit**」下面的模型
3. 写提示词，按需连接参考图 / 参考视频 / 音频 / 首尾帧
4. 选好时长、分辨率、画幅比例 → 生成

### 生成图片

1. 画布上新建**图片节点**
2. 模型下拉里选同一家的图片模型
3. 写提示词，可以纯文生图，也可以连参考图改图

### 查余额

在供应商配置那一栏点**余额查询**，会显示你账号当前剩余积分。

---

## 🤖 支持的模型

> 下面这些模型是按**真实账号的模型接口实测**查出来的，不是猜的。
> 小云雀会按账号权限开放模型，权限变化时请以你账号实际可用的为准。

### 视频模型（7 个）

| 模型 | 时长 | 分辨率 | 参考素材 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **Seedance 2.5** | 4–30 秒 | 480P / 720P / 1080P | 图 30 / 视频 10 / 音频 10 | 最强，支持首尾帧 |
| **Seedance 2.0 VIP** | 4–15 秒 | 480P / 720P / 1080P / 4K | 图 9 / 视频 3 / 音频 3 | 唯一支持 4K |
| **Seedance 2.0 Fast VIP** | 4–15 秒 | 480P / 720P | 图 9 / 视频 3 / 音频 3 | 出片快 |
| **Seedance 2.0 Mini** | 4–15 秒 | 720P | 图 9 / 视频 3 / 音频 3 | 性价比 |
| **Seedance 2.0 Mini 体验版** | 4–15 秒 | 720P | 图 9 / 视频 3 / 音频 3 | **最便宜，建议先拿它试** |
| **Wan 3.0** | 4–30 秒 | 480P / 720P / 1080P | 图 10 / 视频 5 | 不支持音频参考 |
| **HappyHorse 1.1** | 3–15 秒 | 720P / 1080P | 仅图 9 | **不支持首尾帧** |

### 图片模型（9 个）

| 模型 | 分辨率 | 说明 |
| :--- | :--- | :--- |
| **Seedream 5.0 Pro** | 1K / 1.5K / 2K / 4K | 豆包 Seedream 5.0 Pro |
| **Seedream 5.0 Flash** | 1.5K / 2K | 更快更省 |
| **Midjourney 美学 8.2** | 1K / 2K | 美学向 |
| **智能图片 V2.5 Pro** | 1K / 2K / 4K | 支持推理强度档位 |
| **智能图片 V2.5 Fast** | 1K / 2K / 4K | 同上，更快 |
| **智能图片 V2** | 1K / 2K / 4K | 上一代 |
| **旗舰生图 V2-Pro** | 1K / 2K / 4K | 旗舰画质 |
| **旗舰生图 V2-Flash** | 1K / 2K / 4K | 旗舰速度 |
| **Anycook 影视版** | 3K / 4K | 影视风格 |

---

## ⚠️ 注意事项

### 用量与花费

- **所有消耗都来自你自己小云雀账号里的积分**，用多少扣多少。
- 插件**不显示具体单价**。原因：小云雀没有公开的估价接口，查不到官方单价，这里宁可不显示也不编一个假数字。
  真实扣费请看你小云雀账号里的积分流水，或者**生成前后各查一次余额自己相减**。
- 小云雀出图**不指定张数时默认出 4 张**。Toonflow 的图片节点一次只要一张，所以本插件默认只提交 1 张，避免白扣积分；如果一次出了多张，也会全部回传给你，不浪费。

### 素材限制

- 单个素材请 **小于 500MB**
- 图片支持：`jpg` `jpeg` `png` `gif` `bmp` `webp` `svg`
- 视频支持：`mp4` `avi` `mov` `wmv` `flv` `webm` `mkv` `m4v`
- 音频支持：`mp3` `wav`
- 参考图长边超过 4096 像素会被自动压小后上传（小云雀本身不限制图片尺寸，这一步只是为了上传和生成更快；小图原样不动，不放大）

### 关于音频（重点）

小云雀**没有「文字转语音」这种独立的音频生成接口**，所以：

- ❌ 不能用它做纯配音
- ✅ 但音频可以当作**视频的参考素材**传进去（比如让视频带上配乐、或按参考音频的节奏生成）

需要纯 TTS 配音的话，得用别的工具。

### 不支持的功能

- **Seedance 2.5 Draft**（先出 480P 样片再渲染成片）是**两步流程**，插件里一次提交做不了，请直接去小云雀网页版。
- **局部重绘 / 蒙版**：小云雀接口不支持
- **指定输出格式**（png / jpeg 等）：小云雀接口不支持

### 运行期间

- 生成中途**别关软件**：视频最长等 30 分钟，图片最长等 15 分钟
- 不要重复点生成，可能会重复扣积分

---

## ❓ 常见问题

<details>
<summary><b>报「不支持的视频模型」怎么办？</b></summary>

说明你选的模型这个账号没有被开放。请到小云雀网页版的模型列表里核对当前账号实际开放的模型，选列表里有的那个。
</details>

<details>
<summary><b>视频在小云雀官网能看到，但 Toonflow 里一直转圈？</b></summary>

这个 bug 在 **2.4.0** 已修复。原因是插件查任务进度时多带了一个参数，小云雀只回纯文字、不回结构化结果。升级到最新版即可。
</details>

<details>
<summary><b>报认证失败 / 401？</b></summary>

先检查 Access Key 是否正确、是否过期。本插件已支持自动去掉多余的 `Bearer ` 前缀，如果你粘贴时带了前缀也不会有问题。
</details>

<details>
<summary><b>任务失败怎么办？</b></summary>

- 检查积分余额是否充足
- 检查 Key 是否有效
- 检查参数组合是否合法（比如 4K 只有 Seedance 2.0 VIP 支持）
- 把 Toonflow 弹出来的**报错文字整段**发 Issue，更容易定位
</details>

<details>
<summary><b>余额显示 0 或查询失败？</b></summary>

余额接口返回的是「总剩余积分」。若查询失败，多半是 Key 失效或网络不通。
</details>

<details>
<summary><b>为什么模型列表是写死的，不能自动获取？</b></summary>

小云雀的模型列表接口必须先 POST 带参数才返回，而 Toonflow 的在线拉取方式写不出来。官方 CLI 同样是本地缓存，所以这里采用写死的方式（已按实测结果写准）。
</details>

---

## 🧪 测试

本仓库带了一套模拟测试，用假的服务器完整跑一遍「上传素材 → 提交任务 → 轮询 → 取回结果」，不需要真实 Key、也不消耗积分：

```bash
cd tests
node --experimental-strip-types test.mjs
# 预期输出：ALL OK
```

---

## 📁 文件说明

| 文件 | 作用 |
| :--- | :--- |
| `xyq.ts` | **核心适配器**，装进 Toonflow 的就是它 |
| `install.ps1` | Windows 一键安装脚本 |
| `config.example.json` | 配置参考示例（`apiKey` 是占位符 `这里填写你自己的 API Key`，不是你的真实 Key） |
| `LICENSE` | MIT 开源协议 |
| `tests/test.mjs` | 模拟测试 |
| `docs/使用说明.txt` | 中文详细使用说明 |

---

## 📄 License

[MIT](LICENSE) © 2026 HugoOvo

---

<div align="center">

## English

**An unofficial third-party provider adapter that brings [Xiaoyunque / Pippit](https://xyq.jianying.com) (ByteDance CapCut's AI generation service) into [Toonflow](https://github.com/HBAI-Ltd/Toonflow-app).**

Generate videos and images with the credits already in your own Xiaoyunque account - no extra platform needed.

> **Disclaimer:** This is an **unofficial, community-made** adapter. It is **not affiliated with, endorsed by, or related to ByteDance, CapCut, or Xiaoyunque** in any way. It simply forwards your Toonflow requests to Xiaoyunque's public API using **your own account and credits**. No warranty of any kind. The API may change at any time and break this adapter. You are responsible for complying with Xiaoyunque's terms of service.

### Quick start

1. Get an Access Key at <https://xyq.jianying.com> → `CLI/API` → `API`
2. Run `.\install.ps1`, or copy `xyq.ts` into `%LOCALAPPDATA%\local.toonflow.desktop\stable\data\providers\`
3. Restart Toonflow
4. Settings → Media Models → **小云雀 Pippit** → paste your Access Key

### Features

- 7 video models (Seedance 2.5 / 2.0 series, Wan 3.0, HappyHorse 1.1)
- 9 image models (Seedream 5.0, Midjourney Aesthetic 8.2, GPT-Image series, Anycook)
- Text-to-video, image-to-video, reference images/videos/audio, first & last frame
- Text-to-image and image editing with references
- Automatic asset upload, async polling, credit balance query
- Configurable durations (3-30s), resolutions (480P-4K) and aspect ratios

### Notes

- **Billing is per-credit** from your own Xiaoyunque account. Exact unit prices are not exposed by the API, so this adapter does not display invented numbers.
- No TTS / audio generation endpoint exists; audio is reference-only.
- Single asset < 500MB.

[⬆ 回到顶部 / Back to top](#小云雀-pippit--toonflow)

</div>