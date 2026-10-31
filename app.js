/* 兄弟回忆录 · 前端
   - 读取/写入都在 GitHub 仓库里（data/memoir.json + media/）
   - 没填令牌时退化为本机浏览器存储（localStorage），方便先看效果
*/
(() => {
  "use strict";

  const API = "https://api.github.com";
  const LS_CFG = "bm.cfg";
  const LS_DATA = "bm.data";

  const DEFAULT_CFG = { owner: "whsxh", repo: "brother-memoir", branch: "main", token: "" };
  const DEFAULT_DATA = {
    meta: {
      title: "兄弟回忆录",
      kicker: "EST. 那段一起疯的日子",
      subtitle: "写给我们一起走过的那些年",
      crew: ["老张", "阿伟", "小胖", "我"],
      updatedAt: ""
    },
    texts: [
      {
        id: "t1",
        title: "那年夏天，我们把宿舍吃空了",
        body: "凌晨两点翻墙出去买烧烤，回来被宿管堵在楼梯口。\n老张说「跑」，结果他跑得最快，被抓的也是他。",
        date: "2019 · 夏"
      }
    ],
    photos: [],
    videos: []
  };

  let cfg = load(LS_CFG, DEFAULT_CFG);
  let data = load(LS_DATA, DEFAULT_DATA);
  let editing = false;
  let sha = null;           // data/memoir.json 的 sha，更新时要用
  let saveTimer = null;

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return Object.assign(structuredClone(fallback), JSON.parse(raw));
    } catch {
      return structuredClone(fallback);
    }
  }
  function persistLocal() {
    try {
      localStorage.setItem(LS_CFG, JSON.stringify(cfg));
      localStorage.setItem(LS_DATA, JSON.stringify(data));
    } catch {}
  }

  const status = (msg, sticky) => {
    const s = $("#status");
    s.textContent = msg;
    if (!sticky) {
      clearTimeout(status._t);
      status._t = setTimeout(() => {
        s.textContent = cfg.token ? "已同步" : "本地模式";
      }, 2600);
    }
  };

  /* ---------- GitHub 读写 ---------- */
  async function gh(method, path, body) {
    const headers = { Accept: "application/vnd.github+json" };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j.message || "";
      } catch {}
      throw new Error(`${res.status} ${detail}`);
    }
    return res.status === 204 ? null : res.json();
  }

  const repoPath = () => `/${cfg.owner}/${cfg.repo}`;

  async function readManifest() {
    try {
      const j = await gh("GET", `${repoPath()}/contents/data/memoir.json?ref=${cfg.branch}`);
      sha = j.sha;
      const text = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ""))));
      return JSON.parse(text);
    } catch (e) {
      if (String(e.message).startsWith("404")) return null;
      throw e;
    }
  }

  async function writeManifest() {
    const json = JSON.stringify(data, null, 2);
    const content = btoa(unescape(encodeURIComponent(json)));
    const j = await gh("PUT", `${repoPath()}/contents/data/memoir.json`, {
      message: `更新回忆录 ${new Date().toLocaleString("zh-CN")}`,
      content,
      branch: cfg.branch,
      ...(sha ? { sha } : {})
    });
    sha = j.content.sha;
  }

  async function uploadBlob(path, blob, message) {
    const buf = await blob.arrayBuffer();
    const content = btoa(String.fromCharCode(...new Uint8Array(buf)));
    let oldSha;
    try {
      const j = await gh("GET", `${repoPath()}/contents/${path}?ref=${cfg.branch}`);
      oldSha = j.sha;
    } catch {}
    await gh("PUT", `${repoPath()}/contents/${path}`, {
      message,
      content,
      branch: cfg.branch,
      ...(oldSha ? { sha: oldSha } : {})
    });
  }

  const rawUrl = (path) =>
    `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;

  /* 缩图：长边 1800，jpeg 0.82 */
  function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 1800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => resolve(b || file), "image/jpeg", 0.82);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  async function saveNow() {
    data.meta.updatedAt = new Date().toISOString();
    persistLocal();
    if (!cfg.token) {
      status("已存本机（未连接仓库）");
      return;
    }
    try {
      status("保存中…", true);
      await writeManifest();
      status("已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch (e) {
      status("保存失败：" + e.message, true);
    }
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  };

  /* ---------- 渲染 ---------- */
  function renderHero() {
    $("#heroTitle").textContent = data.meta.title;
    $("#heroKicker").textContent = data.meta.kicker;
    $("#heroSub").textContent = data.meta.subtitle;
    $("#brandText").textContent = data.meta.title;
    document.title = data.meta.title;

    const chips = $("#crewChips");
    chips.innerHTML = "";
    (data.meta.crew || []).forEach((name, i) => {
      const c = el("span", "chip", name);
      c.contentEditable = editing ? "true" : "false";
      c.addEventListener("blur", () => {
        data.meta.crew[i] = c.textContent.trim();
        scheduleSave();
      });
      chips.appendChild(c);
    });
    if (editing) {
      const add = el("button", "btn mini", "＋ 兄弟");
      add.onclick = () => {
        const n = prompt("名字？");
        if (n) {
          data.meta.crew.push(n.trim());
          renderHero();
          scheduleSave();
        }
      };
      chips.appendChild(add);
    }
  }

  function renderTexts() {
    const grid = $("#textGrid");
    grid.innerHTML = "";
    if (!data.texts.length) {
      grid.appendChild(el("div", "empty", "还没有文字。点右上「编辑模式」，再点「写一条」。"));
      return;
    }
    data.texts.forEach((t, idx) => {
      const card = el("article", "memo");
      const h = el("h3", "", t.title || "（没有标题）");
      const p = el("p", "", t.body || "");
      const d = el("div", "date", t.date || "");
      card.append(h, p, d);

      if (editing) {
        [h, p, d].forEach((n) => {
          n.contentEditable = "true";
          n.addEventListener("blur", () => {
            t.title = h.textContent.trim();
            t.body = p.textContent;
            t.date = d.textContent.trim();
            scheduleSave();
          });
        });
        const tools = el("div", "tools");
        const del = el("button", "del", "删除");
        del.onclick = () => {
          if (confirm("删掉这条文字？")) {
            data.texts.splice(idx, 1);
            renderTexts();
            scheduleSave();
          }
        };
        tools.appendChild(del);
        card.appendChild(tools);
      }
      grid.appendChild(card);
    });
  }

  function renderPhotos() {
    const wall = $("#photoWall");
    wall.innerHTML = "";
    if (!data.photos.length) {
      wall.appendChild(el("div", "empty", "还没有照片。编辑模式下点「＋ 传照片」。"));
      return;
    }
    data.photos.forEach((ph, idx) => {
      const fig = el("figure", "polaroid");
      const img = el("img");
      img.loading = "lazy";
      img.src = ph.src.startsWith("http") ? ph.src : rawUrl(ph.src);
      img.alt = ph.caption || "照片";
      const cap = el("figcaption", "cap", ph.caption || "");
      fig.append(img, cap);

      if (editing) {
        cap.contentEditable = "true";
        cap.addEventListener("blur", () => {
          ph.caption = cap.textContent.trim();
          scheduleSave();
        });
        const tools = el("div", "tools");
        const del = el("button", "del", "删除");
        del.onclick = () => {
          if (confirm("删掉这张照片？")) {
            data.photos.splice(idx, 1);
            renderPhotos();
            scheduleSave();
          }
        };
        tools.appendChild(del);
        fig.appendChild(tools);
      }
      wall.appendChild(fig);
    });
  }

  function renderVideos() {
    const grid = $("#videoGrid");
    grid.innerHTML = "";
    if (!data.videos.length) {
      grid.appendChild(el("div", "empty", "还没有视频。可以传文件，也可以填 B 站 / 网盘外链。"));
      return;
    }
    data.videos.forEach((v, idx) => {
      const card = el("article", "reel");
      const src = v.src.startsWith("http") ? v.src : rawUrl(v.src);
      if (v.kind === "iframe") {
        const f = document.createElement("iframe");
        f.src = src;
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.allowFullscreen = true;
        card.appendChild(f);
      } else {
        const vid = document.createElement("video");
        vid.src = src;
        vid.controls = true;
        vid.preload = "metadata";
        card.appendChild(vid);
      }
      const meta = el("div", "meta");
      const cap = el("div", "cap", v.caption || "未命名");
      const d = el("div", "date", v.date || "");
      meta.append(cap, d);
      card.appendChild(meta);

      if (editing) {
        cap.contentEditable = "true";
        cap.addEventListener("blur", () => {
          v.caption = cap.textContent.trim();
          scheduleSave();
        });
        const tools = el("div", "tools");
        const del = el("button", "del", "删除");
        del.onclick = () => {
          if (confirm("删掉这个视频？")) {
            data.videos.splice(idx, 1);
            renderVideos();
            scheduleSave();
          }
        };
        tools.appendChild(del);
        card.appendChild(tools);
      }
      grid.appendChild(card);
    });
  }

  function renderAll() {
    document.body.classList.toggle("editing", editing);
    $("#btnEdit").textContent = editing ? "退出编辑" : "编辑模式";
    ["#heroTitle", "#heroKicker", "#heroSub"].forEach((sel) => {
      document.querySelector(sel).contentEditable = editing ? "true" : "false";
    });
    renderHero();
    renderTexts();
    renderPhotos();
    renderVideos();
    $("#repoLabel").textContent = cfg.token ? `${cfg.owner}/${cfg.repo}` : "本机浏览器（未连接）";
  }

  /* ---------- 交互 ---------- */
  $("#btnEdit").onclick = () => {
    editing = !editing;
    renderAll();
    status(editing ? "编辑模式：点文字即可改" : "已退出编辑");
  };

  ["#heroTitle", "#heroKicker", "#heroSub"].forEach((sel) => {
    document.querySelector(sel).addEventListener("blur", (e) => {
      const v = e.target.textContent.trim();
      if (sel === "#heroTitle") data.meta.title = v;
      if (sel === "#heroKicker") data.meta.kicker = v;
      if (sel === "#heroSub") data.meta.subtitle = v;
      renderHero();
      scheduleSave();
    });
  });

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.onclick = () => {
      if (!editing) {
        status("先点右上「编辑模式」");
        return;
      }
      data.texts.unshift({
        id: "t" + Date.now(),
        title: "新的一条",
        body: "",
        date: new Date().toLocaleDateString("zh-CN")
      });
      renderTexts();
      scheduleSave();
    };
  });

  $("#photoInput").onchange = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    if (!cfg.token) {
      status("没有令牌：只会存本机，无法上传", true);
      for (const f of files) {
        data.photos.unshift({ id: "p" + Date.now(), src: URL.createObjectURL(f), caption: "", date: "" });
      }
      renderPhotos();
      persistLocal();
      return;
    }
    for (const f of files) {
      try {
        status(`压缩并上传 ${f.name}…`, true);
        const blob = await compressImage(f);
        const path = `media/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_").replace(/\.\w+$/, "")}.jpg`;
        await uploadBlob(path, blob, `上传照片 ${f.name}`);
        data.photos.unshift({ id: "p" + Date.now(), src: path, caption: "", date: "" });
        renderPhotos();
      } catch (err) {
        status("上传失败：" + err.message, true);
      }
    }
    await saveNow();
    status("照片已上传");
  };

  $("#videoInput").onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!cfg.token) {
      status("没有令牌：无法上传视频", true);
      return;
    }
    if (f.size > 45 * 1024 * 1024) {
      alert("这个视频 " + (f.size / 1048576).toFixed(1) + " MB，超过 45 MB。\n建议先传到 B 站/网盘，再用「＋ 加外链」填地址。");
      return;
    }
    try {
      status(`上传视频 ${f.name}…`, true);
      const path = `media/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      await uploadBlob(path, f, `上传视频 ${f.name}`);
      data.videos.unshift({ id: "v" + Date.now(), src: path, kind: "video", caption: f.name, date: "" });
      renderVideos();
      await saveNow();
      status("视频已上传");
    } catch (err) {
      status("上传失败：" + err.message, true);
    }
  };

  $("#btnAddVideoLink").onclick = () => {
    if (!editing) {
      status("先点右上「编辑模式」");
      return;
    }
    const url = prompt("填视频地址（B 站播放器嵌入地址，或 mp4 直链）");
    if (!url) return;
    const isIframe = /player\.bilibili\.com|youtube\.com\/embed|player\.youku/.test(url);
    data.videos.unshift({
      id: "v" + Date.now(),
      src: url,
      kind: isIframe ? "iframe" : "video",
      caption: "外链视频",
      date: new Date().toLocaleDateString("zh-CN")
    });
    renderVideos();
    scheduleSave();
  };

  /* 设置 */
  $("#btnSettings").onclick = () => {
    $("#cfgOwner").value = cfg.owner;
    $("#cfgRepo").value = cfg.repo;
    $("#cfgBranch").value = cfg.branch;
    $("#cfgToken").value = cfg.token;
    $("#modal").hidden = false;
  };
  $("#btnCancelCfg").onclick = () => ($("#modal").hidden = true);
  $("#btnSaveCfg").onclick = async () => {
    cfg = {
      owner: $("#cfgOwner").value.trim() || DEFAULT_CFG.owner,
      repo: $("#cfgRepo").value.trim() || DEFAULT_CFG.repo,
      branch: $("#cfgBranch").value.trim() || "main",
      token: $("#cfgToken").value.trim()
    };
    persistLocal();
    $("#modal").hidden = true;
    status("已保存连接设置");
    await boot();
  };

  /* 启动 */
  async function boot() {
    renderAll();
    status("读取中…", true);
    try {
      const remote = await readManifest();
      if (remote) {
        data = Object.assign(structuredClone(DEFAULT_DATA), remote);
        persistLocal();
        renderAll();
        status(cfg.token ? "已同步" : "已读取仓库内容");
      } else {
        status("仓库里还没有内容，编辑后自动创建");
      }
    } catch (e) {
      status("读取失败：" + e.message + "，先用本机数据", true);
    }
  }

  // 调试用
  window.__memoir = { get data() { return data; }, get cfg() { return cfg; } };
  boot();
})();
