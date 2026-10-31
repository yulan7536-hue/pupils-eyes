/**
 * 教案文件解析：把教师上传的文档就地转成纯文本，供六维雷达图分析使用。
 *
 * 支持：
 *  - .txt / .md / .markdown        → 直接按 UTF-8 读
 *  - .docx                          → mammoth 抽正文（浏览器版，走 blob 解压）
 *  - .pdf                           → pdfjs-dist 逐页抽文字层
 *  - .doc（旧版二进制 Word）        → 浏览器无法可靠解析，给出明确提示让教师另存为 docx
 *
 * 所有解析都在浏览器本地完成，文件不会离开这台电脑。
 */

export const MAX_FILE_MB = 12;

export type ParsedLesson = {
  text: string;
  /** 文件名（去掉扩展名），可直接用作课题名称预填 */
  title: string;
  /** 页数 / 段落数之类的量，用于给教师一个「确实读到了」的反馈 */
  meta: string;
};

const TEXT_EXT = ['txt', 'md', 'markdown', 'text', 'csv'];

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? name : name.slice(0, i);
}

/** 统一清洗：去掉多余空行、全角空格、控制字符，控制总长度 */
function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
}

async function readText(file: File): Promise<ParsedLesson> {
  const text = tidy(await file.text());
  return {
    text,
    title: stripExt(file.name),
    meta: `正文 ${text.length} 字`,
  };
}

async function readDocx(file: File): Promise<ParsedLesson> {
  const mammoth = await import('mammoth');
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = tidy(value);
  if (!text) throw new Error('这个 Word 文档里没有可读取的文字，可能是纯图片扫描件');
  const paragraphs = text.split(/\n/).filter((l) => l.trim()).length;
  return { text, title: stripExt(file.name), meta: `${paragraphs} 个段落 · ${text.length} 字` };
}

async function readPdf(file: File): Promise<ParsedLesson> {
  const pdfjs = await import('pdfjs-dist');
  // worker 交给 Vite 打包，避免依赖 CDN
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const chunks: string[] = [];
  const pages = Math.min(doc.numPages, 40);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ');
    chunks.push(line);
  }
  const text = tidy(chunks.join('\n'));
  if (text.length < 30) {
    throw new Error('这份 PDF 没有文字层（可能是扫描件或图片导出），请复制文字后直接粘贴');
  }
  return { text, title: stripExt(file.name), meta: `${doc.numPages} 页 · ${text.length} 字` };
}

export async function parseLessonFile(file: File): Promise<ParsedLesson> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`文件超过 ${MAX_FILE_MB}MB，请精简后再上传`);
  }

  const ext = extOf(file.name);

  if (TEXT_EXT.includes(ext)) return readText(file);
  if (ext === 'docx') return readDocx(file);
  if (ext === 'pdf') return readPdf(file);
  if (ext === 'doc') {
    throw new Error('旧版 .doc 格式无法在浏览器解析，请在 Word 里「另存为 .docx」后再上传');
  }
  if (ext === 'pptx' || ext === 'ppt') {
    throw new Error('暂不支持 PPT，请把讲稿或教案正文另存为 .docx / .pdf 后上传');
  }
  throw new Error(`不支持 .${ext || '未知'} 格式，请上传 .docx、.pdf、.txt 或 .md`);
}

export const ACCEPT_ATTR = '.docx,.pdf,.txt,.md,.markdown,.doc,application/pdf';
