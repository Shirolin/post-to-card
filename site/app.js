/**
 * PostPress 产品页：语言切换、材质样张、入场动效。
 *
 * 页面本身是静态 HTML，中文写在标签里；这里只负责换成英文、换样张、加动效。
 * JS 不跑时，中文版本与第一张样张仍然完整可读。
 */

const MATERIALS = {
  minimal: {
    zh: '极简',
    en: 'Minimal',
    surface: '#faf9f5', // taste-skill-ignore 产品自身的纸色，不是页面配色
    ink: '#121211',
    accent: '#2563eb',
    zhNote: '暖白纸面，没有边框线，只留排版本身。',
    enNote: 'Warm white, no frame, nothing but the typesetting.',
  },
  midnight: {
    zh: '夜幕',
    en: 'Midnight',
    surface: '#181b22',
    ink: '#f0f2f5',
    accent: '#7aa2ff',
    zhNote: '深墨底、浅字，夜里读也不刺眼。',
    enNote: 'A deep ground with pale type, easy at night.',
  },
  glass: {
    zh: '液态玻璃',
    en: 'Liquid Glass',
    surface: '#ebf1f8',
    ink: '#0f172a',
    accent: '#0369a1',
    zhNote: '半透明玻璃片，边缘一道细光。',
    enNote: 'A translucent pane with a thin lit edge.',
  },
  material: {
    zh: '质感',
    en: 'Material 3',
    surface: '#f4f6f0',
    ink: '#191d17',
    accent: '#3e6837',
    zhNote: 'MD3 的色块层次与圆角。',
    enNote: 'Material 3 tonal blocks and corners.',
  },
  gallery: {
    zh: '画廊',
    en: 'Gallery',
    surface: '#f7f7f4',
    ink: '#101011',
    accent: '#1b3bd6',
    zhNote: '墙标与左侧装裱线，像美术馆的展签。',
    enNote: 'A wall label and a mounting rule, like a museum caption.',
  },
  darkroom: {
    zh: '暗房',
    en: 'Darkroom',
    surface: '#1b1b1e',
    ink: '#ededf0',
    accent: '#ffb02e',
    zhNote: '接触印相：片号、留白、银盐的灰。',
    enNote: 'A contact print: frame numbers, margins, silver grey.',
  },
  riso: {
    zh: '孔版',
    en: 'Riso',
    surface: '#f2f3ee',
    ink: '#17238a',
    accent: '#ff3d8b',
    zhNote: '荧光墨、错位套印、纸的颗粒。',
    enNote: 'Fluorescent inks, a misregistered pass, paper grain.',
  },
  sumi: {
    zh: '水墨',
    en: 'Sumi',
    surface: '#e4e9e3',
    ink: '#161f1a',
    accent: '#b4281d',
    zhNote: '宣纸、淡墨、一枚朱砂印。',
    enNote: 'Rice paper, diluted ink, a cinnabar seal.',
  },
  clay: {
    zh: '软陶',
    en: 'Clay',
    surface: '#d8e6f4',
    ink: '#0d2540',
    accent: '#ff6a2b',
    zhNote: '圆角、软过渡，像捏出来的。',
    enNote: 'Rounded and soft, as if pressed by hand.',
  },
  terminal: {
    zh: '终端',
    en: 'Terminal',
    surface: '#161d16',
    ink: '#d8f5d0',
    accent: '#5ee08a',
    zhNote: '等宽字、扫描线、命令行绿。',
    enNote: 'Monospace, scanlines, console green.',
  },
  receipt: {
    zh: '小票',
    en: 'Receipt',
    surface: '#f5f5f1',
    ink: '#1c1c1b',
    accent: '#1c1c1b',
    zhNote: '热敏纸、虚线、紧排的等宽小字。',
    enNote: 'Thermal paper, dashed rules, tight monospace.',
  },
  brutalist: {
    zh: '粗野派',
    en: 'Brutalist',
    surface: '#ffe64a',
    ink: '#111110',
    accent: '#5a14d8',
    zhNote: '3px 硬边、荧光黄，实验性的一档。',
    enNote: 'A 3px hard frame and fluorescent yellow. Experimental.',
  },
};

const EN = {
  skip: 'Skip to content',
  'nav.materials': 'Materials',
  'nav.thread': 'Threads',
  'nav.article': 'Articles',
  'nav.privacy': 'Privacy',
  'nav.install': 'Install',
  'hero.h1': 'Turn a post into a card.',
  'hero.sub':
    'Twelve materials, four canvas shapes, fourteen interface languages. Typesetting and export happen on your own machine: no login, no upload, no X API.',
  'hero.meta':
    'Free and open source · GPL-3.0-or-later · Chrome / Edge (Manifest V3, Chrome 111 and later)',
  'cta.install': 'Install in your browser',
  'cta.install2': 'Install in your browser',
  'cta.source': 'Source and docs',
  'spec.pick': 'Pick a material',
  'facts.materials': 'materials',
  'facts.canvas': 'canvas shapes',
  'facts.locales': 'interface languages',
  'facts.export': 'Retina export',
  'thread.h2': 'Threads stitch themselves.',
  'thread.body':
    "Posts in one thread are joined by author and time, with ads and stray replies filtered out. Two ways in: X's own GraphQL cache first, then the rendered DOM when nothing is cached. Any post you would rather not show comes off with one click.",
  'thread.tick1': 'Consecutive posts by one author are joined; ads and third-party replies stay out',
  'thread.tick2': 'Long threads export at 2× by default, under the platform size ceiling',
  'thread.tick3': 'When a card would read too small in a feed, the panel says so before you export',
  'thread.cap': 'Three posts by one author, one of them quoting: the whole card as it exports.',
  'article.h2': 'Articles, quotes and image grids survive.',
  'article.lead':
    'An X Article brings out its cover and lead; a quoted post is filled or outlined to suit the material; one to four pictures keep their own proportions in the grid.',
  'article.lede': '“Not a filter — paper, rule and type at the right ratio.”',
  'article.s1t': 'Article',
  'article.s1': 'Cover, kicker, title and lead come through together.',
  'article.s2t': 'Quote',
  'article.s2': 'Filled or outlined, following the material.',
  'article.s3t': 'Pictures',
  'article.s3': 'One to four keep their own proportions instead of being cropped square.',
  'switch.h2': 'Eight switches, one panel.',
  'switch.lead':
    'Material, canvas, background, footer details, author blur and export resolution all live on this one panel; change one and the card follows.',
  'switch.panelCap': 'The panel itself, at true size.',
  'switch.cap1': 'All on',
  'switch.cap1b': 'QR, counts, time, credit.',
  'switch.cap2': 'Footer off',
  'switch.cap2b': 'The body alone.',
  'switch.cap3': 'Blurred',
  'switch.cap3b': 'Author and quoted author together.',
  'privacy.h2': 'It runs on your machine, end to end.',
  'privacy.body':
    "No account, no server, no telemetry. Typesetting happens inside an isolated Shadow DOM and the export is drawn by the browser's own canvas. Apart from fetching the pictures already in your card from X's image hosts, nothing leaves the machine.",
  'privacy.note':
    'It does not read your timeline, needs no X account and no X API. Not affiliated with X Corp.',
  'privacy.p1': 'Puts the finished image on your clipboard, only when you press Copy.',
  'privacy.p2': 'Remembers your material, canvas and switches; stored locally.',
  'privacy.p3': "Fetches the card's pictures. A canvas cannot read cross-origin images without it.",
  'install.h2': 'Three steps into your browser.',
  'install.lead':
    'Source install for now: build once with Node 24 and pnpm 10, and it lives in the action bar of every post.',
  'install.s1t': 'Build',
  'install.s1':
    'Clone the source, install and build. The output lands in <code>dist/</code>.',
  'install.s2t': 'Load',
  'install.s2':
    'Open <code>chrome://extensions</code>, turn on Developer mode, choose Load unpacked, and pick the <code>dist/</code> folder.',
  'install.s3t': 'Use',
  'install.s3': 'Press the card button on any post, or hover a post and hit <kbd>Alt</kbd> + <kbd>C</kbd>.',
  'install.note': 'Released under GPL-3.0-or-later: redistribute your changes under the same licence.',
  'install.cta': 'Open the repository',
  'faq.h2': 'Asked most',
  'faq.lead': 'Six real questions, answers on the right.',
  'faq.q1': 'Why not just screenshot?',
  'faq.a1':
    "A screenshot inherits your display's DPI and brings the browser's chrome with it. The card is laid out again in isolation to the material's own rules and rasterised at 3×, so the file is clean and stays sharp at feed width.",
  'faq.q2': 'Does a long card blur in the feed?',
  'faq.a2':
    'A single post exports at 3×. A very long thread defaults to 2× to stay under the size ceiling; when it would read too small, the panel warns and suggests splitting. A global 3× switch lives in the export settings.',
  'faq.q3': 'Do I need to log in or connect X?',
  'faq.a3':
    'No. There is no account system: it reads only what the page in front of you has already rendered, and never touches a credential.',
  'faq.q4': 'Is anything uploaded?',
  'faq.a4':
    'No. The image goes to your clipboard and your disk; closing the preview releases the rest. No post content is stored.',
  'faq.q5': 'Can I use it commercially?',
  'faq.a5':
    'The software is GPL-3.0-or-later and free to use commercially. The words and pictures inside a card still belong to their author; check before you redistribute.',
  'faq.q6': 'Which browsers can run it?',
  'faq.a6':
    'Chrome and Edge, from Chrome 111 (Manifest V3). Firefox and Safari are not supported yet: the extension is built on Chromium’s extension APIs.',
  'close.h2': 'Your next post deserves paper.',
  'close.sub': 'Install once, then it sits in the action bar of every post. Rendered locally, image on the clipboard.',
  'foot.readme': 'README',
  'foot.privacy': 'Privacy',
  'foot.license': 'Licence',
  'foot.credit':
    'Photographs inside the sample cards: letterpress posters by Amos Paul Kennedy Jr, photo by Michellecornelison (CC BY-SA 4.0); metal movable type, photo by Willi Heidelbach (CC BY 2.5), both via Wikimedia Commons. @postpress_demo and @typeset_demo are invented sample accounts; the names and posts are samples too.',
  'foot.gpl': 'GPL-3.0-or-later',
  'theme.minimal': 'Minimal',
  'theme.midnight': 'Midnight',
  'theme.glass': 'Liquid Glass',
  'theme.material': 'Material 3',
  'theme.gallery': 'Gallery',
  'theme.darkroom': 'Darkroom',
  'theme.riso': 'Riso',
  'theme.sumi': 'Sumi',
  'theme.clay': 'Clay',
  'theme.terminal': 'Terminal',
  'theme.receipt': 'Receipt',
  'theme.brutalist': 'Brutalist',
};

const TITLES = {
  zh: 'PostPress · 印推：把 X 推文排印成卡片',
  en: 'PostPress: typeset X posts into print-grade cards',
};

const DESCRIPTIONS = {
  zh: 'PostPress 把 X 的推文与同作者长串重新排印成 3× 高清卡片：十二套材质、四种画幅，纯本地渲染，不登录、不上传。',
  en: 'PostPress typesets X posts and same-author threads into 3× print-grade cards: twelve materials, four canvas shapes, rendered entirely on your machine.',
};

const root = document.documentElement;
root.classList.add('js');

/* -------------------------------------------------------------- 语言 */

const langButton = document.getElementById('lang');
const description = document.querySelector('meta[name="description"]');
const textNodes = [...document.querySelectorAll('[data-i18n]')];
const original = new Map(textNodes.map((el) => [el, el.innerHTML]));

let lang = 'zh';
try {
  if (localStorage.getItem('pp-lang') === 'en') lang = 'en';
} catch {
  /* 隐私模式下读不到存储，用默认语言 */
}

function applyLanguage(next) {
  lang = next;
  root.lang = next === 'en' ? 'en' : 'zh-CN';
  document.title = TITLES[next];
  if (description) description.setAttribute('content', DESCRIPTIONS[next]);

  for (const el of textNodes) {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = next === 'en' && EN[key] ? EN[key] : original.get(el);
  }

  langButton.textContent = next === 'en' ? '中文' : 'EN';
  langButton.setAttribute('aria-label', next === 'en' ? '切换到中文' : 'Switch to English');

  renderThemeLabel();
  renderCaption();
}

langButton.addEventListener('click', () => {
  const next = lang === 'en' ? 'zh' : 'en';
  try {
    localStorage.setItem('pp-lang', next);
  } catch {
    /* 存不下也不影响这次切换 */
  }
  applyLanguage(next);
});

/* ---------------------------------------------------------------- 主题 */

const themeButton = document.getElementById('theme');
const THEME_LABEL = {
  zh: { light: '浅色', dark: '深色' },
  en: { light: 'Light', dark: 'Dark' },
};

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function renderThemeLabel() {
  const target = currentTheme() === 'light' ? 'dark' : 'light';
  themeButton.textContent = THEME_LABEL[lang][target];
  themeButton.setAttribute(
    'aria-label',
    lang === 'en'
      ? `Switch to the ${target} version`
      : `切换到${target === 'light' ? '浅色' : '深色'}版`
  );
}

function setTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('pp-theme', theme);
  } catch {
    /* 存不下也不影响这次切换 */
  }
  renderThemeLabel();
  syncMaterialToTheme();
}

themeButton.addEventListener('click', () => {
  setTheme(currentTheme() === 'light' ? 'dark' : 'light');
});

/* ------------------------------------------------------------ 材质样张 */

const specimenImg = document.getElementById('specimen-img');
const capName = document.getElementById('cap-name');
const capNote = document.getElementById('cap-note');
const capTokens = document.querySelector('.cap-tokens');
const materialButtons = [...document.querySelectorAll('.material')];
// 页面下方的长串、长文与三种页脚状态也跟着材质换，别只换顶上那一张。
const followingCards = [...document.querySelectorAll('[data-card]')];

let material = currentTheme() === 'light' ? 'minimal' : 'midnight';
let pickedManually = false;

function showMaterial(id) {
  material = id;
  specimenImg.src = `./assets/cards/${id}.webp`;
  for (const img of followingCards) img.src = `./assets/cards/${img.dataset.card}-${id}.webp`;
  renderCaption();
}

/** 没手动挑过时，默认材质跟着皮走：深色给夜幕，浅色给极简。 */
function syncMaterialToTheme() {
  if (pickedManually) return;
  showMaterial(currentTheme() === 'light' ? 'minimal' : 'midnight');
}

function renderCaption() {
  const m = MATERIALS[material];
  if (!m) return;
  capName.textContent = m[lang === 'en' ? 'en' : 'zh'];
  capNote.textContent = m[lang === 'en' ? 'enNote' : 'zhNote'];
  capTokens.innerHTML = [m.surface, m.ink, m.accent]
    .map((c) => `<i style="background:${c}"></i>`)
    .join('');
  specimenImg.alt =
    lang === 'en'
      ? `${m.en} material: one post with a quoted post, rendered as a card.`
      : `${m.zh}材质的卡片：一条推文，正文下方引用另一条推文。`;

  for (const button of materialButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.material === material));
  }
}

for (const button of materialButtons) {
  button.addEventListener('click', () => {
    const id = button.dataset.material;
    if (!id || id === material) return;
    pickedManually = true;
    showMaterial(id);
  });
}

/* ---------------------------------------------------------------- 动效 */

const ENTER_SELECTORS = [
  '.hero-copy > *',
  '.studio',
  '.close-line',
  '.close-foot',
  '.sec-head > *',
  '.facts',
  '.thread-text > *',
  '.thread-figure',
  '.article-figure',
  '.article-lead',
  '.article-lede',
  '.article-points > li',
  '.panel-shot',
  '.switch-list > figure',
  '.privacy-text > *',
  '.perms > li',
  '.steps > li',
  '.install-code pre',
  '.install-side',
  '.faq-row',
];

const enters = [];
for (const section of document.querySelectorAll('.hero, .sec, .close')) {
  const parts = new Set();
  for (const selector of ENTER_SELECTORS) {
    for (const el of section.querySelectorAll(selector)) parts.add(el);
  }
  const ordered = [...parts].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
  ordered.forEach((el, i) => {
    el.setAttribute('data-enter', '');
    el.style.transitionDelay = `${Math.min(i * 70, 350)}ms`;
    enters.push(el);
  });
}

/**
 * Scroll 事件驱动，而不是 IntersectionObserver：后者在后台标签页里会被推迟投递，
 * 页面看着完成、实际每一块都还停在起始状态。这里只读几何，代价是每帧一次 rect。
 */
function reveal() {
  const limit = window.innerHeight * 0.92;
  for (const el of enters) {
    if (el.classList.contains('is-in')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top < limit && rect.bottom > 0) el.classList.add('is-in');
  }
}

window.addEventListener('scroll', reveal, { passive: true });
window.addEventListener('resize', reveal, { passive: true });
reveal();

// A tab that opens in the background delivers no scroll events and no frames, so
// the first reveal is also polled. It stops as soon as every block has arrived.
const poll = setInterval(() => {
  reveal();
  if (enters.every((el) => el.classList.contains('is-in'))) clearInterval(poll);
}, 250);

applyLanguage(lang);
showMaterial(material);
