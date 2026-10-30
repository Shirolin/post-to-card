/**
 * The extension popup's own copy.
 *
 * The popup and the card modal are two different surfaces, so their words do
 * not overlap: the modal talks about a card's shape and its materials, and the
 * popup talks about the button it toggles and the card it opens. Sharing one
 * dictionary between them would mean one of them carrying words it never
 * shows.
 *
 * What they do share is the *locale*. The popup reads the same stored
 * preference the modal writes, and it has to resolve that preference the same
 * way — so the locale type, the browser's default and the storage key come
 * from the modules that own them, and this file holds only the words.
 *
 * The popup is a separate build entry, so this module reaches it through the
 * bundler rather than through a copy in `public/`. The popup's markup ships the
 * English strings inlined, because it paints before its script runs — English
 * because that is the manifest's `default_locale`; a test pins the two against
 * each other.
 */

import type { Locale } from '../types/card.ts';

/**
 * The popup's copy for one locale.
 */
export interface PopupCopy {
  /** The title of the toggle that shows the action-bar button. */
  toggleTitle: string;
  /** What that toggle does. */
  toggleDesc: string;
  /** The keyboard shortcut, shown under the toggle. */
  tip: string;
  /** The label of the button that opens a card for the current post. */
  trigger: string;
  /** Said after the action-bar button is switched on. */
  buttonEnabled: string;
  /** Said after the action-bar button is switched off. */
  buttonHidden: string;
  /** Said when the browser would not say which tab is active. */
  noTabAccess: string;
  /** Said when there is no active tab to open a card for. */
  noActiveTab: string;
  /** Said when the current tab is not one this extension works on. */
  notOnX: string;
  /** Said when the tab is right but no post is under the pointer. */
  hoverFirst: string;
  /** Said after a card was opened. */
  cardOpened: string;
}

/**
 * The popup's copy, per locale.
 *
 * The locale ids are the ones `i18n.ts` declares, because the popup follows
 * the stored preference and that preference names a locale from that list.
 * `hygiene.3` is what keeps this table's locales equal to that list's: the type
 * refuses a missing key on this literal, but not a locale that was dropped from
 * `SUPPORTED_LOCALES` while its copy stayed behind.
 */
export const POPUP_COPY: Record<Locale, PopupCopy> = {
  'en-US': {
    toggleTitle: 'Tweet Card Button',
    toggleDesc: 'Show trigger button on tweet action bars',
    tip: 'Even if hidden, press <kbd>Alt</kbd> + <kbd>C</kbd> while hovering on a tweet to generate card.',
    trigger: 'Generate Active Tweet Card',
    buttonEnabled: 'Button enabled',
    buttonHidden: 'Button hidden',
    noTabAccess: 'Cannot access tab',
    noActiveTab: 'No active tab found',
    notOnX: 'Please open Twitter/X first',
    hoverFirst: 'Hover over a tweet or refresh tab',
    cardOpened: 'Card opened!',
  },
  'zh-CN': {
    toggleTitle: '推文卡片按钮',
    toggleDesc: '在推文操作栏显示生成卡片按钮',
    tip: '即使按钮隐藏，鼠标悬停在推文上按 <kbd>Alt</kbd> + <kbd>C</kbd> 仍可随时生成卡片。',
    trigger: '生成当前推文卡片',
    buttonEnabled: '已开启卡片按钮',
    buttonHidden: '已隐藏卡片按钮',
    noTabAccess: '无法访问当前标签页',
    noActiveTab: '未找到活动标签页',
    notOnX: '请在 Twitter/X 网页中使用此功能',
    hoverFirst: '请将光标移动到推文上或刷新页面',
    cardOpened: '卡片已生成！',
  },
  'zh-TW': {
    toggleTitle: '推文卡片按鈕',
    toggleDesc: '在推文操作列顯示產生卡片按鈕',
    tip: '即使按鈕隱藏，滑鼠停留在推文上按 <kbd>Alt</kbd> + <kbd>C</kbd> 仍可隨時產生卡片。',
    trigger: '產生目前推文卡片',
    buttonEnabled: '已開啟卡片按鈕',
    buttonHidden: '已隱藏卡片按鈕',
    noTabAccess: '無法存取目前分頁',
    noActiveTab: '找不到使用中的分頁',
    notOnX: '請在 Twitter/X 網頁中使用此功能',
    hoverFirst: '請將游標移到推文上或重新整理頁面',
    cardOpened: '卡片已產生！',
  },
  ja: {
    toggleTitle: 'ポストのカードボタン',
    toggleDesc: 'ポストのアクションバーにカード作成ボタンを表示します',
    tip: '非表示でも、ポストにカーソルを合わせて <kbd>Alt</kbd> + <kbd>C</kbd> を押せばいつでもカードを作れます。',
    trigger: '表示中のポストのカードを作成',
    buttonEnabled: 'ボタンを表示しました',
    buttonHidden: 'ボタンを非表示にしました',
    noTabAccess: 'タブにアクセスできません',
    noActiveTab: 'アクティブなタブが見つかりません',
    notOnX: 'Twitter/X のページでお使いください',
    hoverFirst: 'ポストにカーソルを合わせるか、タブを再読み込みしてください',
    cardOpened: 'カードを作成しました',
  },
  ko: {
    toggleTitle: '게시물 카드 버튼',
    toggleDesc: '게시물 작업 표시줄에 카드 만들기 버튼을 표시합니다',
    tip: '숨겨져 있어도 게시물에 커서를 두고 <kbd>Alt</kbd> + <kbd>C</kbd>를 누르면 언제든 카드를 만들 수 있습니다.',
    trigger: '현재 게시물 카드 만들기',
    buttonEnabled: '버튼을 표시했습니다',
    buttonHidden: '버튼을 숨겼습니다',
    noTabAccess: '탭에 접근할 수 없습니다',
    noActiveTab: '활성 탭을 찾지 못했습니다',
    notOnX: 'Twitter/X 페이지에서 사용해 주세요',
    hoverFirst: '게시물에 커서를 두거나 탭을 새로 고쳐 주세요',
    cardOpened: '카드를 만들었습니다',
  },
  de: {
    toggleTitle: 'Karten-Button am Post',
    toggleDesc: 'Zeigt den Karten-Button in der Aktionsleiste eines Posts',
    tip: 'Auch ausgeblendet: mit der Maus über einem Post und <kbd>Alt</kbd> + <kbd>C</kbd> eine Karte erstellen.',
    trigger: 'Karte für diesen Post erstellen',
    buttonEnabled: 'Button eingeblendet',
    buttonHidden: 'Button ausgeblendet',
    noTabAccess: 'Kein Zugriff auf den Tab',
    noActiveTab: 'Kein aktiver Tab gefunden',
    notOnX: 'Bitte auf einer Twitter/X-Seite verwenden',
    hoverFirst: 'Mit der Maus über einen Post gehen oder den Tab neu laden',
    cardOpened: 'Karte erstellt',
  },
  fr: {
    toggleTitle: 'Bouton carte sur le post',
    toggleDesc: 'Affiche le bouton de création de carte dans la barre d’actions du post',
    tip: 'Même masqué : survolez un post et appuyez sur <kbd>Alt</kbd> + <kbd>C</kbd> pour créer une carte.',
    trigger: 'Créer la carte de ce post',
    buttonEnabled: 'Bouton affiché',
    buttonHidden: 'Bouton masqué',
    noTabAccess: 'Accès à l’onglet impossible',
    noActiveTab: 'Aucun onglet actif',
    notOnX: 'À utiliser sur une page Twitter/X',
    hoverFirst: 'Survolez un post ou rechargez l’onglet',
    cardOpened: 'Carte créée',
  },
  es: {
    toggleTitle: 'Botón de tarjeta en el post',
    toggleDesc: 'Muestra el botón de crear tarjeta en la barra de acciones del post',
    tip: 'Aunque esté oculto: pasa el cursor por un post y pulsa <kbd>Alt</kbd> + <kbd>C</kbd> para crear la tarjeta.',
    trigger: 'Crear tarjeta de este post',
    buttonEnabled: 'Botón visible',
    buttonHidden: 'Botón oculto',
    noTabAccess: 'No se puede acceder a la pestaña',
    noActiveTab: 'No hay pestaña activa',
    notOnX: 'Úsalo en una página de Twitter/X',
    hoverFirst: 'Pasa el cursor por un post o recarga la pestaña',
    cardOpened: 'Tarjeta creada',
  },
  it: {
    toggleTitle: 'Pulsante card sul post',
    toggleDesc: 'Mostra il pulsante per creare la card nella barra azioni del post',
    tip: 'Anche se nascosto: passa il cursore su un post e premi <kbd>Alt</kbd> + <kbd>C</kbd> per creare la card.',
    trigger: 'Crea la card di questo post',
    buttonEnabled: 'Pulsante visibile',
    buttonHidden: 'Pulsante nascosto',
    noTabAccess: 'Impossibile accedere alla scheda',
    noActiveTab: 'Nessuna scheda attiva',
    notOnX: 'Usa questa funzione su una pagina Twitter/X',
    hoverFirst: 'Passa il cursore su un post o ricarica la scheda',
    cardOpened: 'Card creata',
  },
  'pt-BR': {
    toggleTitle: 'Botão de cartão no post',
    toggleDesc: 'Mostra o botão de criar cartão na barra de ações do post',
    tip: 'Mesmo oculto: passe o cursor sobre um post e pressione <kbd>Alt</kbd> + <kbd>C</kbd> para criar o cartão.',
    trigger: 'Criar cartão deste post',
    buttonEnabled: 'Botão visível',
    buttonHidden: 'Botão oculto',
    noTabAccess: 'Sem acesso à aba',
    noActiveTab: 'Nenhuma aba ativa',
    notOnX: 'Use em uma página do Twitter/X',
    hoverFirst: 'Passe o cursor sobre um post ou recarregue a aba',
    cardOpened: 'Cartão criado',
  },
  ru: {
    toggleTitle: 'Кнопка карточки у поста',
    toggleDesc: 'Показывает кнопку создания карточки в панели действий поста',
    tip: 'Даже скрытая: наведите курсор на пост и нажмите <kbd>Alt</kbd> + <kbd>C</kbd>, чтобы создать карточку.',
    trigger: 'Создать карточку этого поста',
    buttonEnabled: 'Кнопка показана',
    buttonHidden: 'Кнопка скрыта',
    noTabAccess: 'Нет доступа к вкладке',
    noActiveTab: 'Активная вкладка не найдена',
    notOnX: 'Откройте страницу Twitter/X',
    hoverFirst: 'Наведите курсор на пост или перезагрузите вкладку',
    cardOpened: 'Карточка создана',
  },
  tr: {
    toggleTitle: 'Gönderi kartı düğmesi',
    toggleDesc: 'Gönderinin işlem çubuğunda kart oluşturma düğmesini gösterir',
    tip: 'Gizli olsa da bir gönderinin üzerine gelip <kbd>Alt</kbd> + <kbd>C</kbd> ile kart oluşturabilirsin.',
    trigger: 'Bu gönderinin kartını oluştur',
    buttonEnabled: 'Düğme gösterildi',
    buttonHidden: 'Düğme gizlendi',
    noTabAccess: 'Sekmeye erişilemiyor',
    noActiveTab: 'Etkin sekme bulunamadı',
    notOnX: 'Bir Twitter/X sayfasında kullan',
    hoverFirst: 'Bir gönderinin üzerine gel veya sekmeyi yenile',
    cardOpened: 'Kart oluşturuldu',
  },
  uk: {
    toggleTitle: 'Кнопка картки біля поста',
    toggleDesc: 'Показує кнопку створення картки в панелі дій поста',
    tip: 'Навіть прихована: наведіть курсор на пост і натисніть <kbd>Alt</kbd> + <kbd>C</kbd>, щоб створити картку.',
    trigger: 'Створити картку цього поста',
    buttonEnabled: 'Кнопку показано',
    buttonHidden: 'Кнопку приховано',
    noTabAccess: 'Немає доступу до вкладки',
    noActiveTab: 'Активної вкладки не знайдено',
    notOnX: 'Відкрийте сторінку Twitter/X',
    hoverFirst: 'Наведіть курсор на пост або перезавантажте вкладку',
    cardOpened: 'Картку створено',
  },
  id: {
    toggleTitle: 'Tombol kartu postingan',
    toggleDesc: 'Menampilkan tombol pembuat kartu di bilah aksi postingan',
    tip: 'Meski disembunyikan, arahkan kursor ke postingan dan tekan <kbd>Alt</kbd> + <kbd>C</kbd> untuk membuat kartu.',
    trigger: 'Buat kartu postingan ini',
    buttonEnabled: 'Tombol ditampilkan',
    buttonHidden: 'Tombol disembunyikan',
    noTabAccess: 'Tidak bisa mengakses tab',
    noActiveTab: 'Tidak ada tab aktif',
    notOnX: 'Gunakan di halaman Twitter/X',
    hoverFirst: 'Arahkan kursor ke postingan atau muat ulang tab',
    cardOpened: 'Kartu dibuat',
  },
};
