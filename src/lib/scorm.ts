import "server-only";
import JSZip from "jszip";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { db } from "./db";
import { storage } from "./storage";
import { resolveVideoEmbed } from "./utils";

/** Markdown → sanitized HTML string (same GFM + sanitize rules as the in-app renderer). */
async function renderMarkdown(md: string) {
  if (!md.trim()) return "";
  const file = await remark().use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(md);
  return String(file);
}

/**
 * Packages a course as a SCORM 1.2 zip: one SCO per lesson with a small API wrapper that
 * reports `completed` when the learner presses "Mark complete". Uploaded media is bundled;
 * external video stays embedded. Quizzes are exported as reading-only summaries.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const API_JS = `
(function(){
  function findAPI(win){var n=0;while(win.API==null&&win.parent!=null&&win.parent!=win&&n<10){n++;win=win.parent;}return win.API||null;}
  var API=findAPI(window)||(window.opener?findAPI(window.opener):null);
  window.scorm={
    init:function(){if(API){API.LMSInitialize("");var s=API.LMSGetValue("cmi.core.lesson_status");if(s==="not attempted"||s===""){API.LMSSetValue("cmi.core.lesson_status","incomplete");API.LMSCommit("");}}},
    complete:function(){if(API){API.LMSSetValue("cmi.core.lesson_status","completed");API.LMSCommit("");}document.getElementById("done").textContent="Marked complete ✓";},
    finish:function(){if(API){API.LMSFinish("");}}
  };
  window.addEventListener("load",window.scorm.init);window.addEventListener("beforeunload",window.scorm.finish);
})();`;

const CSS = `body{font-family:system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#18181b}
h1{font-size:1.75rem}img,video{max-width:100%}pre{background:#f4f4f5;padding:1rem;overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #e4e4e7;padding:.4rem .6rem}
.meta{color:#71717a;font-size:.9rem}.btn{display:inline-block;margin-top:2rem;padding:.6rem 1rem;background:#4f46e5;color:#fff;border:0;border-radius:.4rem;font-size:1rem;cursor:pointer}#done{margin-left:1rem;color:#15803d}`;

export async function buildScormPackage(courseId: string) {
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, include: { questions: { orderBy: { position: "asc" }, include: { choices: { orderBy: { position: "asc" } } } } } } } },
    },
  });
  const zip = new JSZip();
  zip.file("shared/api.js", API_JS.trim());
  zip.file("shared/style.css", CSS);

  const items: string[] = [];
  const resources: string[] = [];
  const mediaAdded = new Set<string>();

  async function bundleMedia(url: string | null): Promise<string | null> {
    if (!url) return null;
    if (!url.startsWith("/api/media/")) return url; // external
    const key = decodeURIComponent(url.slice("/api/media/".length));
    const file = `media/${key.replace(/[^A-Za-z0-9._/-]/g, "_")}`;
    if (!mediaAdded.has(file)) {
      const meta = await storage.stat(key);
      if (!meta) return null;
      const chunks: Buffer[] = [];
      for await (const c of storage.stream(key)) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      zip.file(file, Buffer.concat(chunks));
      mediaAdded.add(file);
    }
    return `../${file}`;
  }

  for (const [mi, m] of course.modules.entries()) {
    const children: string[] = [];
    for (const [li, l] of m.lessons.entries()) {
      const id = `L${mi + 1}_${li + 1}`;
      const href = `lessons/${id}.html`;
      const media = await bundleMedia(l.mediaUrl);
      let mediaHtml = "";
      if (l.type === "VIDEO" && media) {
        const e = resolveVideoEmbed(media);
        mediaHtml = e?.kind === "youtube" || e?.kind === "vimeo" ? `<iframe src="${esc(e.src)}" width="100%" height="420" allowfullscreen></iframe>` : `<video controls src="${esc(media)}"></video>`;
      } else if (l.type === "AUDIO" && media) mediaHtml = `<audio controls src="${esc(media)}"></audio>`;
      else if (l.type === "IMAGE" && media) mediaHtml = `<img src="${esc(media)}" alt="${esc(l.mediaCaption)}">`;
      else if (l.type === "FILE" && media) mediaHtml = `<p><a href="${esc(media)}" download>Download attachment</a></p>`;
      if (l.mediaCaption && mediaHtml) mediaHtml += `<p class="meta">${esc(l.mediaCaption)}</p>`;

      const body = await renderMarkdown(l.body);
      const quizHtml =
        l.type === "QUIZ" && l.questions.length
          ? `<h2>Knowledge check (${l.questions.length} questions)</h2><ol>${l.questions
              .map((q) => `<li><p>${esc(q.prompt)}</p>${q.choices.length ? `<ul>${q.choices.map((c) => `<li>${esc(c.text)}</li>`).join("")}</ul>` : ""}</li>`)
              .join("")}</ol><p class="meta">Interactive grading is available on the e-learner platform; this export lists the questions for reference.</p>`
          : "";

      zip.file(
        href,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(l.title)}</title><link rel="stylesheet" href="../shared/style.css"><script src="../shared/api.js"></script></head>
<body><p class="meta">${esc(course.title)} · ${esc(m.title)}</p><h1>${esc(l.title)}</h1>${mediaHtml}${body}${quizHtml}
<button class="btn" onclick="scorm.complete()">Mark complete</button><span id="done"></span></body></html>`,
      );
      children.push(`<item identifier="ITEM_${id}" identifierref="RES_${id}"><title>${esc(l.title)}</title></item>`);
      resources.push(`<resource identifier="RES_${id}" type="webcontent" adlcp:scormtype="sco" href="${href}"><file href="${href}"/><file href="shared/api.js"/><file href="shared/style.css"/></resource>`);
    }
    items.push(`<item identifier="MOD_${mi + 1}"><title>${esc(m.title)}</title>${children.join("")}</item>`);
  }

  zip.file(
    "imsmanifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${esc(course.slug)}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG"><organization identifier="ORG"><title>${esc(course.title)}</title>${items.join("")}</organization></organizations>
  <resources>${resources.join("")}</resources>
</manifest>`,
  );

  return { filename: `${course.slug}-scorm12.zip`, data: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) };
}
