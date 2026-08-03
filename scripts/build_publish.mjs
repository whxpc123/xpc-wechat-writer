import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const directoryDate = basename(root).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
const versionDate = (directoryDate ?? new Date().toISOString().slice(0, 10)).replaceAll('-', '.');
const generatedPath = join(root, 'article-formatted.html');
const markdownPath = join(root, 'article-formatted.md');
const wechatBodyPath = join(root, 'wechat-body.html');
const articlePath = join(root, 'article.html');
const publishPath = join(root, 'publish.html');

const generated = await readFile(generatedPath, 'utf8');
const markdown = await readFile(markdownPath, 'utf8');
const title = frontmatterValue(markdown, 'title')
  ?? decodeEntities(generated.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '公众号文章');
const summary = frontmatterValue(markdown, 'summary')
  ?? decodeEntities(generated.match(/<meta name="description" content="([\s\S]*?)">/i)?.[1] ?? '');
const outputStart = generated.indexOf('<div id="output">');
const outputEnd = generated.lastIndexOf('</div>');
const articleBody = outputStart >= 0 && outputEnd > outputStart
  ? generated.slice(outputStart + '<div id="output">'.length, outputEnd).trim()
  : generated.trim();

if (!/^<section[\s>]/i.test(articleBody) || !/<\/section>\s*$/i.test(articleBody)) {
  throw new Error('article-formatted.html must contain a root <section> or a legacy #output section');
}

await writeFile(wechatBodyPath, `${articleBody}\n`, 'utf8');
const safeTitle = escapeHtml(title);
const safeSummary = escapeHtml(summary);
const bodyImagePaths = [...articleBody.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)]
  .map((match) => match[1]);
const imageCount = bodyImagePaths.length;
const isGzhDesign = /<span\s+leaf(?:="")?/i.test(articleBody);
const layoutLabel = isGzhDesign ? 'gzh-design · selected theme · inline CSS' : 'legacy · inline CSS';
const portableImagePaths = [...new Set(['imgs/cover.png', ...bodyImagePaths])];
const embeddedImageData = Object.fromEntries(await Promise.all(
  portableImagePaths.map(async (relativePath) => {
    const image = await readFile(join(root, relativePath));
    return [relativePath, `data:image/png;base64,${image.toString('base64')}`];
  }),
));
const embeddedImageJson = JSON.stringify(embeddedImageData);

const template = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <title>公众号发布工作台｜${safeTitle}</title>
  <style>
    :root {
      --canvas: #eef4fb;
      --panel: #ffffff;
      --ink: #102a43;
      --muted: #62758a;
      --line: #d9e5f2;
      --blue: #2563eb;
      --blue-deep: #1e3a5f;
      --cyan: #06b6d4;
      --amber: #f59e0b;
      --success: #0f8a65;
      --danger: #b42318;
      --shadow: 0 18px 50px rgba(30, 58, 95, 0.12);
    }

    * { box-sizing: border-box; }

    html { background: var(--canvas); }

    body {
      margin: 0;
      min-width: 320px;
      color: var(--ink);
      background:
        linear-gradient(rgba(37, 99, 235, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(37, 99, 235, 0.035) 1px, transparent 1px),
        var(--canvas);
      background-size: 32px 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    button, a { -webkit-tap-highlight-color: transparent; }

    .page {
      width: min(1480px, 100%);
      margin: 0 auto;
      padding: clamp(14px, 2.5vw, 36px);
    }

    .masthead {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 22px;
      padding: 0 2px;
    }

    .eyebrow {
      margin: 0 0 8px;
      color: var(--blue);
      font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1 {
      max-width: 920px;
      margin: 0;
      color: var(--blue-deep);
      font-family: ui-serif, "Songti SC", STSong, "Noto Serif CJK SC", serif;
      font-size: clamp(26px, 3.1vw, 48px);
      font-weight: 700;
      line-height: 1.18;
      letter-spacing: -0.025em;
    }

    .version {
      flex: 0 0 auto;
      color: var(--muted);
      font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
      gap: clamp(18px, 2.4vw, 34px);
      align-items: start;
    }

    .control-panel {
      position: sticky;
      top: 20px;
      display: grid;
      gap: 14px;
      max-height: calc(100vh - 40px);
      overflow: auto;
      padding: 2px 4px 18px 2px;
      scrollbar-width: thin;
    }

    .card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 10px 30px rgba(30, 58, 95, 0.07);
    }

    .cover-wrap {
      position: relative;
      aspect-ratio: 2.35 / 1;
      overflow: hidden;
      background: #f8f9fa;
    }

    .cover-wrap::after {
      content: "2.35:1";
      position: absolute;
      right: 10px;
      bottom: 9px;
      padding: 4px 7px;
      border: 1px solid rgba(255,255,255,.75);
      border-radius: 999px;
      color: #fff;
      background: rgba(16, 42, 67, 0.72);
      font: 700 10px/1 ui-monospace, monospace;
      backdrop-filter: blur(8px);
    }

    .cover-wrap img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .card-body { padding: 16px; }

    .card-label {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .copy-value {
      margin: 0 0 14px;
      color: var(--ink);
      font-size: 14px;
      line-height: 1.65;
      word-break: break-word;
    }

    .copy-value.title-value {
      font-family: ui-serif, "Songti SC", STSong, serif;
      font-size: 17px;
      font-weight: 700;
      line-height: 1.5;
    }

    .action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .button {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border: 1px solid transparent;
      border-radius: 12px;
      color: #fff;
      background: var(--blue);
      font: 700 14px/1.2 inherit;
      text-decoration: none;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(37,99,235,.2); }
    .button:active { transform: translateY(0); }
    .button:disabled { opacity: .62; cursor: wait; transform: none; box-shadow: none; }
    .button.secondary { color: var(--blue-deep); background: #edf4ff; border-color: #cfe0f5; }
    .button.full { width: 100%; }

    .button:focus-visible, a:focus-visible {
      outline: 3px solid rgba(6, 182, 212, 0.34);
      outline-offset: 3px;
    }

    .status {
      min-height: 48px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 1px dashed #b9cadc;
      border-radius: 14px;
      color: var(--muted);
      background: rgba(255,255,255,.66);
      font-size: 13px;
      line-height: 1.5;
    }

    .status::before {
      content: "";
      width: 9px;
      height: 9px;
      flex: 0 0 auto;
      border-radius: 50%;
      background: var(--cyan);
      box-shadow: 0 0 0 4px rgba(6,182,212,.12);
    }

    .status[data-tone="success"] { color: var(--success); border-color: rgba(15,138,101,.32); }
    .status[data-tone="success"]::before { background: var(--success); box-shadow: 0 0 0 4px rgba(15,138,101,.12); }
    .status[data-tone="error"] { color: var(--danger); border-color: rgba(180,35,24,.28); }
    .status[data-tone="error"]::before { background: var(--danger); box-shadow: 0 0 0 4px rgba(180,35,24,.1); }

    .tips {
      margin: 0;
      padding: 0 0 0 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.7;
    }

    .preview-panel {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 16px;
      border-bottom: 1px solid var(--line);
      border-radius: 24px 24px 0 0;
      background: rgba(255,255,255,.9);
      backdrop-filter: blur(15px);
    }

    .preview-title {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--blue-deep);
      font-size: 13px;
      font-weight: 800;
    }

    .preview-title::before {
      content: "";
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      border: 2px solid var(--blue);
      border-radius: 5px;
      box-shadow: inset -5px -5px 0 #dce9ff;
    }

    .preview-meta {
      color: var(--muted);
      font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: nowrap;
    }

    .wechat-frame { padding: clamp(12px, 2.2vw, 28px); }

    #wechat-body {
      max-width: 860px;
      margin: 0 auto;
      background: #fff;
    }

    #wechat-body img { max-width: 100%; height: auto; }

    .footer-note {
      margin: 18px auto 0;
      max-width: 860px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.7;
      text-align: center;
    }

    @media (max-width: 960px) {
      .workspace { grid-template-columns: 1fr; }
      .control-panel { position: static; max-height: none; grid-template-columns: 1fr 1fr; overflow: visible; padding: 0; }
      .cover-card, .status-card { grid-column: 1 / -1; }
      .preview-toolbar { position: static; }
    }

    @media (max-width: 620px) {
      .page { padding: 12px; }
      .masthead { display: block; margin-bottom: 14px; }
      .version { margin-top: 10px; }
      .control-panel { grid-template-columns: 1fr; gap: 10px; }
      .cover-card, .status-card { grid-column: auto; }
      .card, .preview-panel { border-radius: 16px; }
      .preview-toolbar { align-items: flex-start; border-radius: 16px 16px 0 0; }
      .preview-meta { white-space: normal; text-align: right; }
      .wechat-frame { padding: 8px; }
      #wechat-body > section { border-radius: 14px !important; padding-left: 10px !important; padding-right: 10px !important; }
      #wechat-body p { font-size: 16px !important; line-height: 1.9 !important; word-break: normal !important; }
      .action-grid { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div>
        <p class="eyebrow">WeChat Publish Console</p>
        <h1>${safeTitle}</h1>
      </div>
      <div class="version">${versionDate} · ${imageCount} IMAGES</div>
    </header>

    <main class="workspace">
      <aside class="control-panel" aria-label="发布素材">
        <section class="card cover-card">
          <div class="cover-wrap">
            <img id="cover-image" src="imgs/cover.png" alt="公众号封面">
          </div>
          <div class="card-body action-grid">
            <button class="button" type="button" data-action="cover">复制封面</button>
            <a class="button secondary" href="imgs/cover.png" target="_blank" rel="noopener">打开原图</a>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <p class="card-label">标题</p>
            <p class="copy-value title-value" id="title-value">${safeTitle}</p>
            <button class="button full" type="button" data-copy-text="title-value">复制标题</button>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <p class="card-label">摘要</p>
            <p class="copy-value" id="summary-value">${safeSummary}</p>
            <button class="button full" type="button" data-copy-text="summary-value">复制摘要</button>
          </div>
        </section>

        <section class="card status-card">
          <div class="card-body">
            <button class="button full" type="button" data-action="body">复制正文和图片</button>
          </div>
          <div class="card-body" style="padding-top:0">
            <div class="status" id="copy-status" role="status" aria-live="polite">准备就绪，按需要分别复制。</div>
          </div>
          <div class="card-body" style="padding-top:0">
            <ul class="tips">
              <li>正文复制会保留微信内联样式和${imageCount}张图片。</li>
              <li>若浏览器询问剪贴板权限，请选择允许。</li>
              <li>也可直接打开 <a href="wechat-body.html" target="_blank" rel="noopener">纯正文HTML</a> 手动全选复制。</li>
            </ul>
          </div>
        </section>
      </aside>

      <section class="preview-panel" aria-label="公众号正文预览">
        <div class="preview-toolbar">
          <div class="preview-title">公众号正文预览</div>
          <div class="preview-meta">${layoutLabel}</div>
        </div>
        <div class="wechat-frame">
          <article id="wechat-body">
<!--ARTICLE_BODY-->
          </article>
          <p class="footer-note">预览宽度上限860px，手机端自动切换为单栏并放大正文字号。</p>
        </div>
      </section>
    </main>
  </div>

  <script>
    const statusBox = document.getElementById('copy-status');
    const embeddedImageData = Object.freeze(${embeddedImageJson});

    function setStatus(message, tone = 'info') {
      statusBox.textContent = message;
      statusBox.dataset.tone = tone;
    }

    function fallbackCopyText(text) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) throw new Error('浏览器没有完成复制');
    }

    async function copyTextFrom(id, button) {
      const text = document.getElementById(id).textContent.trim();
      button.disabled = true;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else fallbackCopyText(text);
        setStatus(button.textContent.replace('复制', '') + '已复制。', 'success');
      } catch (error) {
        try {
          fallbackCopyText(text);
          setStatus(button.textContent.replace('复制', '') + '已复制。', 'success');
        } catch {
          setStatus('复制失败，请手动选择对应内容。', 'error');
        }
      } finally {
        button.disabled = false;
      }
    }

    async function imageToDataUrl(image) {
      if (!image.complete) await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    }

    function selectionCopy(element) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
      const ok = document.execCommand('copy');
      selection.removeAllRanges();
      if (!ok) throw new Error('浏览器没有完成富文本复制');
    }

    function selectionCopyDetached(element) {
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'fixed';
      host.style.left = '-100000px';
      host.style.top = '0';
      host.style.width = '860px';
      host.style.background = '#fff';
      host.style.pointerEvents = 'none';
      host.appendChild(element);
      document.body.appendChild(host);

      try {
        selectionCopy(host);
      } finally {
        host.remove();
      }
    }

    async function hydrateCloneImages(source, clone) {
      const sourceImages = [...source.querySelectorAll('img')];
      const cloneImages = [...clone.querySelectorAll('img')];

      for (let index = 0; index < sourceImages.length; index += 1) {
        const relativePath = sourceImages[index].getAttribute('src');
        cloneImages[index].src = embeddedImageData[relativePath]
          ?? await imageToDataUrl(sourceImages[index]);
        cloneImages[index].removeAttribute('data-local-path');
        cloneImages[index].removeAttribute('srcset');
      }
    }

    async function copyBody(button) {
      button.disabled = true;
      setStatus('正在把${imageCount}张图片写入富文本剪贴板，请稍候。');

      const source = document.querySelector('#wechat-body > section');
      if (!source) throw new Error('找不到公众号正文根 section');
      const clone = source.cloneNode(true);
      await hydrateCloneImages(source, clone);

      const html = '<meta charset="utf-8">' + clone.outerHTML;
      const plain = source.innerText;

      try {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([plain], { type: 'text/plain' })
            })
          ]);
        } else {
          selectionCopyDetached(clone);
        }
        setStatus('正文和${imageCount}张图片已复制，可以粘贴到公众号编辑器。', 'success');
      } catch {
        try {
          selectionCopyDetached(clone);
          setStatus('正文和${imageCount}张图片已通过兼容模式复制。', 'success');
        } catch {
          setStatus('浏览器阻止了富文本复制，请打开纯正文HTML后全选复制。', 'error');
        }
      } finally {
        button.disabled = false;
      }
    }

    async function copyCover(button) {
      button.disabled = true;
      setStatus('正在准备封面图片。');
      const image = document.getElementById('cover-image');

      try {
        const dataUrl = embeddedImageData[image.getAttribute('src')]
          ?? await imageToDataUrl(image);
        const blob = await (await fetch(dataUrl)).blob();
        if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Clipboard image API unavailable');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatus('封面图片已复制。', 'success');
      } catch {
        try {
          const clone = image.cloneNode(true);
          clone.src = embeddedImageData[image.getAttribute('src')] ?? image.src;
          selectionCopyDetached(clone);
          setStatus('封面已通过兼容模式复制。', 'success');
        } catch {
          setStatus('浏览器不允许直接复制图片，请点击打开原图后复制。', 'error');
        }
      } finally {
        button.disabled = false;
      }
    }

    document.querySelectorAll('[data-copy-text]').forEach((button) => {
      button.addEventListener('click', () => copyTextFrom(button.dataset.copyText, button));
    });

    document.querySelector('[data-action="body"]').addEventListener('click', (event) => copyBody(event.currentTarget));
    document.querySelector('[data-action="cover"]').addEventListener('click', (event) => copyCover(event.currentTarget));
  </script>
</body>
</html>`;

const workbench = template.replace('<!--ARTICLE_BODY-->', articleBody);
await writeFile(articlePath, workbench, 'utf8');
await writeFile(publishPath, workbench, 'utf8');

console.log(JSON.stringify({ articlePath, publishPath, wechatBodyPath, title, summary }, null, 2));

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function decodeEntities(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function frontmatterValue(source, key) {
  const raw = source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!raw) return undefined;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}
