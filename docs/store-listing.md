# Chrome Web Store 上架文案

商店后台的字段与 `manifest.json` 的 `name` / `description` 是**两份独立存储**：改这里不会自动更新商店页，改 `public/_locales/` 也不会同步到商店后台。

目前 `manifest.json` 的 `name` 与 `description` 已通过 `__MSG_extTitle__` 与 `__MSG_extDesc__` 接入 14 国语言目录（`public/_locales/<locale>/messages.json`），其中 `en_US` 与 `zh_CN` 的文案与下方「名称」「简短说明」完全一致。调整简短说明时请同步更新对应的 `messages.json`。

## 名称

```
PostPress · 印推
```
*(英文主名称：`PostPress — X & Thread Card Studio`)*

## 简短说明（manifest `description`，上限 132 字符）

英文（125 字符，在上限以内）：

```
Press X posts and threads into print-grade cards. 12 tactile themes, custom canvas mats, 100% local rendering, zero uploads.
```

中文（43 字符）：

```
把 X 推文与长串装帧成出版级高清卡片。12 款纸张肌理与自由画幅，纯本地排印，零数据上传。
```

## 详细说明

### 英文

```
PostPress — Press X posts and threads into publication-grade cards.

Stop sharing cluttered, low-DPI browser screenshots. Click the press icon on any post (or press Alt + C), and PostPress typesets single posts or multi-post threads into crisp, print-grade cards—ready to copy to your clipboard or export as 3× Retina PNGs.

WHAT YOU GET:

• 12 Tactile & Digital Themes — Minimal, Midnight, Liquid Glass, Material 3, Gallery, Darkroom, Riso, Sumi, Clay, Terminal, Receipt, plus an experimental Brutalist. Each is a complete design system: paper grain, border rules, typographic pairs, accents, and signature marks.
• Independent Canvas Matting — Mount the card on a standalone canvas mat. Aspect ratios: 1:1, 4:5, 3:4, 16:9 (elastic min-height; long text never truncates). Backdrops: follow theme, solid color, gradient, or transparent whitespace.
• Smart Thread Stitching — Dual-pipeline resolution (GraphQL with DOM fallback) seamlessly threads consecutive posts by the same author while filtering out ads and third-party replies. Exclude individual posts with one click.
• Long-form & Rich Quotes — Natively parses X Articles with cover images, kickers, titles, and ledes; quoted posts render in filled or outlined styles matching the active theme.
• Granular Controls & Per-Author Privacy — Toggle source QR code, engagement metrics, timestamp, credit watermark, and video play badge. Blur all authors globally, or click any post's avatar in the preview to anonymize just that author.
• 14 Languages & Readability Guard — Localized into 14 languages (following your browser or pinned manually). Alerts you before export if an ultra-long card would scale down too small in social feeds.

PRIVACY:

• Zero Remote Telemetry: Never transmits user data. The only network calls fetch card media from X's official CDN (*.twimg.com) to prevent HTML5 Canvas cross-origin tainting.
• 100% Local: No account, no API keys, and no backend servers. Everything renders right in your browser.
• Local Storage Only: Custom presets are saved purely in chrome.storage.local.
• Minimal Permissions: clipboardWrite (to put the image on your clipboard), storage (to remember your settings), and host access to X's image servers.

Requires no login and no X API access — it reads the posts already rendered on the page you are on.

Not affiliated with X Corp.
```

### 中文

```
PostPress · 印推 —— 把 X（Twitter）推文与长串，排印成出版级质感卡片。

告别夹带浏览器杂乱 UI 与模糊缩放的普通截屏。在推文操作栏轻点印刷机图标（或按快捷键 Alt + C），PostPress（印推）即刻在本地将单条推文或同作者长串（Thread）重新组版，装帧为可一键复制或导出 3× 超清 PNG 的精美卡片。

你会得到：

• 12 套实体级材质主题——从孔版印刷（Riso）、水墨宣纸、画廊装裱、暗房银盐，到极简、液态玻璃与热敏小票，外加一套实验性粗野派。每套主题均配备严谨匹配的纸面基调、边线质感、字体配对、强调色与专属签名装饰。
• 独立外层画布装裱（Mat）——支持将卡片承托在外层画布上导出。提供 1:1、4:5、3:4、16:9 预设画幅（采用 min-height 弹性下限，长文本绝不截断），并支持跟随主题、纯色或渐变背景；仅选画幅时留白保持透明，便于二次合成。
• 智能长串拼合（Thread）——双通道解析（GraphQL 优先 + DOM 降级兜底），自动识别并拼接同作者连续推文，剔除干扰广告与第三方回复，支持单条自由剔除。
• 长文与深度排版——原生识别 X 长文推文（Article），提取封面、眉标、标题与导语；引用推文依主题呈现为填充或描边双重质感；支持 Twemoji Unicode 还原与 1~4 张高清网格图片解析。
• 精细开关与逐条隐私脱敏——独立控制原文二维码、互动统计、发布时间戳、视频播放角标与署名版本；支持全局作者高斯模糊，也可直接点击卡片上某条推文的头像仅脱敏该作者。
• 14 国语言与可读性警示——内置中、英、日、韩等 14 种界面与卡面日期语言；当长图比例过大、缩至社交平台信息流宽度可能导致字号难以阅读时，面板主动呈现视觉警示，建议分段导出。

隐私保障：

• 零外部远程通信：除通过安全代理向 X 官方图片服务器（*.twimg.com）拉取配图（用于规避 Canvas 跨域污染 SecurityError）外，绝不向任何外部服务器发送请求。
• 无遥测与追踪：无数据分析、无行为埋点、无远程动态配置。
• 纯本地存储：个性化排版偏好仅保存在浏览器本地 chrome.storage.local。
• 权限最小化：仅声明 clipboardWrite（复制图片至剪贴板）、storage（保存用户偏好）及 twimg.com 图片代理权限。

无需登录，也无需 X API 权限——直接读取当前页面已渲染的内容。

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
PostPress — X-Beiträge und Threads als Karten in Druckqualität.

Schluss mit überladenen, unscharfen Browser-Screenshots. Klicke auf das Drucker-Symbol in der Aktionsleiste eines Beitrags (oder drücke Alt + C), und PostPress setzt einzelne Beiträge oder Threads desselben Autors zu gestochen scharfen Karten — bereit für die Zwischenablage oder den Export als 3×-Retina-PNG.

DAS BEKOMMST DU:

• 12 Material-Themes — Minimal, Mitternacht, Liquid Glass, Material 3, Galerie, Dunkelkammer, Riso, Sumi, Ton, Terminal, Kassenbon und ein experimentelles Brutalistisch. Jedes ist ein vollständiges Designsystem: Papierstruktur, Linien, Schriftenpaare, Akzente und ein eigenes Signaturzeichen.
• Eigene Leinwand (Mat) — Setze die Karte auf eine separate Leinwand. Formate 1:1, 4:5, 3:4, 16:9 (elastische Mindesthöhe, langer Text wird nie abgeschnitten). Hintergrund: dem Theme folgen, Vollton, Verlauf oder transparent.
• Intelligente Thread-Erkennung — Zwei Auflösungswege (GraphQL, mit DOM-Rückfall): fügt aufeinanderfolgende Beiträge desselben Autors zusammen und filtert Werbung und fremde Antworten heraus. Einzelne Beiträge lassen sich per Klick entfernen.
• Lange Beiträge und Zitate — Liest X-Artikel mit Titelbild, Kicker, Titel und Einleitung; zitierte Beiträge erscheinen gefüllt oder umrandet, passend zum Theme.
• Feine Schalter und Datenschutz pro Autor — QR-Code, Interaktionszahlen, Zeitstempel, Wasserzeichen und Video-Badge einzeln schaltbar. Alle Autoren global unkenntlich machen oder im Vorschaufenster auf einen Avatar klicken, um nur diesen Autor zu verbergen.
• 14 Sprachen und Lesbarkeits-Warnung — Oberfläche und Kartendatum in 14 Sprachen (folgt dem Browser oder fest gewählt). Warnt vor dem Export, wenn eine sehr lange Karte im Feed zu klein würde.

DATENSCHUTZ:

• Keine Telemetrie: Es werden keine Nutzerdaten übertragen. Die einzigen Netzwerkaufrufe holen Bilder vom offiziellen CDN von X (*.twimg.com), damit die Leinwand nicht durch fremde Herkunft gesperrt wird.
• 100 % lokal: kein Konto, keine API-Schlüssel, kein Server.
• Nur lokaler Speicher: Einstellungen liegen ausschließlich in chrome.storage.local.
• Minimale Berechtigungen: clipboardWrite (Bild in die Zwischenablage), storage (Einstellungen merken) und Zugriff auf die Bildserver von X.

Kein Login und kein X-API-Zugang nötig — gelesen wird, was die Seite ohnehin anzeigt.

Nicht mit X Corp. verbunden.
```

### 俄语 (ru)

```
PostPress — превращает посты и треды X в карточки печатного качества.

Хватит захламлённых и размытых скриншотов. Нажмите значок печатного станка в панели действий поста (или Alt + C) — и PostPress соберёт одиночный пост или тред одного автора в чёткую карточку, готовую для буфера обмена или экспорта в PNG 3× Retina.

ЧТО ВЫ ПОЛУЧИТЕ:

• 12 материальных тем — Минимализм, Полночь, Жидкое стекло, Material 3, Галерея, Фотолаборатория, Ризограф, Суми, Глина, Терминал, Чек и экспериментальный Брутализм. Каждая — законченная система: фактура бумаги, линейки, шрифтовые пары, акценты и собственный знак.
• Отдельный мат (Mat) — карточку можно поставить на отдельное поле. Форматы 1:1, 4:5, 3:4, 16:9 (эластичная минимальная высота, длинный текст не обрезается). Фон: как в теме, сплошной, градиент или прозрачный.
• Умная сборка тредов — два канала (GraphQL, при промахе — DOM): склеивает подряд идущие посты одного автора, отсекает рекламу и чужие ответы. Любой пост убирается одним щелчком.
• Длинные посты и цитаты — нативно читает статьи X (обложка, надзаголовок, заголовок, лид); цитаты рисуются заливкой или обводкой по теме.
• Тонкие переключатели и приватность по авторам — QR-код, статистика, время, подпись и значок видео включаются отдельно. Размыть всех авторов сразу или щёлкнуть по аватару в превью, чтобы скрыть только его.
• 14 языков и предупреждение о читаемости — интерфейс и даты на карточке на 14 языках (по браузеру или вручную). Перед экспортом предупредит, если очень длинная карточка станет нечитаемой в ленте.

ПРИВАТНОСТЬ:

• Никакой телеметрии: данные никуда не отправляются. Единственные сетевые запросы — за картинками с официального CDN X (*.twimg.com), иначе canvas заблокируется.
• Полностью локально: без аккаунта, без ключей API, без серверов.
• Только локальное хранилище: настройки лежат в chrome.storage.local.
• Минимум разрешений: clipboardWrite (картинка в буфер), storage (помнить настройки) и доступ к серверам изображений X.

Вход и доступ к API X не нужны — расширение читает то, что страница уже отрисовала.

Не связано с X Corp.
```

### 法语 (fr)

```
PostPress — transforme les posts et les threads de X en cartes de qualité éditoriale.

Fini les captures d'écran encombrées et floues. Cliquez sur l'icône d'imprimante dans la barre d'actions d'un post (ou appuyez sur Alt + C) : PostPress compose le post seul ou le thread d'un même auteur en une carte nette, prête à être copiée ou exportée en PNG 3× Retina.

CE QUE VOUS OBTENEZ :

• 12 thèmes matériels — Minimal, Minuit, Verre liquide, Material 3, Galerie, Chambre noire, Riso, Sumi, Argile, Terminal, Ticket, plus un Brutaliste expérimental. Chacun est un système complet : grain de papier, filets, paires typographiques, accents et marque signature.
• Support indépendant (Mat) — Posez la carte sur un support séparé. Formats 1:1, 4:5, 3:4, 16:9 (hauteur minimale élastique, le texte long n'est jamais coupé). Fonds : suivre le thème, aplat, dégradé ou transparent.
• Assemblage intelligent des threads — Résolution à deux canaux (GraphQL, avec repli sur le DOM) : recolle les posts consécutifs d'un même auteur et écarte les publicités et les réponses tierces. Chaque post se retire d'un clic.
• Articles longs et citations — Lit nativement les Articles X (couverture, surtitre, titre, chapeau) ; les posts cités s'affichent en plein ou en contour selon le thème.
• Réglages fins et confidentialité par auteur — QR code, statistiques, horodatage, filigrane et badge vidéo, chacun activable. Floutez tous les auteurs d'un coup, ou cliquez sur l'avatar d'un post dans l'aperçu pour n'anonymiser que celui-là.
• 14 langues et garde-fou de lisibilité — Interface et dates de carte en 14 langues (suit le navigateur ou choix manuel). Prévient avant l'export si une carte très longue deviendrait illisible dans un fil.

CONFIDENTIALITÉ :

• Aucune télémétrie : aucune donnée n'est transmise. Les seuls appels réseau récupèrent les images du CDN officiel de X (*.twimg.com), sans quoi le canvas serait bloqué.
• 100 % local : pas de compte, pas de clé API, pas de serveur.
• Stockage local uniquement : les réglages restent dans chrome.storage.local.
• Autorisations minimales : clipboardWrite (copier l'image), storage (mémoriser les réglages) et l'accès aux serveurs d'images de X.

Aucune connexion et aucun accès à l'API X ne sont nécessaires — l'extension lit ce que la page affiche déjà.

Non affilié à X Corp.
```

### 韩语 (ko)

```
PostPress — X의 게시물과 스레드를 인쇄 품질의 카드로 만듭니다.

지저분하고 흐린 브라우저 스크린샷은 이제 그만. 게시물 작업 표시줄의 인쇄기 아이콘을 누르거나(또는 Alt + C) PostPress가 단일 게시물이나 같은 작성자의 스레드를 선명한 카드로 다시 조판합니다. 클립보드에 복사하거나 3× Retina PNG로 내보낼 수 있습니다.

제공 기능:

• 12가지 질감 테마 — 미니멀, 미드나이트, 리퀴드 글라스, 머티리얼 (MD3), 갤러리, 암실, 리소, 수묵, 클레이, 터미널, 영수증, 그리고 실험적인 브루탈리즘. 각 테마는 종이 질감, 경계선, 서체 조합, 강조색, 고유 장식까지 갖춘 하나의 디자인 시스템입니다.
• 독립 캔버스(Mat) — 카드를 별도 캔버스 위에 올려 내보냅니다. 비율 1:1, 4:5, 3:4, 16:9(최소 높이가 늘어나 긴 글도 잘리지 않음). 배경은 테마 따르기, 단색, 그라데이션, 투명 중에서 고릅니다.
• 스마트 스레드 연결 — 두 갈래 해석(GraphQL 우선, 실패 시 DOM)으로 같은 작성자의 연속 게시물을 이어 붙이고 광고와 제3자 답글은 걸러냅니다. 게시물 하나만 골라 뺄 수도 있습니다.
• 긴 글과 인용 — X 아티클(표지, 상단 문구, 제목, 도입부)을 그대로 읽고, 인용 게시물은 테마에 맞춰 채움 또는 테두리로 그립니다.
• 세밀한 스위치와 작성자별 비공개 — QR 코드, 반응 수치, 시각, 서명, 동영상 배지를 각각 끄고 켭니다. 모든 작성자를 한 번에 흐리게 하거나, 미리보기에서 아바타를 눌러 그 작성자만 가릴 수 있습니다.
• 14개 언어와 가독성 경고 — 인터페이스와 카드 날짜를 14개 언어로 제공합니다(브라우저를 따르거나 직접 고정). 카드가 너무 길어 피드에서 읽기 어려워질 것 같으면 내보내기 전에 알려 줍니다.

개인정보:

• 원격 텔레메트리 없음: 어떤 사용자 데이터도 전송하지 않습니다. 유일한 네트워크 요청은 X의 공식 CDN(*.twimg.com)에서 카드 이미지를 가져오는 것이며, 캔버스가 교차 출처로 오염되는 것을 막기 위한 것입니다.
• 100% 로컬: 계정도, API 키도, 서버도 없습니다.
• 로컬 저장소만 사용: 설정은 chrome.storage.local에만 저장됩니다.
• 최소 권한: clipboardWrite(이미지를 클립보드로), storage(설정 기억), X 이미지 서버 접근.

로그인도 X API 권한도 필요 없습니다. 페이지에 이미 그려진 내용을 읽을 뿐입니다.

X Corp.와 무관합니다.
```

### 日语 (ja)

```
PostPress — X の投稿とスレッドを、印刷品質のカードに。

乱雑でぼやけたスクリーンショットはもう不要です。投稿のアクションバーにある印刷機のアイコンをクリックするか（または Alt + C）、PostPress が単体の投稿や同じ著者のスレッドを、はっきりしたカードに組み直します。クリップボードへコピーするか、3× Retina の PNG として書き出せます。

できること:

• 12 の質感テーマ — ミニマル、ミッドナイト、リキッドグラス、マテリアル (MD3)、ギャラリー、暗室、リソ、墨絵、クレイ、ターミナル、レシート、そして実験的なブルータリズム。どれも紙の質感、罫線、書体の組み合わせ、アクセント、独自の装飾まで揃った一つのデザインシステムです。
• 独立したキャンバス（Mat） — カードを別のキャンバスに載せて書き出せます。比率は 1:1、4:5、3:4、16:9（最小高さが伸びるので長い文章も切れません）。背景はテーマに従う・単色・グラデーション・透明から選べます。
• 賢いスレッド連結 — 二系統の解析（GraphQL 優先、失敗時は DOM）で同じ著者の連続投稿をつなぎ、広告や第三者への返信は除きます。投稿を一つだけ外すこともできます。
• 長文と引用 — X の記事（カバー、キッカー、タイトル、リード）をそのまま読み取り、引用投稿はテーマに合わせて塗りまたは枠線で描きます。
• 細かなスイッチと著者ごとの匿名化 — QR コード、反応数、日時、署名、動画バッジを個別に切り替え。全著者をまとめてぼかすことも、プレビューでアバターをクリックしてその著者だけを隠すこともできます。
• 14 言語と可読性の警告 — 画面とカードの日付を 14 言語で表示（ブラウザに従うか手動で固定）。カードが長すぎてタイムラインで読めなくなりそうなときは、書き出す前に知らせます。

プライバシー:

• 遠隔計測なし: 利用者のデータは一切送信しません。通信は X 公式 CDN（*.twimg.com）からカード用の画像を取るだけで、キャンバスが別オリジンで汚染されるのを防ぐためのものです。
• 100% ローカル: アカウントも API キーもサーバーもありません。
• 保存はローカルのみ: 設定は chrome.storage.local にだけ残ります。
• 最小限の権限: clipboardWrite（画像をクリップボードへ）、storage（設定の記憶）、X の画像サーバーへのアクセス。

ログインも X API の権限も不要です。ページにすでに描かれている内容を読むだけです。

X Corp. とは関係ありません。
```

### 土耳其语 (tr)

```
PostPress — X gönderilerini ve dizilerini baskı kalitesinde kartlara dönüştürür.

Dağınık ve bulanık tarayıcı ekran görüntülerine son. Gönderinin işlem çubuğundaki yazıcı simgesine dokunun (veya Alt + C), PostPress tek gönderiyi ya da aynı yazarın dizisini net bir karta dizsin: panoya kopyalayın veya 3× Retina PNG olarak dışa aktarın.

NELER VAR:

• 12 dokulu tema — Minimal, Gece yarısı, Sıvı cam, Material 3, Galeri, Karanlık oda, Riso, Sumi, Kil, Terminal, Fiş ve deneysel Brütalist. Her biri kâğıt dokusu, çizgiler, yazı çiftleri, vurgu rengi ve kendi imza motifiyle tam bir tasarım sistemi.
• Bağımsız tuval (Mat) — Kartı ayrı bir tuvale oturtun. Oranlar 1:1, 4:5, 3:4, 16:9 (esnek alt yükseklik, uzun metin asla kesilmez). Arka plan: temayı izle, düz renk, degrade veya saydam.
• Akıllı dizi birleştirme — İki kanallı çözümleme (önce GraphQL, olmazsa DOM): aynı yazarın ardışık gönderilerini birleştirir, reklamları ve başkalarının yanıtlarını ayıklar. Tek gönderiyi tek tıkla çıkarabilirsiniz.
• Uzun gönderiler ve alıntılar — X makalelerini (kapak, üst başlık, başlık, giriş) doğrudan okur; alıntılanan gönderiler temaya göre dolgulu veya çerçeveli çizilir.
• İnce ayarlar ve yazar bazlı gizlilik — QR kod, etkileşim sayıları, saat, imza ve video rozeti ayrı ayrı açılır. Tüm yazarları birden bulanıklaştırın ya da önizlemede bir avatarın üzerine tıklayıp yalnız o yazarı gizleyin.
• 14 dil ve okunabilirlik uyarısı — Arayüz ve kart tarihleri 14 dilde (tarayıcıyı izler veya elle sabitlenir). Kart çok uzayıp akışta okunamayacak kadar küçülecekse dışa aktarmadan önce uyarır.

GİZLİLİK:

• Uzaktan ölçüm yok: hiçbir kullanıcı verisi gönderilmez. Tek ağ isteği, tuvalin başka kaynaktan kirlenmesini önlemek için X'in resmî CDN'inden (*.twimg.com) kart görsellerini almaktır.
• %100 yerel: hesap yok, API anahtarı yok, sunucu yok.
• Yalnız yerel depolama: ayarlar sadece chrome.storage.local içinde.
• En az izin: clipboardWrite (görseli panoya), storage (ayarları hatırla) ve X'in görsel sunucularına erişim.

Oturum açmak ve X API erişimi gerekmez — sayfada zaten çizili olanı okur.

X Corp. ile bağlantılı değildir.
```

### 乌克兰语 (uk)

```
PostPress — перетворює дописи й треди X на картки друкарської якості.

Досить захаращених і розмитих знімків екрана. Натисніть значок друкарського верстата в панелі дій допису (або Alt + C) — і PostPress збереже один допис чи тред одного автора в чітку картку, готову для буфера обміну або експорту в PNG 3× Retina.

ЩО ВИ ОТРИМАЄТЕ:

• 12 матеріальних тем — Мінімалізм, Опівніч, Рідке скло, Material 3, Галерея, Фотолабораторія, Ризограф, Сумі, Глина, Термінал, Чек і експериментальний Бруталізм. Кожна — цілісна система: фактура паперу, лінійки, шрифтові пари, акценти й власний знак.
• Окремий мат (Mat) — картку можна поставити на окреме поле. Формати 1:1, 4:5, 3:4, 16:9 (еластична мінімальна висота, довгий текст не обрізається). Тло: як у темі, суцільне, градієнт або прозоре.
• Розумне зшивання тредів — два канали (GraphQL, за промаху — DOM): збирає послідовні дописи одного автора, відсікає рекламу й чужі відповіді. Будь-який допис прибирається одним кліком.
• Довгі дописи й цитати — нативно читає статті X (обкладинка, надзаголовок, заголовок, лід); цитати малюються заливкою або обведенням за темою.
• Тонкі перемикачі й приватність за авторами — QR-код, статистика, час, підпис і значок відео вмикаються окремо. Розмити всіх авторів одразу або клікнути аватар у превʼю, щоб приховати лише його.
• 14 мов і попередження про читабельність — інтерфейс і дати на картці 14 мовами (за браузером або вручну). Перед експортом попередить, якщо дуже довга картка стане нечитабельною у стрічці.

ПРИВАТНІСТЬ:

• Жодної телеметрії: дані нікуди не надсилаються. Єдині мережеві запити — по картинки з офіційного CDN X (*.twimg.com), інакше canvas буде заблоковано.
• Повністю локально: без акаунта, без ключів API, без серверів.
• Лише локальне сховище: налаштування лежать у chrome.storage.local.
• Мінімум дозволів: clipboardWrite (картинка в буфер), storage (памʼятати налаштування) і доступ до серверів зображень X.

Вхід і доступ до API X не потрібні — розширення читає те, що сторінка вже намалювала.

Не повʼязано з X Corp.
```

### 西班牙语 (es)

```
PostPress — convierte las publicaciones e hilos de X en tarjetas con calidad de imprenta.

Se acabaron las capturas de pantalla abarrotadas y borrosas. Pulsa el icono de imprenta en la barra de acciones de una publicación (o Alt + C) y PostPress compone la publicación suelta o el hilo de un mismo autor en una tarjeta nítida, lista para copiar o exportar como PNG 3× Retina.

LO QUE OBTIENES:

• 12 temas matéricos — Minimal, Medianoche, Cristal líquido, Material 3, Galería, Cuarto oscuro, Riso, Sumi, Arcilla, Terminal, Recibo y un Brutalista experimental. Cada uno es un sistema completo: grano de papel, filetes, parejas tipográficas, acentos y una marca propia.
• Lienzo independiente (Mat) — Monta la tarjeta en un lienzo aparte. Formatos 1:1, 4:5, 3:4, 16:9 (altura mínima elástica; el texto largo nunca se recorta). Fondos: seguir el tema, color plano, degradado o transparente.
• Unión inteligente de hilos — Resolución por dos canales (GraphQL, con respaldo en el DOM): enlaza publicaciones consecutivas del mismo autor y descarta anuncios y respuestas ajenas. Cada publicación se quita con un clic.
• Textos largos y citas — Lee de forma nativa los Artículos de X (portada, antetítulo, título y entradilla); las citas se dibujan rellenas o con contorno según el tema.
• Ajustes finos y privacidad por autor — Código QR, métricas, fecha, firma y distintivo de vídeo, cada uno por separado. Difumina a todos los autores de golpe o pulsa el avatar de una publicación en la vista previa para ocultar solo a ese autor.
• 14 idiomas y aviso de legibilidad — Interfaz y fechas de la tarjeta en 14 idiomas (siguen el navegador o se fijan a mano). Avisa antes de exportar si una tarjeta muy larga quedaría ilegible en un feed.

PRIVACIDAD:

• Sin telemetría: no se transmite ningún dato. Las únicas peticiones de red traen las imágenes del CDN oficial de X (*.twimg.com), sin lo cual el lienzo quedaría bloqueado.
• 100 % local: sin cuenta, sin claves de API, sin servidores.
• Solo almacenamiento local: los ajustes viven en chrome.storage.local.
• Permisos mínimos: clipboardWrite (copiar la imagen), storage (recordar los ajustes) y acceso a los servidores de imágenes de X.

No hace falta iniciar sesión ni disponer de la API de X: lee lo que la página ya muestra.

No está afiliado a X Corp.
```

### 意大利语 (it)

```
PostPress — trasforma i post e i thread di X in carte di qualità tipografica.

Basta con screenshot ingombri e sfocati. Clicca l'icona della stampante nella barra delle azioni di un post (oppure premi Alt + C) e PostPress impagina il singolo post o il thread di uno stesso autore in una carta nitida, pronta da copiare o esportare come PNG 3× Retina.

COSA OTTIENI:

• 12 temi materici — Minimal, Mezzanotte, Vetro liquido, Material 3, Galleria, Camera oscura, Riso, Sumi, Argilla, Terminale, Scontrino e un Brutalista sperimentale. Ognuno è un sistema compiuto: grana della carta, filetti, coppie tipografiche, accenti e un proprio segno.
• Tela indipendente (Mat) — Appoggia la carta su una tela separata. Formati 1:1, 4:5, 3:4, 16:9 (altezza minima elastica: il testo lungo non viene mai tagliato). Sfondi: segui il tema, tinta unita, sfumatura o trasparente.
• Unione intelligente dei thread — Risoluzione a due canali (GraphQL, con ripiego sul DOM): concatena i post consecutivi dello stesso autore e scarta pubblicità e risposte altrui. Ogni post si toglie con un clic.
• Testi lunghi e citazioni — Legge nativamente gli Articoli di X (copertina, occhiello, titolo, sommario); le citazioni sono disegnate piene o con contorno secondo il tema.
• Regolazioni fini e privacy per autore — Codice QR, metriche, data, firma e badge video, ciascuno separato. Sfoca tutti gli autori insieme oppure clicca l'avatar di un post nell'anteprima per nascondere solo quello.
• 14 lingue e avviso di leggibilità — Interfaccia e date della carta in 14 lingue (seguono il browser o si fissano a mano). Avvisa prima dell'esportazione se una carta molto lunga diventerebbe illeggibile in un feed.

PRIVACY:

• Nessuna telemetria: nessun dato viene trasmesso. Le uniche richieste di rete scaricano le immagini dal CDN ufficiale di X (*.twimg.com), altrimenti la tela risulterebbe bloccata.
• 100 % locale: nessun account, nessuna chiave API, nessun server.
• Solo archiviazione locale: le impostazioni restano in chrome.storage.local.
• Permessi minimi: clipboardWrite (copia l'immagine), storage (ricorda le impostazioni) e accesso ai server immagini di X.

Non servono accesso né API di X: legge ciò che la pagina mostra già.

Non affiliato a X Corp.
```

### 巴西葡萄牙语 (pt-BR)

```
PostPress — transforma posts e threads do X em cartões com qualidade de impressão.

Chega de capturas de tela poluídas e borradas. Clique no ícone da impressora na barra de ações de um post (ou pressione Alt + C) e o PostPress compõe o post sozinho ou o thread de um mesmo autor em um cartão nítido, pronto para copiar ou exportar como PNG 3× Retina.

O QUE VOCÊ RECEBE:

• 12 temas materiais — Minimalista, Meia-noite, Vidro líquido, Material 3, Galeria, Câmara escura, Riso, Sumi, Argila, Terminal, Recibo e um Brutalista experimental. Cada um é um sistema completo: textura de papel, filetes, pares tipográficos, acentos e uma marca própria.
• Tela independente (Mat) — Coloque o cartão sobre uma tela separada. Formatos 1:1, 4:5, 3:4, 16:9 (altura mínima elástica; texto longo nunca é cortado). Fundos: seguir o tema, cor sólida, gradiente ou transparente.
• Junção inteligente de threads — Resolução em dois canais (GraphQL, com fallback no DOM): emenda posts consecutivos do mesmo autor e descarta anúncios e respostas de terceiros. Cada post sai com um clique.
• Textos longos e citações — Lê nativamente os Artigos do X (capa, antetítulo, título e linha de abertura); citações aparecem preenchidas ou contornadas conforme o tema.
• Ajustes finos e privacidade por autor — QR code, métricas, data, assinatura e selo de vídeo, cada um separado. Desfoque todos os autores de uma vez ou clique no avatar de um post na prévia para ocultar só aquele autor.
• 14 idiomas e aviso de legibilidade — Interface e datas do cartão em 14 idiomas (seguem o navegador ou ficam fixos). Avisa antes de exportar se um cartão muito longo ficaria ilegível no feed.

PRIVACIDADE:

• Sem telemetria: nenhum dado é transmitido. As únicas requisições de rede buscam imagens no CDN oficial do X (*.twimg.com), sem o que a tela ficaria bloqueada.
• 100 % local: sem conta, sem chaves de API, sem servidores.
• Apenas armazenamento local: as preferências ficam em chrome.storage.local.
• Permissões mínimas: clipboardWrite (copiar a imagem), storage (lembrar as preferências) e acesso aos servidores de imagem do X.

Não precisa de login nem da API do X — lê o que a página já mostra.

Não afiliado à X Corp.
```

### 印尼语 (id)

```
PostPress — mengubah postingan dan utas X menjadi kartu berkualitas cetak.

Tak perlu lagi tangkapan layar yang penuh dan buram. Klik ikon mesin cetak di bilah tindakan sebuah postingan (atau tekan Alt + C), lalu PostPress menyusun satu postingan atau utas dari penulis yang sama menjadi kartu tajam yang siap disalin atau diekspor sebagai PNG 3× Retina.

YANG ANDA DAPATKAN:

• 12 tema material — Minimal, Tengah malam, Kaca cair, Material 3, Galeri, Kamar gelap, Riso, Sumi, Tanah liat, Terminal, Struk, dan satu Brutalis eksperimental. Semuanya sistem desain utuh: tekstur kertas, garis, pasangan huruf, aksen, dan tanda khasnya sendiri.
• Kanvas terpisah (Mat) — Letakkan kartu di kanvas tersendiri. Rasio 1:1, 4:5, 3:4, 16:9 (tinggi minimum elastis, teks panjang tidak pernah terpotong). Latar: ikut tema, warna solid, gradien, atau transparan.
• Penyambungan utas pintar — Dua jalur (GraphQL, dengan cadangan DOM): menyambung postingan berurutan dari penulis yang sama dan menyaring iklan serta balasan orang lain. Satu postingan bisa dikeluarkan dengan sekali klik.
• Tulisan panjang dan kutipan — Membaca Artikel X secara asli (sampul, kicker, judul, paragraf pembuka); kutipan digambar berisi atau bergaris sesuai tema.
• Sakelar rinci dan privasi per penulis — Kode QR, angka interaksi, waktu, tanda tangan, dan lencana video bisa diatur satu per satu. Buramkan semua penulis sekaligus, atau klik avatar sebuah postingan di pratinjau untuk menyembunyikan penulis itu saja.
• 14 bahasa dan peringatan keterbacaan — Antarmuka dan tanggal kartu dalam 14 bahasa (mengikuti peramban atau dipilih manual). Memberi tahu sebelum ekspor bila kartu terlalu panjang hingga tak terbaca di linimasa.

PRIVASI:

• Tanpa telemetri: tidak ada data pengguna yang dikirim. Satu-satunya permintaan jaringan mengambil gambar dari CDN resmi X (*.twimg.com), tanpanya kanvas akan terblokir.
• 100% lokal: tanpa akun, tanpa kunci API, tanpa server.
• Hanya penyimpanan lokal: pengaturan disimpan di chrome.storage.local.
• Izin seminimal mungkin: clipboardWrite (menyalin gambar), storage (mengingat pengaturan), dan akses ke server gambar X.

Tidak perlu masuk akun atau akses API X — ekstensi membaca apa yang sudah tampil di halaman.

Tidak berafiliasi dengan X Corp.
```

### 繁体中文 (zh-TW)

```
PostPress · 印推 —— 把 X（Twitter）推文與長串，排印成出版級質感卡片。

告別夾帶瀏覽器雜亂 UI 與模糊縮放的普通截圖。在推文操作列輕點印刷機圖示（或按快速鍵 Alt + C），PostPress（印推）即刻在本機將單條推文或同作者長串（Thread）重新組版，裝幀為可一鍵複製或匯出 3× 超清 PNG 的精美卡片。

你會得到：

• 12 套實體級材質主題——從孔版印刷（Riso）、水墨宣紙、藝廊裝裱、暗房銀鹽，到極簡、液態玻璃與熱感收據，外加一套實驗性粗野派。每套主題均配備嚴謹匹配的紙面基調、邊線質感、字體配對、強調色與專屬簽名裝飾。
• 獨立外層畫布裝裱（Mat）——支援將卡片承托在外層畫布上匯出。提供 1:1、4:5、3:4、16:9 預設畫幅（採 min-height 彈性下限，長文本絕不截斷），並支援跟隨主題、純色或漸層背景；僅選畫幅時留白保持透明，便於二次合成。
• 智慧長串拼合（Thread）——雙通道解析（GraphQL 優先 + DOM 降級備援），自動辨識並拼接同作者連續推文，剔除干擾廣告與第三方回覆，支援單條自由剔除。
• 長文與深度排版——原生辨識 X 長文推文（Article），擷取封面、眉標、標題與導語；引用推文依主題呈現為填色或描邊雙重質感；支援 Twemoji Unicode 還原與 1~4 張高解析網格圖片解析。
• 精細開關與逐條隱私模糊——獨立控制原文 QR Code、互動統計、發布時間、影片播放角標與署名版本；支援全域作者高斯模糊，也可直接點擊卡片上某條推文的頭像僅模糊該作者。
• 14 國語言與可讀性警示——內建中、英、日、韓等 14 種介面與卡面日期語言；當長圖比例過大、縮至社群平台動態牆寬度可能導致字級難以閱讀時，面板主動呈現視覺警示，建議分段匯出。

隱私保障：

• 零外部遠端通訊：除透過安全代理向 X 官方圖片伺服器（*.twimg.com）取得配圖（用於規避 Canvas 跨網域污染 SecurityError）外，絕不向任何外部伺服器發送請求。
• 無遙測與追蹤：無數據分析、無行為埋點、無遠端動態設定。
• 純本機儲存：個人化排版偏好僅保存在瀏覽器本機 chrome.storage.local。
• 權限最小化：僅宣告 clipboardWrite（複製圖片至剪貼簿）、storage（儲存使用者偏好）及 twimg.com 圖片代理權限。

無需登入，也無需 X API 權限——直接讀取目前頁面已渲染的內容。

與 X Corp. 無關聯。
```

