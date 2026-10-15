import assert from "node:assert/strict";
import provider from "../xyq.ts";

const seen = [];
let polls = 0;
let uploads = 0;

const server = (path) => {
  if (path === "/api/biz/v1/skill/upload_file") return { ret: "0", data: { pippit_asset_id: `asset_${uploads++}` } };
  if (path === "/api/biz/v1/skill/submit_run") return { ret: "0", data: { run: { thread_id: "t1", run_id: "r1" } } };
  if (path === "/api/biz/v1/skill/get_credit_balance") return { ret: "0", data: { total_remain_amount: "12345" } };
  if (path === "/api/biz/v1/skill/get_thread") {
    polls++;
    if (polls < 2) return { ret: "0", data: { thread: { run_list: [{ run_id: "r1", state: 2 }] } } };
    return {
      ret: "0",
      data: {
        thread: {
          run_list: [
            {
              run_id: "r1",
              state: 3,
              entry_list: [
                { artifact: { content: [{ sub_type: "biz/x_data_prompt_text", data: "hi" }] } },
                { artifact: { content: [{ sub_type: "biz/x_data_video", data: JSON.stringify({ video: { download_url: "https://cdn/v.mp4" } }) }] } },
                { artifact: { content: [{ sub_type: "biz/x_data_image", data: JSON.stringify({ image: { url: "https://cdn/i.png" } }) }] } },
              ],
            },
          ],
        },
      },
    };
  }
  throw new Error(`unexpected path ${path}`);
};

const tool = {
  async fetch(url, init = {}) {
    const path = new URL(url).pathname;
    seen.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    return new Response(JSON.stringify(server(path)), { status: 200, headers: { "content-type": "application/json" } });
  },
  errorMessage: (v) => JSON.stringify(v),
};

const ctx = { config: { apiKey: "ak_test", baseUrl: "https://xyq.jianying.com/" }, tool, signal: undefined };

const out = await provider.generateVideo.call(ctx, {
  model: "Seedance_2.5",
  prompt: "一只猫钓鱼",
  firstFrame: { type: "binary", data: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
  duration: 5,
  ratio: "16:9",
});
assert.deepEqual(out, [{ mediaType: "video", type: "url", url: "https://cdn/v.mp4" }]);

const submit = seen.find((c) => c.url.includes("submit_run"));
const q = new URL(submit.url);
assert.deepEqual(JSON.parse(q.searchParams.get("babi_param")), {
  scene_lv1: "ai_agent", scene_lv2: "front_tool", tool_id: "instant_video",
  tab_name: "other", edit_type: "instant_video", enter_from: "skill",
});
assert.equal(submit.headers.Authorization, "Bearer ak_test");
const payload = JSON.parse(submit.body);
assert.equal(payload.agent_name, "pippit_video_part_agent");
assert.equal(payload.message, "一只猫钓鱼");
assert.deepEqual(payload.video_part_tool_param, {
  prompt: "一只猫钓鱼", model: "Seedance_2.5", images: [{ pippit_asset_id: "asset_0" }],
  generate_type: 1, duration_sec: 5, ratio: "16:9",
});

// 回归守卫：get_thread 一旦带上 version:"v2"，服务端就只回 readable_text，轮询永远看不到 state 3。
const threadCall = seen.find((c) => c.url.includes("get_thread"));
assert.deepEqual(JSON.parse(threadCall.body), { thread_id: "t1", run_id: "r1" });
assert.equal("version" in JSON.parse(threadCall.body), false);
assert.ok(seen.filter((c) => c.url.includes("get_thread")).length >= 2);

const upload = seen.find((c) => c.url.includes("upload_file"));
assert.ok(upload.headers["Content-Type"].startsWith("multipart/form-data; boundary="));
assert.ok(upload.headers["Content-Type"] !== "multipart/form-data");

const bal = await provider.getBalance.call(ctx);
assert.deepEqual(bal, { balance: 12345, unit: "积分" });

polls = 0;
const failTool = {
  ...tool,
  async fetch(url, init = {}) {
    const path = new URL(url).pathname;
    if (path === "/api/biz/v1/skill/get_thread") return new Response(JSON.stringify({ ret: "0", data: { thread: { run_list: [{ run_id: "r1", state: 4, error_message: "余额不足" }] } } }));
    return tool.fetch(url, init);
  },
};
await assert.rejects(
  () => provider.generateVideo.call({ ...ctx, tool: failTool }, { model: "Seedance_2.5", prompt: "x" }),
  /余额不足/,
);

await assert.rejects(() => provider.getBalance.call({ ...ctx, config: {} }), /请填写 API Key/);

seen.length = 0;
polls = 0;
uploads = 0;
const img = await provider.generateImage.call(ctx, {
  model: "seedream_5.0_pro",
  prompt: "一只戴帽子的猫",
  images: [{ type: "binary", data: new Uint8Array([9]), mimeType: "image/png" }],
  ratio: "9:16",
  size: "2k",
  quality: "HIGH",
  n: 2,
});
assert.deepEqual(img, [{ mediaType: "image", type: "url", url: "https://cdn/i.png" }]);
const imgSubmit = seen.find((c) => c.url.includes("submit_run"));
assert.equal(new URL(imgSubmit.url).searchParams.get("babi_param"), null);
const imgBody = JSON.parse(imgSubmit.body);
assert.equal(imgBody.agent_name, "pippit_nest_agent");
assert.equal(imgBody.message, "一只戴帽子的猫");
assert.deepEqual(imgBody.asset_ids, ["asset_0"]);
assert.deepEqual(imgBody.general_agent_settings, {
  image_model: "seedream_5.0_pro", ratio: 3, resolution: "2K", image_effort: "high", generate_image_count: 2,
});

seen.length = 0;
polls = 0;
await provider.generateImage.call(ctx, { model: "Nano2", prompt: "x", ratio: "adaptive" });
const minBody = JSON.parse(seen.find((c) => c.url.includes("submit_run")).body);
// 没指定张数时按 1 张提交：小云雀不传时默认出 4 张，会白扣 3 倍积分
assert.deepEqual(minBody.general_agent_settings, { image_model: "Nano2", ratio: 0, generate_image_count: 1 });
assert.equal("asset_ids" in minBody, false);

// 一次出多张图时必须全部回传，否则多扣的积分拿不到图
seen.length = 0;
polls = 0;
uploads = 0;
const multiTool = {
  ...tool,
  async fetch(url, init = {}) {
    const path = new URL(url).pathname;
    if (path === "/api/biz/v1/skill/get_thread") {
      polls++;
      if (polls < 2) return new Response(JSON.stringify({ ret: "0", data: { thread: { run_list: [{ run_id: "r1", state: 2 }] } } }));
      const mk = (n) => ({ artifact: { content: [{ sub_type: "biz/x_data_image", data: JSON.stringify({ image: { url: `https://cdn/i${n}.png` } }) }] } });
      return new Response(JSON.stringify({ ret: "0", data: { thread: { run_list: [{ run_id: "r1", state: 3, entry_list: [mk(1), mk(2), mk(3), mk(4)] }] } } }));
    }
    return tool.fetch(url, init);
  },
};
const multi = await provider.generateImage.call({ ...ctx, tool: multiTool }, { model: "seedream_5.0_pro", prompt: "x", n: 4 });
assert.deepEqual(multi.map((a) => a.url), ["https://cdn/i1.png", "https://cdn/i2.png", "https://cdn/i3.png", "https://cdn/i4.png"]);

await assert.rejects(
  () => provider.generateImage.call(ctx, { model: "Nano2", prompt: "x", ratio: "7:5" }),
  /不支持画面比例/,
);

polls = 0;
assert.deepEqual(
  await provider.generateVideo.call(ctx, { model: "Seedance_2.5", prompt: "x", generateAudio: true }),
  [{ mediaType: "video", type: "url", url: "https://cdn/v.mp4" }],
);

assert.equal(provider.version, "2.5.0");
assert.equal(provider.id, "xyq");
assert.equal(new Set(provider.models.map((m) => m.id)).size, provider.models.length);
assert.ok(provider.models.some((m) => m.type === "image"));
assert.equal(provider.generateAudio, undefined);

// 模型表必须正好等于这个账号被开放的模型，多一个都会在提交时被服务端拒。
const VIDEO_IDS = ["Seedance_2.5", "seedance2.0_vision", "seedance2.0_fast_vision", "Seedance_2.0_mini", "Seedance_2.0_mini_lite", "wan3.0", "happyhorse-1.1"];
const IMAGE_IDS = ["seedream_5.0_pro", "seedream_5.0_flash", "ali_midjourney_8_2", "gpt_image_2_5_sunburst", "gpt_image_2_5_flare", "gpt_image_2", "NanoPro", "Nano2", "anydream_2"];
assert.deepEqual(provider.models.filter((m) => m.type === "video").map((m) => m.id), VIDEO_IDS);
assert.deepEqual(provider.models.filter((m) => m.type === "image").map((m) => m.id), IMAGE_IDS);
// Seedance 2.5 Draft 是两步流程，不能出现在单次提交的模型表里
assert.ok(!provider.models.some((m) => m.id === "Seedance_2.5_draft"));
// 老版本里被服务端拒绝的模型不能再出现
for (const gone of ["seedance_1.0", "Seedance_1.0_Fast", "MiniMax-H3", "MiniMax-H3-Max", "Seedance_2.0_lite", "anycook_1_standard"]) {
  assert.ok(!provider.models.some((m) => m.id === gone), `${gone} 不该还在`);
}

const limits = (id) => {
  const m = provider.models.find((x) => x.id === id);
  const t = m.durationResolutionMap[0];
  return [t.duration[0], t.duration[t.duration.length - 1], t.resolution.join("/")];
};
assert.deepEqual(limits("Seedance_2.5"), [4, 30, "480p/720p/1080p"]);
assert.deepEqual(limits("seedance2.0_vision"), [4, 15, "480p/720p/1080p/4k"]);
assert.deepEqual(limits("seedance2.0_fast_vision"), [4, 15, "480p/720p"]);
assert.deepEqual(limits("Seedance_2.0_mini"), [4, 15, "720p"]);
assert.deepEqual(limits("Seedance_2.0_mini_lite"), [4, 15, "720p"]);
assert.deepEqual(limits("wan3.0"), [4, 30, "480p/720p/1080p"]);
assert.deepEqual(limits("happyhorse-1.1"), [3, 15, "720p/1080p"]);
// happyhorse 不支持首尾帧，只有参考模式
assert.deepEqual(provider.models.find((m) => m.id === "happyhorse-1.1").mode, ["text", ["imageReference:9"]]);
// wan3.0 没有音频参考
assert.ok(!provider.models.find((m) => m.id === "wan3.0").mode.flat().some((x) => String(x).startsWith("audioReference")));

await assert.rejects(
  () => provider.generateImage.call(ctx, { model: "Nano2", prompt: "x", ratio: "3:2" }),
  /不支持画面比例/,
);

// Bearer 前缀必须被剥掉，否则用户粘贴 "Bearer ak_x" 会认证失败
seen.length = 0;
polls = 0;
uploads = 0;
await provider.generateVideo.call({ ...ctx, config: { apiKey: "  Bearer ak_test  ", baseUrl: "https://xyq.jianying.com/" } }, { model: "Seedance_2.5", prompt: "x" });
assert.equal(seen.find((c) => c.url.includes("submit_run")).headers.Authorization, "Bearer ak_test");
assert.equal(await provider.getBalance.call({ ...ctx, config: { apiKey: "Bearer ak_test" } }).then(() => true), true);

// processMedia：超大图要缩到 4096 以内，正常图必须原样返回
const bigInput = { type: "binary", data: new Uint8Array([1]), mimeType: "image/png", name: "big.png" };
const smallInput = { type: "binary", data: new Uint8Array([2]), mimeType: "image/png", name: "small.png" };
const resizeCalls = [];
const mediaTool = {
  ...tool,
  media: {
    async inspectImage(input) {
      return input.name === "big.png" ? { width: 8192, height: 4096, format: "png" } : { width: 640, height: 480, format: "png" };
    },
    async resizeImage(input, options) {
      resizeCalls.push({ name: input.name, options });
      return { type: "binary", data: new Uint8Array([3]), mimeType: "image/png", name: input.name };
    },
  },
};
const processed = await provider.processMedia.call({ ...ctx, tool: mediaTool }, {
  model: "Nano2", prompt: "x", images: [bigInput, smallInput],
});
assert.equal(resizeCalls.length, 1);
assert.equal(resizeCalls[0].name, "big.png");
assert.deepEqual([resizeCalls[0].options.width, resizeCalls[0].options.height], [4096, 2048]);
assert.equal(processed.images[1], smallInput);
assert.notEqual(processed.images[0], bigInput);

// 本地解不开的图（svg）不能让整个流程崩掉
const brokenTool = { ...tool, media: { async inspectImage() { throw new Error("unsupported"); }, async resizeImage() { throw new Error("unsupported"); } } };
const survived = await provider.processMedia.call({ ...ctx, tool: brokenTool }, { model: "Nano2", prompt: "x", images: [bigInput] });
assert.equal(survived.images[0], bigInput);

// 没有参考图时不能平白多出字段
const untouched = await provider.processMedia.call({ ...ctx, tool: mediaTool }, { model: "Nano2", prompt: "x" });
assert.equal("images" in untouched, false);
assert.equal("firstFrame" in untouched, false);
// 价格只显示「按积分计费」，不能编造具体单价
const price = await provider.getPrice.call(ctx, { type: "video", model: "Seedance_2.5", prompt: "x", duration: 5 });
assert.equal(price.price, "按积分计费（每秒）");
assert.ok(price.tips.includes("5 秒"));
assert.ok(price.tips.includes("Seedance_2.5"));
const imgPrice = await provider.getPrice.call(ctx, { type: "image", model: "Nano2", prompt: "x" });
assert.equal(imgPrice.price, "按积分计费（每张）");
assert.ok(!/\d+(\.\d+)?\s*元/.test(price.price + imgPrice.price));
console.log("ALL OK");