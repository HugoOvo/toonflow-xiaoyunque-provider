const rules = [
  {
    type: "input",
    field: "apiKey" as const,
    title: "API Key",
    value: "",
    props: { type: "password", showPassword: true, autocomplete: "off" },
  },
  {
    type: "input",
    field: "baseUrl" as const,
    title: "请求地址",
    value: "https://xyq.jianying.com",
    props: { placeholder: "https://xyq.jianying.com" },
  },
] as const;

const version = "2.5.0";

const DEFAULT_BASE_URL = "https://xyq.jianying.com";
const VIDEO_AGENT = "pippit_video_part_agent";
const IMAGE_AGENT = "pippit_nest_agent";
const WAIT_MS = 5000;

// 图片接口的比例是数字枚举，和视频的字符串比例不同。3:2 / 2:3 两套枚举对不上，先不开放。
// shortcut: 21:9 在 CLI 的枚举里是 13，网页版画布里是 8；这里按 CLI（同为 skill 接口）取 13，选它若报错就避开这个比例。
const IMAGE_RATIO: Record<string, number> = {
  adaptive: 0,
  auto: 0,
  "16:9": 2,
  "9:16": 3,
  "4:3": 4,
  "3:4": 5,
  "1:1": 6,
  "21:9": 13,
};

// 小云雀用 babi_param 标记调用来源，网页版和官方 CLI 都带。实测服务端不校验，缺了也能提交成功，这里照官方保持一致。
const BABI_PARAM = {
  scene_lv1: "ai_agent",
  scene_lv2: "front_tool",
  tool_id: "instant_video",
  tab_name: "other",
  edit_type: "instant_video",
  enter_from: "skill",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// 用户经常把「Bearer 」一起复制进 Key 输入框，先剥掉再拼，免得发出去变成 Bearer Bearer xxx。
function normalizeKey(value: string | undefined) {
  return typeof value === "string" ? value.trim().replace(/^Bearer\s+/i, "").trim() : "";
}

// 小云雀把产物元数据放在字符串里，需要再解析一层。
function contentData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function wait(signal: AbortSignal, ms: number) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// 小云雀对参考图没有公开的尺寸限制，这里只加一道保险：超大的图上传慢、后续生成也慢，
// 先在本地把长边压到 4096 以内再传；正常尺寸的图原样不动，不做任何放大。
const MAX_IMAGE_EDGE = 4096;

async function shrinkOversizedImage(context: ProviderContext, input: MediaInput): Promise<MediaInput> {
  try {
    const info = await context.tool.media.inspectImage(input);
    const edge = Math.max(info.width, info.height);
    if (!Number.isFinite(edge) || edge <= MAX_IMAGE_EDGE) return input;
    const scale = MAX_IMAGE_EDGE / edge;
    const format = info.format === "jpeg" ? "jpeg" : info.format === "webp" ? "webp" : "png";
    return await context.tool.media.resizeImage(input, {
      width: Math.max(1, Math.round(info.width * scale)),
      height: Math.max(1, Math.round(info.height * scale)),
      format,
      quality: 92,
    });
  } catch {
    // 本地解不开的格式（例如 svg、bmp）原样上传，交给小云雀自己判断，不能因为压缩失败就断掉整次生成。
    return input;
  }
}

/** 上传素材换 pippit_asset_id；小云雀只认自家素材 ID，所以所有输入都先变成字节。 */
async function uploadAsset(context: ProviderContext, baseUrl: string, apiKey: string, input: MediaInput, signal: AbortSignal): Promise<string> {
  let bytes: Uint8Array;
  let mimeType = text(input.mimeType);
  if (input.type === "binary") {
    bytes = input.data;
  } else if (input.type === "base64") {
    bytes = Buffer.from(input.data.replace(/^data:[^,]*,/, ""), "base64");
  } else {
    const download = await context.tool.fetch(input.url, { signal });
    if (!download.ok) throw new Error(`下载素材失败：HTTP ${download.status}`);
    bytes = new Uint8Array(await download.arrayBuffer());
    if (!mimeType) mimeType = text(download.headers.get("content-type")).split(";")[0];
  }
  if (!mimeType) mimeType = "application/octet-stream";
  const ext = EXT_BY_MIME[mimeType] || text(input.name).split(".").pop() || "png";
  const name = (text(input.name) || `upload.${ext}`).replace(/[^\w.-]/g, "_");
  const boundary = `----toonflow${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--\r\n`,
  ]);
  const response = await context.tool.fetch(`${baseUrl}/api/biz/v1/skill/upload_file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
    signal,
  });
  if (!response.ok) throw new Error(`素材上传失败：HTTP ${response.status}`);
  const result = record(await response.json());
  if (result.ret !== "0") throw new Error(`素材上传失败：${text(result.errmsg) || "未知错误"}`);
  const assetId = text(record(result.data).pippit_asset_id);
  if (!assetId) throw new Error("素材上传未返回 pippit_asset_id");
  return assetId;
}

// 只有视频命令带 babi_param，图片命令不带。
async function submitRun(context: ProviderContext, baseUrl: string, apiKey: string, body: unknown, withBabiParam: boolean, signal: AbortSignal): Promise<{ threadId: string; runId: string }> {
  const url = new URL(`${baseUrl}/api/biz/v1/skill/submit_run`);
  if (withBabiParam) url.searchParams.set("babi_param", JSON.stringify(BABI_PARAM));
  const response = await context.tool.fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`提交任务失败：HTTP ${response.status}`);
  const result = record(await response.json());
  if (result.ret !== "0") throw new Error(`提交任务失败：${text(result.errmsg) || "未知错误"}`);
  const run = record(record(result.data).run);
  const threadId = text(run.thread_id);
  const runId = text(run.run_id);
  if (!threadId || !runId) throw new Error("提交任务未返回 thread_id / run_id");
  return { threadId, runId };
}

function runContents(run: Record<string, unknown>): Record<string, unknown>[] {
  const entries = Array.isArray(run.entry_list) ? run.entry_list : [];
  const contents: Record<string, unknown>[] = [];
  for (const entry of entries) {
    const items = record(record(entry).artifact).content;
    if (Array.isArray(items)) for (const item of items) contents.push(record(item));
  }
  return contents;
}

// 视频用 video.download_url，图片用 image.url，字段不同。
// 图片一次可能出多张，全部收集，否则多扣的积分就白花了。
function runMediaUrls(run: Record<string, unknown>, mediaType: "video" | "image") {
  const subType = mediaType === "video" ? "biz/x_data_video" : "biz/x_data_image";
  const urls: string[] = [];
  for (const content of runContents(run)) {
    const current = text(content.sub_type);
    if (current && current !== subType) continue;
    const data = contentData(content.data);
    const url = mediaType === "video" ? text(record(data.video).download_url) : text(record(data.image).url);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function runError(run: Record<string, unknown>) {
  const direct = text(run.error_message) || text(run.error_msg) || text(run.errmsg);
  if (direct) return direct;
  for (const content of runContents(run)) {
    const data = contentData(content.data);
    const message = text(data.error_message);
    const code = data.error_code === undefined || data.error_code === null ? "" : String(data.error_code);
    if (message) return code ? `${message}（错误码 ${code}）` : message;
    if (code) return `错误码 ${code}`;
  }
  return "";
}

async function pollMedia(context: ProviderContext, baseUrl: string, apiKey: string, threadId: string, runId: string, mediaType: "video" | "image", signal: AbortSignal): Promise<string[]> {
  const label = mediaType === "video" ? "视频" : "图片";
  while (true) {
    const response = await context.tool.fetch(`${baseUrl}/api/biz/v1/skill/get_thread`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, run_id: runId }),
      signal,
    });
    if (!response.ok) throw new Error(`查询任务失败：HTTP ${response.status}`);
    const result = record(await response.json());
    if (result.ret !== "0") throw new Error(`查询任务失败：${text(result.errmsg) || "未知错误"}`);
    const runs = record(record(result.data).thread).run_list;
    const run = (Array.isArray(runs) ? runs : []).map(record).find((item) => text(item.run_id) === runId);
    if (run) {
      const state = Number(run.state);
      if (state === 3) {
        const urls = runMediaUrls(run, mediaType);
        if (!urls.length) throw new Error(`任务已完成，但没有返回${label}地址`);
        return urls;
      }
      if (state === 4) throw new Error(runError(run) || `${label}生成失败`);
      if (state === 5) throw new Error(runError(run) || "任务已取消");
      if (state === 6 || state === 9) throw new Error(runError(run) || "任务需要人工确认，请到小云雀网页版继续");
    }
    await wait(signal, WAIT_MS);
  }
}

function imageRatio(value: string, model: string) {
  const raw = text(value).toLowerCase();
  if (!raw) return undefined;
  const mapped = IMAGE_RATIO[raw];
  if (mapped === undefined) throw new Error(`模型 ${model} 不支持画面比例 ${value}`);
  return mapped;
}

export default {
  id: "xyq",
  label: "小云雀 Pippit",
  icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIxMCIgZmlsbD0iIzExMTgyNyIvPjxwYXRoIGQ9Ik0xMyAzMWMzLTExIDExLTE3IDIxLTE3LTIgMy0zIDUtMyA4IDMgMSA1IDMgNSA2IDAgNS01IDktMTEgOWgtOWMtMiAwLTMtMS0zLTN6IiBmaWxsPSIjZjhkMzRhIi8+PGNpcmNsZSBjeD0iMzEiIGN5PSIyMCIgcj0iMS42IiBmaWxsPSIjMTExODI3Ii8+PC9zdmc+",
  version,
  readme: `小云雀（剪映，xyq.jianying.com）官方接口，直接用你账号里的积分生成视频，不需要再单独充值别的平台。
 \n 用法：在小云雀网页版进入【CLI/API】→【API】，新建一个 Access Key，把它填到上面的 API Key 里即可，请求地址保持默认。
 \n 这里列出的模型，是当前这个账号实际开放的（按小云雀的模型接口查过）。视频模型：Seedance 2.5、Seedance 2.0 Vision / Fast Vision / Mini / Mini 体验版、Wan 3.0、HappyHorse 1.1。图片模型：Seedream 5.0 Pro / Flash、Midjourney 美学 8.2、智能图片 V2.5 Pro / Fast、智能图片 V2、旗舰生图 V2-Pro / V2-Flash、Anycook 影视版。
 \n 支持图片生成（文生图、参考图改图）和视频生成（文生视频、参考图/视频/音频、首尾帧），也支持查询剩余积分。素材会自动上传到小云雀，单个素材请小于 500MB。
 \n 小云雀没有单独的音频生成接口，音频只能作为视频的参考素材上传（mp3 / wav）。
 \n Seedance 2.5 Draft（先出480P样片再渲染成片）是两步流程，网页版画布走不通，请去小云雀网页版做。
 \n 计费按积分扣除，具体单价以你账号里小云雀页面的显示为准；节点上只显示「按积分计费」，不会编一个假单价。`,
  rules,
  models: [
    {
      id: "Seedance_2.5",
      label: "Seedance 2.5（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:30", "videoReference:10", "audioReference:10"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      id: "seedance2.0_vision",
      label: "Seedance 2.0 VIP（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p", "1080p", "4k"] }],
    },
    {
      id: "seedance2.0_fast_vision",
      label: "Seedance 2.0 Fast VIP（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      id: "Seedance_2.0_mini",
      label: "Seedance 2.0 Mini（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      id: "Seedance_2.0_mini_lite",
      label: "Seedance 2.0 Mini 体验版（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p"] }],
    },
    {
      id: "wan3.0",
      label: "Wan 3.0（小云雀积分）",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:10", "videoReference:5"]],
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      id: "happyhorse-1.1",
      label: "HappyHorse 1.1（小云雀积分）",
      type: "video",
      mode: ["text", ["imageReference:9"]],
      durationResolutionMap: [{ duration: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["720p", "1080p"] }],
    },
    {
      id: "seedream_5.0_pro",
      label: "Seedream 5.0 Pro（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "1.5K", "2K", "4K"],
      imageRatios: ["auto", "21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "seedream_5.0_flash",
      label: "Seedream 5.0 Flash（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1.5K", "2K"],
      imageRatios: ["auto", "21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "ali_midjourney_8_2",
      label: "美学模型 8.2（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K"],
      imageRatios: ["21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "gpt_image_2_5_sunburst",
      label: "智能图片 V2.5 Pro（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K", "4K"],
      imageRatios: ["21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "gpt_image_2_5_flare",
      label: "智能图片 V2.5 Fast（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K", "4K"],
      imageRatios: ["21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "gpt_image_2",
      label: "智能图片 V2（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K", "4K"],
      imageRatios: ["21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
    {
      id: "NanoPro",
      label: "旗舰生图 V2-Pro（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K", "4K"],
    },
    {
      id: "Nano2",
      label: "旗舰生图 V2-Flash（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["1K", "2K", "4K"],
    },
    {
      id: "anydream_2",
      label: "Anycook 影视版（小云雀积分）",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      imageSizes: ["3K", "4K"],
      imageRatios: ["21:9", "16:9", "9:16", "3:4", "4:3", "1:1"],
    },
  ] satisfies ProviderModel[],
  // 提交前统一处理参考图，避免超大图拖慢上传和生成；小云雀本身不校验尺寸，所以只是保险。
  async processMedia(request: ImageRequest | VideoRequest | AudioRequest) {
    const media = request as ImageRequest & VideoRequest & AudioRequest;
    const images = media.images ? await Promise.all(media.images.map((input) => shrinkOversizedImage(this, input))) : undefined;
    const firstFrame = media.firstFrame ? await shrinkOversizedImage(this, media.firstFrame) : undefined;
    const lastFrame = media.lastFrame ? await shrinkOversizedImage(this, media.lastFrame) : undefined;
    return {
      ...request,
      ...(images ? { images } : {}),
      ...(firstFrame ? { firstFrame } : {}),
      ...(lastFrame ? { lastFrame } : {}),
    };
  },
  // 小云雀没有公开的估价接口，节点上的价格只能如实说明按积分计费，不编具体单价。
  async getPrice(request: ProviderPriceRequest): Promise<ProviderPrice | null> {
    const model = request.model;
    const seconds = request.type === "video" ? request.duration : undefined;
    const unit = request.type === "video" ? "每秒" : "每张";
    const detail = request.type === "video" && seconds ? `${seconds} 秒` : "一次";
    return {
      price: `按积分计费（${unit}）`,
      tips: `模型：${model}\n本次约 ${detail}\n单价以你账号在小云雀页面显示的为准，生成后按实际消耗扣积分。`,
    };
  },
  async getBalance(): Promise<ProviderBalance> {
    const apiKey = normalizeKey(this.config.apiKey);
    if (!apiKey) throw new Error("请填写 API Key");
    const baseUrl = (this.config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
    const response = await this.tool.fetch(`${baseUrl}/api/biz/v1/skill/get_credit_balance`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`查询积分失败：HTTP ${response.status}`);
    const result = record(await response.json());
    if (result.ret !== "0") throw new Error(`查询积分失败：${text(result.errmsg) || "未知错误"}`);
    const balance = Number(record(result.data).total_remain_amount);
    if (!Number.isFinite(balance)) throw new Error("查询积分未返回余额");
    return { balance, unit: "积分" };
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    const apiKey = normalizeKey(this.config.apiKey);
    if (!apiKey) throw new Error("请填写 API Key");
    const baseUrl = (this.config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
    const prompt = request.prompt?.trim();
    if (!prompt) throw new Error("请填写提示词");

    // 小云雀的提交协议里没有音轨开关字段（只有 audios 参考素材），忽略宿主开关，音轨由服务端默认。

    // ACT: 单次生成最多等 30 分钟，和官方 CLI 默认超时一致。
    const signal = AbortSignal.any([AbortSignal.timeout(30 * 60_000), ...(this.signal ? [this.signal] : [])]);

    const isFrames = !!request.firstFrame || !!request.lastFrame || request.mode === "startEndRequired" || request.mode === "endFrameOptional" || request.mode === "startFrameOptional";
    const frames = [request.firstFrame, request.lastFrame].filter((input): input is MediaInput => !!input);
    const imageInputs = isFrames && frames.length ? frames : request.images ?? [];
    const videoInputs = isFrames ? [] : request.videos ?? [];
    const audioInputs = isFrames ? [] : request.audios ?? [];

    const [imageIds, videoIds, audioIds] = await Promise.all([
      Promise.all(imageInputs.map((input) => uploadAsset(this, baseUrl, apiKey, input, signal))),
      Promise.all(videoInputs.map((input) => uploadAsset(this, baseUrl, apiKey, input, signal))),
      Promise.all(audioInputs.map((input) => uploadAsset(this, baseUrl, apiKey, input, signal))),
    ]);
    const refs = (ids: string[]) => ids.map((id) => ({ pippit_asset_id: id }));

    const param: Record<string, unknown> = { prompt, model: request.model };
    if (imageIds.length) param.images = refs(imageIds);
    if (videoIds.length) param.videos = refs(videoIds);
    if (audioIds.length) param.audios = refs(audioIds);
    if (isFrames) param.generate_type = 1;
    if (request.duration) param.duration_sec = request.duration;
    if (request.ratio) param.ratio = request.ratio;
    if (request.resolution) param.resolution = request.resolution;

    const { threadId, runId } = await submitRun(this, baseUrl, apiKey, {
      agent_name: VIDEO_AGENT,
      call_source: "pippit_cli",
      message: prompt,
      video_part_tool_param: param,
    }, true, signal);
    // shortcut: 直接用小云雀返回的签名下载地址；若链接过期，改成先 this.tool.fetch 下载再返回 binary。
    const videoUrls = await pollMedia(this, baseUrl, apiKey, threadId, runId, "video", signal);
    return videoUrls.map((url): MediaAsset => ({ mediaType: "video", type: "url", url }));
  },
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    const apiKey = normalizeKey(this.config.apiKey);
    if (!apiKey) throw new Error("请填写 API Key");
    const baseUrl = (this.config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
    const prompt = request.prompt?.trim();
    if (!prompt) throw new Error("请填写提示词");
    if (request.mask) throw new Error("小云雀不支持局部重绘蒙版");
    if (request.outputFormat) throw new Error("小云雀不支持指定输出格式");

    const signal = AbortSignal.any([AbortSignal.timeout(15 * 60_000), ...(this.signal ? [this.signal] : [])]);
    const ratio = imageRatio(request.ratio ?? "", request.model);
    if (request.n !== undefined && (!Number.isInteger(request.n) || request.n < 1)) throw new Error("生成数量必须是正整数");

    const images = request.images ?? [];
    const assetIds = await Promise.all(images.map((input) => uploadAsset(this, baseUrl, apiKey, input, signal)));

    const settings: Record<string, unknown> = { image_model: request.model };
    if (ratio !== undefined) settings.ratio = ratio;
    if (request.size) settings.resolution = request.size.trim().toUpperCase();
    if (request.quality) settings.image_effort = request.quality.trim().toLowerCase();
    // 小云雀不传张数时默认出 4 张，但 Toonflow 的图片节点一次只要一张，
    // 所以没指定时按 1 张提交，避免多扣积分。
    settings.generate_image_count = request.n !== undefined ? request.n : 1;

    const body: Record<string, unknown> = { agent_name: IMAGE_AGENT, message: prompt, general_agent_settings: settings };
    if (assetIds.length) body.asset_ids = assetIds;

    const { threadId, runId } = await submitRun(this, baseUrl, apiKey, body, false, signal);
    // shortcut: 直接用小云雀返回的签名下载地址；若链接过期，改成先 this.tool.fetch 下载再返回 binary。
    // 一次请求出了几张就回传几张，避免多扣的积分拿不到图。
    const imageUrls = await pollMedia(this, baseUrl, apiKey, threadId, runId, "image", signal);
    return imageUrls.map((url): MediaAsset => ({ mediaType: "image", type: "url", url }));
  },
} satisfies ProviderDefinition<typeof rules>;
