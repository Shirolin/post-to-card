# Chrome Web Store 上架文案

商店后台的字段与 `manifest.json` 的 `name` / `description` 是**两份独立存储**：改这里不会自动更新商店页，改 `public/_locales/` 也不会同步到商店后台。

目前 `manifest.json` 的 `name` 与 `description` 已通过 `__MSG_extTitle__` 与 `__MSG_extDesc__` 接入 14 国语言目录（`public/_locales/<locale>/messages.json`），其中 `en_US` 与 `zh_CN` 的文案与下方「名称」「简短说明」完全一致。调整简短说明时请同步更新对应的 `messages.json`。

## 名称

```
PostPress · 印推
```
*(英文主名称：`PostPress — X & Thread Card Studio`)*

## 简短说明（manifest `description`，上限 132 字符）

英文（124 字符，在上限以内）：

```
Press X posts and threads into print-grade cards. 12 tactile themes, custom canvas mats, 100% local rendering, zero uploads.
```

中文（46 字符）：

```
把 X 推文与长串装帧成出版级高清卡片。12 款纸张肌理与自由画幅，纯本地排印，零数据上传。
```

## 详细说明

### 英文 (en-US)

```
PostPress — Press X posts and threads into publication-grade cards.

Stop sharing cluttered, low-DPI browser screenshots. Click the press icon on any post (or press Alt + C), and PostPress typesets single posts or multi-post threads into crisp, print-grade cards—ready to copy to your clipboard or export as 3× Retina PNGs.

WHAT YOU GET:

• 12 Tactile & Digital Themes — Minimal, Midnight, Liquid Glass, Material 3, Gallery, Darkroom, Riso, Sumi, Clay, Terminal, Receipt, plus an experimental Brutalist. Each is a complete design system: paper grain, border rules, typographic pairs, accents, and signature marks.
• Output Canvas & Matting — Frame the card on a standalone canvas layer. Aspect ratios: 1:1, 4:5, 3:4, 16:9 (elastic min-height; long text never truncates). Backdrops: follow theme, solid color, gradient, or transparent margin.
• Smart Thread Stitching — Dual-pipeline resolution (GraphQL with DOM fallback) seamlessly merges consecutive posts by the same author while stripping out ads and third-party replies. Exclude individual posts with one click.
• Articles & Quoted Posts — Natively parses X Articles with cover images, kickers, titles, and ledes; quoted posts render in filled or outlined styles matching the active theme.
• Granular Controls & Per-Author Privacy — Toggle QR code, engagement metrics, timestamp, credit & build number, and video play badge. Blur all authors globally, or click any post's avatar in the preview to anonymize just that author.
• 14 Languages & Readability Guard — Localized into 14 languages (following your browser or pinned manually). Alerts you before export if a tall card would shrink below reading size in social feeds.

PRIVACY:

• Zero Telemetry: Never transmits user data. The only network requests fetch post media from X's official CDN (*.twimg.com) so HTML5 Canvas can render images without cross-origin errors.
• 100% Local: No account, no API keys, and no backend servers. Everything renders right in your browser.
• Local Storage Only: Custom preferences live purely in chrome.storage.local.
• Minimal Permissions: clipboardWrite (to copy the rendered PNG), storage (to remember your settings), and host access to X's image servers.

Requires no login and no X API access — it reads the posts already rendered on the page you are viewing.

Not affiliated with X Corp.
```

### 简体中文 (zh-CN)

```
PostPress · 印推 —— 把 X（Twitter）推文与长串，排印成出版级质感卡片。

告别夹带杂乱界面与模糊缩放的普通截屏。轻点推文操作栏的印刷机图标（或悬停按 Alt + C），PostPress（印推）即刻在本地将单条推文或同作者长串（Thread）重新组版，装帧为可一键复制或导出 3× 超清 PNG 的精美卡片。

功能亮点：

• 12 款实体质感与数字主题 —— 极简、夜幕、液态玻璃、质感 (MD3)、画廊、暗房、孔版、水墨、软陶、终端、小票，以及实验性的粗野派。每款主题都是一套完整的设计规范：纸张肌理、分栏线、字体配对、强调色与专属印记。
• 输出画布与装裱衬底 —— 支持将卡片置于独立背景层上导出。提供 1:1、4:5、3:4、16:9 预设画幅（弹性最小高度，长文绝不截断）；背景可选跟随主题、纯色、渐变或透明留白，方便二次排版。
• 智能长串拼合 —— 双通道解析（GraphQL 优先，DOM 兜底），自动识别并串联同作者连续推文，过滤广告与无关回复，并支持单条一键剔除。
• 原生长文与引用排版 —— 原生解析 X 长文（Article）的封面、眉题、标题与导语；引用推文随主题切换填充或描边样式；完整还原高清多图网格与表情符号。
• 呈现细节与逐条隐私脱敏 —— 独立开关原文二维码、互动数据、发布时间、署名与版本及视频播放角标。支持全局模糊所有作者，也可在预览中点击单条推文头像，仅隐去该作者信息。
• 14 种语言与可读性提醒 —— 界面与卡面日期支持 14 种语言（可跟随浏览器或手动指定）。当长图过高、在信息流中缩略后文字可能过小时，导出前会自动提示拆分。

隐私保障：

• 零遥测与追踪：绝不上传任何用户数据。唯一的网络请求仅用于从 X 官方图床（*.twimg.com）加载配图，以规避浏览器 Canvas 跨域导出限制。
• 100% 本地渲染：无需注册登录，无需 API 密钥，无后端服务器。
• 纯本地存储：排版偏好仅保存在浏览器本地 chrome.storage.local。
• 最小化权限：仅申请 clipboardWrite（复制图片到剪贴板）、storage（记住排版设置）与 X 官方图床读取权限。

无需登录账号，无需 X API —— 直接读取当前页面已加载的内容。

与 X Corp. 无关联。
```

## 单项权限理由（商店后台填写）

| 权限 | 理由（英文） |
|---|---|
| `clipboardWrite` | Puts the rendered PNG on the clipboard so you can paste it into a post or a chat. Used only when you press Copy. |
| `storage` | Remembers your theme, canvas and toggle choices between sessions. Stored locally; never transmitted. |
| `https://*.twimg.com/*` | Fetches the pictures that belong in the card. A canvas cannot read a cross-origin image, so the export would fail without this; requests go only to X's own image hosts. |

## 语言

商店后台的「详细说明」按所添加的商店展示语种分别粘贴；而扩展安装后在 `chrome://extensions` 与工具栏显示的 `name` / `description` 则由 `public/_locales/` 下的 14 个语种目录自动决定（见 `docs/i18n.md`）。

---

## 各语种详细说明

后台切到对应语种后整段粘贴。名称与简短说明不在下表里：它们直接来自安装包的 `_locales/`，切语种时自动变。
主题名按 `src/content/locales/<locale>.ts` 里 `theme_*` 的既有译法，不要另起一套。

### 德语 (de)

```
PostPress — X-Posts und Threads als druckreife Karten gestalten.

Schluss mit überladenen, unscharfen Browser-Screenshots. Ein Klick auf das Druckersymbol unter einem Post (oder Alt + C beim Überfahren mit der Maus), und PostPress setzt einzelne Posts oder mehrteilige Threads desselben Verfassers zu gestochen scharfen Karten — direkt in die Zwischenablage oder als 3×-Retina-PNG.

FUNKTIONEN IM ÜBERBLICK:

• 12 charakterstarke Designs — Minimal, Mitternacht, Liquid Glass, Material 3, Galerie, Dunkelkammer, Riso, Sumi, Ton, Terminal, Kassenbon sowie ein experimentelles Brutalistisch. Jedes Design ist ein stimmiges System aus Papierkorn, Linienführung, Schriftpaarung, Akzentfarbe und Signatur.
• Ausgabefläche & Passepartout — Platziere die Karte auf einem eigenen Hintergrundrahmen im Format 1:1, 4:5, 3:4 oder 16:9 (mit flexibler Mindesthöhe, damit lange Texte nie abgeschnitten werden). Wahlweise im Stil des Designs, einfarbig, mit Verlauf oder transparentem Rand.
• Intelligente Thread-Bündelung — Zweistufige Erkennung (GraphQL mit DOM-Fallback) fasst aufeinanderfolgende Posts desselben Verfassers nahtlos zusammen und blendet Werbung sowie fremde Antworten aus. Einzelne Posts lassen sich per Klick ausschließen.
• X-Artikel & Zitate — Übernimmt X-Artikel nativ mit Titelbild, Dachzeile, Überschrift und Vorspann; zitierte Posts werden passend zum Design gefüllt oder konturiert dargestellt.
• Feine Steuerung & Datenschutz pro Verfasser — QR-Code, Interaktionen, Zeitpunkt, Quelle & Build sowie Video-Play-Button einzeln ein- und ausblendbar. Verwische alle Verfasser global oder klicke in der Vorschau auf ein Profilbild, um nur diesen einen Account zu anonymisieren.
• 14 Sprachen & Lesbarkeits-Hinweis — Oberfläche und Datumsformat in 14 Sprachen (automatisch nach Browser oder fest gewählt). Warnt vor dem Export, wenn ein sehr langer Thread im Feed zu stark verkleinert würde.

DATENSCHUTZ:

• Null Telemetrie: Es werden keinerlei Nutzerdaten erhoben oder versendet. Netzwerkabrufe erfolgen ausschließlich zum offiziellen X-CDN (*.twimg.com), um Beitragsbilder ohne Canvas-CORS-Blockade zu rendern.
• 100 % lokal: Kein Konto, kein API-Schlüssel, keine externen Server — alles entsteht direkt im Browser.
• Lokale Speicherung: Deine Einstellungen liegen ausschließlich in chrome.storage.local.
• Minimale Berechtigungen: clipboardWrite (Kartenbild kopieren), storage (Einstellungen merken) und Lesezugriff auf die Bildserver von X.

Kein Login und kein X-API-Zugang erforderlich — verarbeitet wird nur, was bereits auf der geöffneten Seite sichtbar ist.

Steht in keiner Verbindung zu X Corp.
```

### 俄语 (ru)

```
PostPress — превращайте посты и треды X в карточки типографского качества.

Забудьте о перегруженных и мыльных скриншотах из браузера. Нажмите на значок печатного пресса под любым постом (или сочетание Alt + C при наведении) — PostPress мгновенно сверстает отдельный пост или авторский тред в чёткую карточку. Копируйте её в буфер обмена в один клик или сохраняйте в PNG 3× Retina.

ВОЗМОЖНОСТИ:

• 12 фактурных и цифровых тем — Минимализм, Полночь, Жидкое стекло, Material 3, Галерея, Фотолаборатория, Ризограф, Суми, Глина, Терминал, Чек и экспериментальный Брутализм. Каждая тема продумана до мелочей: текстура бумаги, линейки, шрифтовые пары, акценты и фирменное клеймо.
• Область экспорта и паспарту — размещайте карточку на подложке формата 1:1, 4:5, 3:4 или 16:9 (высота тянется под текст без обрезки). Доступны фон в тон темы, сплошной цвет, градиент или прозрачные поля.
• Умная сборка тредов — двухконтурный парсер (GraphQL с резервным чтением DOM) аккуратно склеивает цепочку постов одного автора, отсекая рекламу и чужие реплаи. Лишние посты в треде можно исключить одним кликом.
• Статьи X и цитаты — нативная поддержка лонгридов X (обложка, рубрика, заголовок и лид) и аккуратное оформление цитируемых постов (с заливкой или в рамке под стать выбранной теме).
• Детали отображения и приватность по авторам — гибкое управление QR-кодом, статистикой, датой, строкой «Авторство и сборка» и кнопкой воспроизведения на видео. Скрывайте всех авторов сразу или кликните по конкретному аватару в превью, чтобы размыть только его.
• 14 языков и контроль читаемости — локализация интерфейса и дат на 14 языках (автоматически за браузером или вручную). Подскажет перед экспортом, если карточка получилась слишком высокой и текст станет мелким в ленте.

ПРИВАТНОСТЬ:

• Ноль телеметрии: расширение не собирает и никуда не отправляет данные. Единственные сетевые обращения идут к официальному CDN X (*.twimg.com) для загрузки медиафайлов поста в обход ограничений CORS для HTML5 Canvas.
• 100 % локально: без регистрации, API-ключей и внешних серверов — рендеринг целиком происходит в вашем браузере.
• Хранение на устройстве: все настройки сохраняются только локально в chrome.storage.local.
• Минимум разрешений: clipboardWrite (копирование картинки в буфер), storage (сохранение настроек) и доступ к серверам изображений X.

Не требует авторизации или доступа к API X — работает прямо с открытой веб-страницей.

Не связано с корпорацией X Corp.
```

### 法语 (fr)

```
PostPress — Transformez vos posts et threads X en cartes de qualité éditoriale.

Oubliez les captures d’écran floues et encombrées par l’interface du navigateur. Cliquez sur l’icône de presse sous n’importe quel post (ou appuyez sur Alt + C au survol) : PostPress met en page un post isolé ou le fil complet d’un auteur en une carte impeccable, prête à être copiée dans le presse-papiers ou téléchargée en PNG 3× Retina.

FONCTIONNALITÉS CLÉS :

• 12 thèmes texturés et numériques — Minimal, Minuit, Verre liquide, Material 3, Galerie, Chambre noire, Riso, Sumi, Argile, Terminal, Ticket, ainsi qu’un thème Brutaliste expérimental. Chaque thème forme un véritable système éditorial : grain de papier, filets, duo typographique, couleurs d’accent et marque de signature.
• Zone d’export et passe-partout — Encadrez la carte sur un fond dédié aux formats 1:1, 4:5, 3:4 ou 16:9 (hauteur minimale extensible : les textes longs ne sont jamais tronqués). Choisissez un fond assorti au thème, uni, dégradé ou à marge transparente.
• Assemblage intelligent des threads — Double moteur d’extraction (GraphQL avec repli DOM) qui réunit automatiquement les posts consécutifs d’un même auteur tout en écartant publicités et réponses tierces. Retirez n’importe quel post du fil en un clic.
• Articles X et citations enrichies — Prise en charge native des Articles X (image de couverture, surtitre, titre et chapô) ; rendu des posts cités en aplat ou en contour selon le thème actif.
• Détails d’affichage et anonymisation ciblée — Activez à la carte le QR code, les statistiques, la date, la mention « Crédit et build » ou le bouton lecture vidéo. Floutez tous les auteurs globalement, ou cliquez sur un avatar dans l’aperçu pour n’anonymiser que ce compte.
• 14 langues et alerte de lisibilité — Interface et format de date traduits en 14 langues (selon le navigateur ou au choix). Un avertissement s’affiche si un fil très haut risque de paraître minuscule dans un fil d’actualité.

CONFIDENTIALITÉ :

• Zéro télémétrie : aucune donnée personnelle n’est collectée ni transmise. Les seules requêtes réseau chargent les images du post depuis le CDN officiel de X (*.twimg.com) afin d’autoriser le rendu HTML5 Canvas sans blocage CORS.
• 100 % local : ni compte, ni clé API, ni serveur distant — tout est généré directement dans votre navigateur.
• Stockage strictement local : vos préférences sont enregistrées uniquement dans chrome.storage.local.
• Autorisations minimales : clipboardWrite (copie de l’image), storage (mémorisation des réglages) et accès aux serveurs d’images de X.

Fonctionne sans connexion ni accès à l’API X — à partir du contenu déjà affiché sur votre page.

Non affilié à X Corp.
```

### 韩语 (ko)

```
PostPress · 트윗판화 — X(트위터) 게시물과 스레드를 출판 품질의 카드로 조판하세요.

복잡한 브라우저 UI가 섞이거나 흐릿하게 깨지는 일반 스크린샷은 이제 그만. 게시물 하단 작업 표시줄의 프레스 아이콘을 클릭하거나(또는 마우스를 올린 채 Alt + C), 단일 게시물과 같은 작성자의 연속 스레드를 깔끔한 카드로 즉시 조판해 보세요. 클립보드로 바로 복사하거나 3× Retina 고해상도 PNG로 저장할 수 있습니다.

주요 기능:

• 12가지 감각적인 질감 및 디지털 테마 — 미니멀, 미드나이트, 리퀴드 글라스, 머티리얼 (MD3), 갤러리, 암실, 리소, 수묵, 클레이, 터미널, 영수증, 그리고 실험적인 브루탈리즘까지. 종이 질감, 구분선, 서체 조합, 강조색, 시그니처 마크가 정교하게 맞물린 12종의 디자인 시스템을 제공합니다.
• 출력 캔버스 및 매트(Mat) 액자 — 카드를 독립된 배경 캔버스 위에 얹어 내보낼 수 있습니다. 1:1, 4:5, 3:4, 16:9 비율(긴 글도 절대 잘리지 않는 가변 최소 높이 적용)과 테마 연동·단색·그라데이션·투명 여백 배경을 자유롭게 조합하세요.
• 스마트 스레드 자동 병합 — 이중 파싱 파이프라인(GraphQL 우선, DOM 폴백)으로 같은 작성자의 이어지는 게시물을 정확히 묶어 주고 중간 광고나 타인의 답글은 깔끔하게 걸러냅니다. 원치 않는 게시물은 클릭 한 번으로 제외할 수 있습니다.
• 장문 아티클 및 인용구 완벽 지원 — X 장문(Article)의 표지 이미지, 말머리, 제목, 도입부를 원본 구조 그대로 추출하며, 인용 게시물도 선택한 테마에 맞춰 채움 또는 윤곽선 스타일로 자연스럽게 렌더링합니다.
• 표시 세부 설정 및 작성자 개별 블러 — 원문 QR 코드, 참여 지표, 작성 시각, 출처와 버전, 동영상 재생 버튼을 개별 스위치로 제어하세요. 모든 작성자를 한꺼번에 블러 처리하거나, 미리보기에서 특정 프로필 사진만 클릭해 해당 작성자만 익명화할 수도 있습니다.
• 14개 언어 지원 및 가독성 알림 — 인터페이스와 카드 날짜 표기를 14개 언어로 지원합니다(브라우저 언어 자동 연동 또는 직접 지정). 스레드가 너무 길어 타임라인에서 글자가 지나치게 작아질 우려가 있으면 내보내기 전에 미리 분할을 권장합니다.

개인정보 보호:

• 원격 데이터 수집 제로: 사용자의 어떠한 데이터도 외부로 전송하지 않습니다. 유일한 네트워크 요청은 HTML5 캔버스의 교차 출처(CORS) 오염을 방지하기 위해 X 공식 이미지 서버(*.twimg.com)에서 게시물 원본 이미지를 불러올 때만 발생합니다.
• 100% 로컬 렌더링: 별도 계정 가입도, API 키도, 외부 서버도 없이 모든 카드 생성이 브라우저 내부에서 이루어집니다.
• 로컬 전용 저장소: 사용자의 레이아웃 및 테마 설정은 오직 브라우저 내부(chrome.storage.local)에만 보관됩니다.
• 최소 권한 원칙: clipboardWrite(클립보드에 이미지 복사), storage(사용자 설정 저장), X 이미지 서버 접근 권한만 요청합니다.

로그인이나 X API 연동 없이 현재 화면에 표시된 게시물 데이터를 그대로 읽어 동작합니다.

X Corp.와 무관한 독립 확장 프로그램입니다.
```

### 日语 (ja)

```
PostPress · 推刷 — X（旧Twitter）のポストやスレッドを、出版品質のカードに組版。

余計なUIが写り込んだり、縮小で文字がぼやけたりするスクリーンショットはもう不要です。ポスト下部のアクションバーにあるプレス機アイコンをクリック（またはカーソルを合わせて Alt + C）するだけで、単体ポストや同一投稿者の連続スレッドを瞬時に美しいカードへと再組版。ワンクリックでクリップボードにコピー、または 3× Retina 高解像度 PNG として保存できます。

主な機能:

• 12種類の質感・デジタルテーマ — ミニマル、ミッドナイト、リキッドグラス、マテリアル (MD3)、ギャラリー、暗室、リソ、墨絵、クレイ、ターミナル、レシート、さらに実験的なブルータリズムを収録。紙の風合い、罫線、フォントペアリング、アクセントカラー、シグネチャー装飾まで作り込まれたデザインシステムです。
• 出力キャンバスとマット装丁 — カードの背面に独立した背景キャンバスを敷いて書き出せます。アスペクト比は 1:1、4:5、3:4、16:9 に対応（長文でも途切れない可変最小高さ）。背景はテーマ連動・単色・グラデーション・透明余白から選べます。
• スマートなスレッド自動連結 — デュアル解析エンジン（GraphQL 優先＋DOM フォールバック）により、同じ投稿者の連投を自動的につなぎ合わせ、広告や他ユーザーの返信をきれいに除外。不要なポストは個別にワンクリックで外せます。
• X 長文記事と引用ポストの最適化 — X の長文記事（Article）のカバー画像・肩書き・タイトル・リード文をネイティブに抽出。引用ポストもテーマに合わせて塗りつぶしや枠線スタイルで端正に描画します。
• 細やかな表示切り替えと投稿者別の匿名化 — 元ポストの QR コード、エンゲージメント数、投稿日時、クレジットとバージョン、動画の再生ボタンを個別にオン／オフ可能。全投稿者の一括ぼかしはもちろん、プレビュー上のアイコンをクリックして特定の投稿者だけを匿名化することもできます。
• 14言語対応＆可読性アラート — UI とカード上の日付表記は 14 言語に対応（ブラウザ連動または手動固定）。スレッドが縦に長すぎてタイムライン上で文字が潰れそうな場合は、書き出し前に分割を提案します。

プライバシー保護:

• 外部送信・テレメトリ一切なし: ユーザーデータの収集や外部送信は一切行いません。通信が発生するのは、HTML5 Canvas の CORS 制限を回避するために X 公式画像サーバー（*.twimg.com）からポストの画像を読み込む際のみです。
• 100% ローカル処理: アカウント登録、API キー、外部サーバーはすべて不要。ブラウザ内だけで完結します。
• ローカルストレージのみ使用: お好みの設定はブラウザ内の chrome.storage.local にのみ保存されます。
• 最小限の権限: clipboardWrite（画像のコピー）、storage（設定の保存）、および X 画像サーバーへのアクセス権限のみを使用します。

ログインや X API の連携は不要 — 現在開いているページに描画されている内容をそのまま読み取ります。

X Corp. とは一切関係ありません。
```

### 土耳其语 (tr)

```
PostPress — X gönderilerini ve dizilerini baskı kalitesinde kartlara dönüştürün.

Karmaşık arayüz öğeleriyle dolu, bulanık ekran görüntülerine veda edin. Herhangi bir gönderinin altındaki baskı simgesine tıklayın (veya fareyle üzerine gelip Alt + C tuşlarına basın); PostPress tekil gönderileri ya da aynı yazarın arka arkaya paylaştığı dizileri (thread) anında net ve şık kartlara dönüştürsün. Tek tıkla panoya kopyalayın veya 3× Retina PNG olarak indirin.

ÖNE ÇIKAN ÖZELLİKLER:

• 12 Dokulu ve Dijital Tema — Minimal, Gece yarısı, Sıvı cam, Material 3, Galeri, Karanlık oda, Riso, Sumi, Kil, Terminal, Fiş ve deneysel Brütalist. Her tema; kâğıt dokusu, cetvel çizgileri, yazı tipi eşleşmeleri, vurgu renkleri ve özel imza mührüyle eksiksiz bir tasarım sistemidir.
• Çıktı Alanı ve Paspartu Çerçeve — Kartınızı 1:1, 4:5, 3:4 veya 16:9 oranlarında bağımsız bir arka plan katmanına yerleştirin (esnek minimum yükseklik sayesinde uzun metinler asla kesilmez). Temayla uyumlu, düz renk, gradyan veya saydam kenar boşluğu seçenekleriyle dışa aktarın.
• Akıllı Dizi (Thread) Birleştirme — Çift kanallı çözümleme (GraphQL öncelikli, DOM yedekli) aynı yazarın ardışık gönderilerini kusursuzca birbirine bağlar; araya giren reklamları ve üçüncü taraf yanıtlarını otomatik temizler. İstenmeyen gönderileri tek tıkla hariç tutabilirsiniz.
• X Makaleleri ve Zengin Alıntılar — X Makalelerini kapak görseli, üst başlık, ana başlık ve giriş metniyle doğal olarak işler; alıntılanan gönderileri seçili temaya göre dolgulu veya çerçeveli stilde çizer.
• Görünüm Ayrıntıları ve Yazar Bazlı Gizlilik — QR kodu, etkileşim sayıları, tarih, kaynak ve derleme bilgisi ile video oynat düğmesini ayrı ayrı açıp kapatın. Tüm yazarları tek seferde bulanıklaştırın ya da önizlemede yalnızca belirli bir avatara tıklayarak o hesabı gizleyin.
• 14 Dil Desteği ve Okunabilirlik Uyarısı — Arayüz ve kart tarihi 14 dili destekler (tarayıcı dilini izler veya elle seçilir). Çok uzun bir kart sosyal medya akışında okunamayacak kadar küçülecekse dışa aktarmadan önce sizi uyarır.

GİZLİLİK:

• Sıfır Telemetri: Hiçbir kullanıcı verisi toplanmaz veya dışarı aktarılmaz. Tek ağ isteği, HTML5 Canvas CORS kısıtlamasını aşmak için gönderi görsellerini X'in resmî CDN sunucularından (*.twimg.com) çekmek amacıyla yapılır.
• %100 Yerel İşleme: Hesap, API anahtarı veya uzak sunucu gerekmez; her şey doğrudan tarayıcınızda oluşturulur.
• Yalnızca Yerel Depolama: Tercihleriniz yalnızca cihazınızdaki chrome.storage.local alanında tutulur.
• Minimum İzinler: Yalnızca clipboardWrite (görseli panoya kopyalamak için), storage (ayarları kaydetmek için) ve X görsel sunucusu erişimi istenir.

Oturum açma veya X API erişimi gerektirmez — doğrudan sayfada görüntülenen içeriği okur.

X Corp. ile hiçbir bağlantısı yoktur.
```

### 乌克兰语 (uk)

```
PostPress — перетворюйте пости й треди X на картки типографської якості.

Забудьте про захаращені інтерфейсом і розмиті скриншоти з браузера. Натисніть значок друкарського преса під будь-яким постом (або Alt + C при наведенні курсора) — і PostPress миттєво зверстає окремий пост чи авторський тред у чітку картку. Копіюйте її до буфера обміну одним кліком або зберігайте у форматі PNG 3× Retina.

МОЖЛИВОСТІ:

• 12 фактурних і цифрових тем — Мінімалізм, Опівніч, Рідке скло, Material 3, Галерея, Фотолабораторія, Ризограф, Сумі, Глина, Термінал, Чек та експериментальний Бруталізм. Кожна тема — це цілісна дизайн-система з текстурою паперу, лінійками, шрифтовими парами, акцентами й фірмовою позначкою.
• Область експорту та паспарту — розміщуйте картку на окремому фоновому шарі з пропорціями 1:1, 4:5, 3:4 або 16:9 (завдяки гнучкій мінімальній висоті довгий текст ніколи не обрізається). Обирайте тло в тон теми, суцільний колір, градієнт або прозорі поля.
• Розумне зшивання тредів — двоканальний аналізатор (GraphQL із резервним читанням DOM) автоматично збирає послідовні пости одного автора, відсікаючи рекламу та сторонні відповіді. Будь-який пост можна виключити з картки одним кліком.
• Статті X і цитати — нативна підтримка лонгрідів X (обкладинка, надзаголовок, заголовок і лід) та охайне оформлення цитованих постів (із заливкою або контуром відповідно до обраної теми).
• Деталі вигляду та приватність за авторами — окремі перемикачі для QR-коду, статистики, дати, рядка «Авторство і збірка» та кнопки відтворення на відео. Розмивайте всіх авторів глобально або клікніть на окремий аватар у прев’ю, щоб приховати лише цей акаунт.
• 14 мов і контроль читабельності — інтерфейс і дати на картці доступні 14 мовами (автоматично за браузером або вручну). Якщо занадто довга картка стане дрібною у стрічці соцмереж, розширення попередить про це перед експортом.

ПРИВАТНІСТЬ:

• Жодної телеметрії: жодні дані користувача не збираються й нікуди не передаються. Єдині мережеві запити завантажують медіафайли поста з офіційного CDN X (*.twimg.com), щоб уникнути блокування CORS під час рендерингу HTML5 Canvas.
• 100 % локально: без облікового запису, ключів API чи сторонніх серверів — усе генерується безпосередньо у вашому браузері.
• Лише локальне сховище: ваші налаштування зберігаються виключно в chrome.storage.local.
• Мінімум дозволів: clipboardWrite (копіювання зображення до буфера), storage (збереження налаштувань) і доступ до серверів зображень X.

Не потребує входу в акаунт чи доступу до API X — працює з контентом, який уже відображено на сторінці.

Не пов’язано з X Corp.
```

### 西班牙语 (es)

```
PostPress — Convierte posts e hilos de X en tarjetas con acabado editorial.

Olvídate de las capturas de pantalla borrosas y llenas de elementos del navegador. Haz clic en el icono de prensa bajo cualquier post (o pulsa Alt + C al pasar el cursor) y PostPress maquetará al instante un post suelto o el hilo completo de un autor en una tarjeta nítida, lista para copiar al portapapeles o descargar en PNG 3× Retina.

QUÉ INCLUYE:

• 12 temas con textura y digitales — Minimal, Medianoche, Cristal líquido, Material 3, Galería, Cuarto oscuro, Riso, Sumi, Arcilla, Terminal, Recibo y un tema Brutalista experimental. Cada uno es un sistema de diseño completo: grano de papel, filetes, combinación tipográfica, color de acento y sello propio.
• Lienzo de salida y paspartú — Enmarca la tarjeta sobre un fondo independiente en formato 1:1, 4:5, 3:4 o 16:9 (con altura mínima flexible para que los textos largos nunca se corten). Elige fondo según el tema, color sólido, degradado o margen transparente.
• Unión inteligente de hilos — Doble vía de análisis (GraphQL con respaldo DOM) que enlaza automáticamente los posts consecutivos de un mismo autor y filtra anuncios o respuestas de terceros. Excluye cualquier post con un solo clic.
• Artículos de X y citas enriquecidas — Extrae de forma nativa los Artículos de X con portada, antetítulo, titular y entradilla; presenta los posts citados con relleno o contorno a juego con el tema.
• Detalles de presentación y privacidad por autor — Activa o desactiva por separado el código QR, las métricas, la fecha, la línea «Crédito y compilación» y el botón de reproducción en vídeos. Difumina a todos los autores a la vez o haz clic en un avatar en la vista previa para anonimizar solo esa cuenta.
• 14 idiomas y aviso de legibilidad — Interfaz y fechas de la tarjeta en 14 idiomas (según el navegador o fijados manualmente). Te avisa antes de exportar si un hilo demasiado alto se vería diminuto en el feed.

PRIVACIDAD:

• Cero telemetría: no recopila ni envía datos de usuario. Las únicas peticiones de red descargan las imágenes del post desde el CDN oficial de X (*.twimg.com) para permitir el renderizado en HTML5 Canvas sin errores de CORS.
• 100 % local: sin cuentas, sin claves de API y sin servidores externos; todo se genera en tu propio navegador.
• Almacenamiento exclusivamente local: tus ajustes se guardan únicamente en chrome.storage.local.
• Permisos mínimos: clipboardWrite (copiar la imagen al portapapeles), storage (recordar tus preferencias) y acceso a los servidores de imágenes de X.

Sin iniciar sesión ni usar la API de X: lee directamente lo que ya se muestra en la página.

No afiliado a X Corp.
```

### 意大利语 (it)

```
PostPress — Trasforma i post e i thread di X in card di qualità editoriale.

Basta screenshot sfocati e pieni di elementi dell’interfaccia. Clicca sull’icona del torchio tipografico sotto qualsiasi post (oppure premi Alt + C passando il cursore) e PostPress impaginerà all’istante un singolo post o l’intero thread di un autore in una card nitida, pronta da copiare negli appunti o scaricare come PNG 3× Retina.

CARATTERISTICHE PRINCIPALI:

• 12 temi materici e digitali — Minimal, Mezzanotte, Vetro liquido, Material 3, Galleria, Camera oscura, Riso, Sumi, Argilla, Terminale, Scontrino e un Brutalista sperimentale. Ogni tema è un sistema grafico completo di grana della carta, filetti, accoppiamenti tipografici, colori d’accento e marchio distintivo.
• Area di esportazione e passe-partout — Incornicia la card su uno sfondo dedicato nei formati 1:1, 4:5, 3:4 o 16:9 (con altezza minima flessibile: i testi lunghi non vengono mai tagliati). Scegli tra sfondo abbinato al tema, tinta unita, sfumatura o margine trasparente.
• Unione intelligente dei thread — Doppio motore di lettura (GraphQL con fallback sul DOM) che concatena automaticamente i post consecutivi dello stesso autore, scartando inserzioni e risposte di terzi. Puoi escludere qualsiasi post con un clic.
• Articoli di X e citazioni — Interpreta nativamente gli Articoli di X completi di immagine di copertina, occhiello, titolo e sommario; disegna i post citati con riempimento o contorno in armonia con il tema.
• Dettagli di presentazione e privacy per autore — Controlla singolarmente codice QR, metriche, data, dicitura «Credito e build» e pulsante play video. Sfoca tutti gli autori insieme oppure clicca su un singolo avatar nell’anteprima per rendere anonimo solo quel profilo.
• 14 lingue e avviso di leggibilità — Interfaccia e date della card disponibili in 14 lingue (automatiche in base al browser o scelte manualmente). Ti avvisa prima dell’esportazione se una card troppo alta rischia di risultare illeggibile nel feed.

PRIVACY:

• Zero telemetria: nessun dato personale viene raccolto o trasmesso. Le uniche richieste di rete scaricano le immagini del post dal CDN ufficiale di X (*.twimg.com) per consentire il rendering su HTML5 Canvas senza blocchi CORS.
• 100% locale: nessun account, nessuna chiave API, nessun server esterno; tutto viene elaborato nel tuo browser.
• Archiviazione solo locale: le tue preferenze restano salvate esclusivamente in chrome.storage.local.
• Permessi minimi: clipboardWrite (copia dell’immagine negli appunti), storage (salvataggio delle impostazioni) e accesso ai server immagini di X.

Non richiede login né accesso alle API di X: legge direttamente ciò che è già visibile nella pagina.

Non affiliato a X Corp.
```

### 巴西葡萄牙语 (pt-BR)

```
PostPress — Transforme posts e threads do X em cartões com acabamento editorial.

Chega de capturas de tela poluídas e em baixa resolução. Clique no ícone de prensa na barra de ações de qualquer post (ou pressione Alt + C ao passar o cursor) e o PostPress diagrama na hora um post avulso ou uma thread inteira do mesmo autor em um cartão nítido — pronto para copiar para a área de transferência ou baixar em PNG 3× Retina.

O QUE VOCÊ ENCONTRA:

• 12 temas táteis e digitais — Minimalista, Meia-noite, Vidro líquido, Material 3, Galeria, Câmara escura, Riso, Sumi, Argila, Terminal, Recibo e um Brutalista experimental. Cada tema é um sistema completo: textura de papel, fios divisórios, pares tipográficos, cores de destaque e assinatura visual.
• Área de exportação e moldura (Mat) — Posicione o cartão sobre um fundo independente nas proporções 1:1, 4:5, 3:4 ou 16:9 (com altura mínima elástica para nunca cortar textos longos). Escolha fundo seguindo o tema, cor sólida, gradiente ou margem transparente.
• Costura inteligente de threads — Dupla camada de leitura (GraphQL com fallback no DOM) que reúne automaticamente posts consecutivos do mesmo autor, filtrando anúncios e respostas de terceiros. Remova qualquer post da seleção com um clique.
• Artigos do X e citações ricas — Lê nativamente Artigos do X com imagem de capa, chapéu, título e linha fina; renderiza posts citados com preenchimento ou contorno combinando com o tema ativo.
• Detalhes de exibição e privacidade por autor — Ative ou desative separadamente código QR, métricas, data, linha «Crédito e build» e botão de play do vídeo. Desfoque todos os autores de uma vez ou clique em um avatar específico na prévia para ocultar apenas aquele perfil.
• 14 idiomas e alerta de legibilidade — Interface e datas do cartão em 14 idiomas (automático pelo navegador ou fixado manualmente). Avisa antes de exportar quando um cartão muito alto corre o risco de ficar pequeno demais no feed.

PRIVACIDADE:

• Zero telemetria: nenhum dado do usuário é coletado ou enviado. As únicas requisições de rede buscam as imagens do post no CDN oficial do X (*.twimg.com) para permitir a renderização no HTML5 Canvas sem bloqueio de CORS.
• 100% local: sem conta, sem chaves de API e sem servidores externos — tudo é processado diretamente no seu navegador.
• Armazenamento apenas local: suas preferências ficam salvas exclusivamente em chrome.storage.local.
• Permissões mínimas: clipboardWrite (copiar a imagem), storage (salvar suas preferências) e acesso aos servidores de imagem do X.

Não requer login nem acesso à API do X — lê apenas o conteúdo já carregado na página.

Não afiliado à X Corp.
```

### 印尼语 (id)

```
PostPress — Ubah postingan dan utas X menjadi kartu berkualitas cetak editorial.

Tinggalkan tangkapan layar yang berantakan dan buram. Klik ikon mesin cetak di bawah postingan mana pun (atau tekan Alt + C saat mengarahkan kursor), dan PostPress langsung menyusun postingan tunggal maupun utas beruntun dari penulis yang sama menjadi kartu yang tajam — siap disalin ke papan klip atau diunduh sebagai PNG 3× Retina.

FITUR UTAMA:

• 12 Tema Bertekstur & Digital — Minimal, Tengah malam, Kaca cair, Material 3, Galeri, Kamar gelap, Riso, Sumi, Tanah liat, Terminal, Struk, serta tema Brutalis eksperimental. Setiap tema dirancang utuh dengan tekstur kertas, garis batas, pasangan fon, warna aksen, dan tanda khasnya sendiri.
• Area Ekspor & Bingkai Kanvas (Mat) — Tempatkan kartu di atas lapisan latar terpisah dengan rasio 1:1, 4:5, 3:4, atau 16:9 (tinggi minimum fleksibel agar teks panjang tidak pernah terpotong). Pilih latar mengikuti tema, warna solid, gradien, atau ruang tepi transparan.
• Penyambungan Utas Cerdas — Pemindaian dua jalur (GraphQL dengan cadangan DOM) secara otomatis merangkai postingan berurutan dari penulis yang sama sekaligus menyaring iklan dan balasan pihak ketiga. Kecualikan postingan tertentu cukup dengan sekali klik.
• Artikel X & Kutipan Kaya — Mengenali Artikel X secara bawaan lengkap dengan sampul, subjudul atas, judul utama, dan paragraf pembuka; menampilkan postingan yang dikutip dalam gaya isi penuh atau garis tepi sesuai tema.
• Detail Tampilan & Privasi per Penulis — Atur sendiri tampilan kode QR, statistik, tanggal, info kredit dan build, serta tombol putar video. Buramkan semua penulis sekaligus, atau klik avatar tertentu di pratinjau untuk menyamarkan penulis itu saja.
• 14 Bahasa & Pengingat Keterbacaan — Antarmuka dan format tanggal kartu tersedia dalam 14 bahasa (mengikuti peramban atau dipilih manual). Memberikan peringatan sebelum ekspor jika kartu terlalu tinggi sehingga teksnya berisiko tampak terlalu kecil di linimasa.

PRIVASI:

• Tanpa Telemetri: Tidak ada data pengguna yang dikumpulkan atau dikirim ke luar. Satu-satunya permintaan jaringan hanya mengambil gambar postingan dari CDN resmi X (*.twimg.com) agar HTML5 Canvas dapat menggambar tanpa kendala CORS.
• 100% Lokal: Tanpa akun, tanpa kunci API, dan tanpa server eksternal — seluruh proses berlangsung di peramban Anda.
• Penyimpanan Lokal Saja: Preferensi Anda hanya disimpan di dalam chrome.storage.local pada perangkat.
• Izin Paling Minimal: Hanya memerlukan clipboardWrite (menyalin gambar ke papan klip), storage (menyimpan pengaturan), dan akses ke server gambar X.

Tidak perlu login atau akses API X — ekstensi membaca konten yang sudah tampil di halaman.

Tidak berafiliasi dengan X Corp.
```

### 繁体中文 (zh-TW)

```
PostPress · 印推 —— 把 X（Twitter）推文與長串，排印成出版級質感卡片。

告別夾帶雜亂介面與模糊縮放的普通截圖。輕點推文操作列的印刷機圖示（或游標停留按 Alt + C），PostPress（印推）即刻在本機將單則推文或同作者長串（Thread）重新組版，裝幀為可一鍵複製或匯出 3× 超高解析 PNG 的精美卡片。

功能亮點：

• 12 款實體質感與數位主題 —— 極簡、夜幕、液態玻璃、質感 (MD3)、藝廊、暗房、孔版、水墨、軟陶、終端機、收據，以及實驗性的粗野派。每款主題皆為完整設計系統：紙張肌理、分欄線、字體配對、強調色與專屬印記。
• 輸出畫布與裝裱襯底 —— 支援將卡片置於獨立背景層上匯出。提供 1:1、4:5、3:4、16:9 預設畫幅（彈性最小高度，長文絕不截斷）；背景可選跟隨主題、純色、漸層或透明留白，便於二次排版合成。
• 智慧長串拼合 —— 雙通道解析（GraphQL 優先，DOM 備援），自動辨識並串聯同作者連續推文，過濾廣告與無關回覆，並支援單則推文一鍵剔除。
• 原生長文與引用排版 —— 原生解析 X 長文（Article）的封面、眉標、標題與導言；引用推文隨主題切換填滿或描邊樣式；完整還原高解析多圖格線與表情符號。
• 呈現細節與逐則隱私模糊 —— 獨立開關原文 QR Code、互動數據、發布時間、署名與版本及影片播放按鈕。支援全域模糊所有作者，也可在預覽中點擊單則推文頭像，僅隱藏該名作者。
• 14 種語言與可讀性提醒 —— 介面與卡面日期支援 14 種語言（可跟隨瀏覽器或手動指定）。當長圖過高、縮至動態牆寬度後文字可能過小時，匯出前會主動提醒拆分為多張。

隱私保障：

• 零遙測與追蹤：絕不傳送任何使用者資料。唯一的網路請求僅用於從 X 官方圖片伺服器（*.twimg.com）載入配圖，以規避瀏覽器 Canvas 跨網域匯出限制。
• 100% 本機渲染：無需註冊帳號、無需 API 金鑰、無外部伺服器。
• 純本機儲存：個人化排版偏好僅保存在瀏覽器本機 chrome.storage.local。
• 權限最小化：僅宣告 clipboardWrite（複製圖片至剪貼簿）、storage（記住排版設定）及 X 官方圖片伺服器讀取權限。

無需登入帳號，也無需 X API 權限 —— 直接讀取目前頁面已載入的內容。

與 X Corp. 無關聯。
```


