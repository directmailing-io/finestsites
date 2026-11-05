/*! FinestSites Besucher-Chat v1 — docs/chat/konzept.md. Vanilla JS (ES2018), Shadow DOM. Einziges externes Laden: unsichtbare Cloudflare-Prüfung (iframe app.finestsites.io/api/chat-check) vor einem neuen Gespräch. */
(function () {
  'use strict';
  if (window.__fsChat) return;
  window.__fsChat = true;

  var API = '/.finestsites/chat/';
  // Unsichtbare Cloudflare-Turnstile-Prüfung vor einem neuen Gespräch (src/app/api/chat-check/route.ts)
  var CHECK_ORIGIN = 'https://app.finestsites.io';
  var CHECK_URL = CHECK_ORIGIN + '/api/chat-check';
  var CHECK_TIMEOUT_MS = 8000, CHECK_MAX_AGE_MS = 240000;
  var TOKEN_KEY = 'fs_chat_token';
  var HO_KEY = 'fs_chat_handoff_dismissed';
  // Sprache = die auf der Seite gewählte (html[data-lang], sonst html[lang]); folgt dem Sprachwechsel live (MutationObserver unten)
  function pageLang() {
    var h = document.documentElement;
    var l = String(h.getAttribute('data-lang') || h.lang || 'de').toLowerCase().split('-')[0];
    return T[l] ? l : 'de';
  }
  var REDUCED = false;
  try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var UA = navigator.userAgent || '';
  // In-App-Browser (Instagram, Facebook, Threads, TikTok, …): eigener Speicher je Browser → Übergabe-Karte
  var IAB = /Instagram|FBAN|FBAV|FB_IAB|FB4A|Threads|Barcelona|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest|Line\//i.exec(UA);
  var IOS = /iPhone|iPad|iPod/.test(UA), ANDROID = /Android/.test(UA);

  /* i18n:start – generiert aus public/chat-widget/i18n/*.json via scripts/build-chat-widget-i18n.mjs, nicht von Hand ändern */
  var T = {
    "de": {
      "open": "Chat öffnen",
      "close": "Chat schließen",
      "online": "online",
      "wa": "Schreib mir direkt in WhatsApp",
      "placeholder": "Nachricht schreiben …",
      "send": "Senden",
      "hint": "Nur in diesem Browser gespeichert.",
      "privacy": "Datenschutz",
      "notice": "Dieser Chat wird in diesem Browser gespeichert. Nach deiner ersten Nachricht bekommst du einen Code, mit dem du ihn auf jedem Gerät wieder öffnen kannst. Wichtiges schickst du mir am besten {via}.",
      "ccTitle": "Dein Gesprächs-Code",
      "ccText": "Damit öffnest du dieses Gespräch auf jedem Gerät wieder – am besten einen Screenshot machen. Gib den Code nicht weiter.",
      "ccCopy": "Code kopieren",
      "ccCopied": "Code kopiert",
      "rsQ": "Schon ein Gespräch begonnen?",
      "rsLink": "Mit Code fortsetzen",
      "rsPh": "Code, z. B. 7K4M-2P9X",
      "rsGo": "Fortsetzen",
      "rsBad": "Code nicht gefunden – bitte prüfen.",
      "rsOld": "Dieser Code ist abgelaufen.",
      "rsMany": "Zu viele Versuche. Bitte in 10 Minuten nochmal.",
      "rsDone": "Gespräch fortgesetzt",
      "viaWa": "per WhatsApp oder über das Kontaktformular",
      "viaForm": "über das Kontaktformular",
      "today": "Heute",
      "yesterday": "Gestern",
      "failed": "Nicht gesendet",
      "retry": "Erneut senden",
      "rejected": "Diese Nachricht kann nicht gesendet werden.",
      "wait": "Bitte kurz warten.",
      "blocked": "Dieser Chat ist nicht verfügbar.",
      "copied": "Link kopiert",
      "copy": "Link kopieren",
      "profile": "Damit ich dich erreiche (optional)",
      "name": "Name",
      "email": "E-Mail",
      "phone": "Telefon / WhatsApp",
      "notify": "Antworten per E-Mail erhalten",
      "save": "Speichern",
      "saved": "Gespeichert",
      "unsub": "Du bekommst keine E-Mails mehr zu diesem Chat.",
      "offline": "Keine Verbindung.",
      "sent": "Gesendet",
      "read": "Gelesen",
      "sending": "Wird gesendet",
      "unread": "ungelesene Nachrichten",
      "you": "Du",
      "mailLink": "Chat-Link per E-Mail schicken",
      "mailSent": "E-Mail ist unterwegs",
      "later": "Bitte später nochmal",
      "hoApp": "In-App-Browser",
      "hoBrowser": "deinem Browser",
      "hoTitle": "Du bist im {app}-Browser.",
      "hoText": "Damit du später wieder in diesen Chat kommst, öffne ihn in {browser}.",
      "hoOpenIos": "In Safari öffnen",
      "hoOpen": "Im Browser öffnen",
      "dismiss": "Hinweis schließen",
      "hoMenuIos": "Oder tippe oben rechts auf ⋯ und „In Safari öffnen“.",
      "hoMenu": "Oder tippe oben rechts auf ⋮ und „Im Browser öffnen“.",
      "hoFail": "Link konnte nicht erstellt werden.",
      "paused": "Pausiert – tippe, um zu aktualisieren",
      "welcome": "Hi! Schreib mir gern, ich antworte so schnell ich kann."
    },
    "en": {
      "open": "Open chat",
      "close": "Close chat",
      "online": "online",
      "wa": "Message me directly on WhatsApp",
      "placeholder": "Write a message …",
      "send": "Send",
      "hint": "Stored only in this browser.",
      "privacy": "Privacy",
      "notice": "This chat is stored in this browser. After your first message you get a code that reopens it on any device. For anything important, use {via}.",
      "ccTitle": "Your conversation code",
      "ccText": "Use it to reopen this chat on any device – a screenshot is the easiest way to keep it. Do not share the code.",
      "ccCopy": "Copy code",
      "ccCopied": "Code copied",
      "rsQ": "Already started a chat?",
      "rsLink": "Continue with code",
      "rsPh": "Code, e.g. 7K4M-2P9X",
      "rsGo": "Continue",
      "rsBad": "Code not found – please check it.",
      "rsOld": "This code has expired.",
      "rsMany": "Too many attempts. Please try again in 10 minutes.",
      "rsDone": "Conversation restored",
      "viaWa": "WhatsApp or the contact form",
      "viaForm": "the contact form",
      "today": "Today",
      "yesterday": "Yesterday",
      "failed": "Not sent",
      "retry": "Send again",
      "rejected": "This message cannot be sent.",
      "wait": "Please wait a moment.",
      "blocked": "This chat is not available.",
      "copied": "Link copied",
      "copy": "Copy link",
      "profile": "So I can reach you (optional)",
      "name": "Name",
      "email": "E-mail",
      "phone": "Phone / WhatsApp",
      "notify": "Receive replies by e-mail",
      "save": "Save",
      "saved": "Saved",
      "unsub": "You will no longer receive e-mails about this chat.",
      "offline": "No connection.",
      "sent": "Sent",
      "read": "Read",
      "sending": "Sending",
      "unread": "unread messages",
      "you": "You",
      "mailLink": "Send chat link by e-mail",
      "mailSent": "E-mail is on its way",
      "later": "Please try again later",
      "hoApp": "in-app",
      "hoBrowser": "your browser",
      "hoTitle": "You are in the {app} browser.",
      "hoText": "To get back to this chat later, open it in {browser}.",
      "hoOpenIos": "Open in Safari",
      "hoOpen": "Open in browser",
      "dismiss": "Dismiss",
      "hoMenuIos": "Or tap ⋯ at the top right and choose “Open in Safari”.",
      "hoMenu": "Or tap ⋮ at the top right and choose “Open in browser”.",
      "hoFail": "The link could not be created.",
      "paused": "Paused – tap to refresh",
      "welcome": "Hi! Feel free to write to me, I'll reply as fast as I can."
    },
    "it": {
      "open": "Apri la chat",
      "close": "Chiudi la chat",
      "online": "online",
      "wa": "Scrivimi direttamente su WhatsApp",
      "placeholder": "Scrivi un messaggio …",
      "send": "Invia",
      "hint": "Salvata solo in questo browser.",
      "privacy": "Privacy",
      "notice": "Questa chat viene salvata in questo browser. Dopo il tuo primo messaggio ricevi un codice con cui puoi riaprirla su qualsiasi dispositivo. Le cose importanti è meglio che me le scrivi {via}.",
      "ccTitle": "Il tuo codice della conversazione",
      "ccText": "Con questo codice riapri la conversazione su qualsiasi dispositivo: la cosa migliore è fare uno screenshot. Non condividere il codice.",
      "ccCopy": "Copia codice",
      "ccCopied": "Codice copiato",
      "rsQ": "Hai già iniziato una conversazione?",
      "rsLink": "Continua con il codice",
      "rsPh": "Codice, ad es. 7K4M-2P9X",
      "rsGo": "Continua",
      "rsBad": "Codice non trovato, controllalo.",
      "rsOld": "Questo codice è scaduto.",
      "rsMany": "Troppi tentativi. Riprova tra 10 minuti.",
      "rsDone": "Conversazione ripresa",
      "viaWa": "su WhatsApp o tramite il modulo di contatto",
      "viaForm": "tramite il modulo di contatto",
      "today": "Oggi",
      "yesterday": "Ieri",
      "failed": "Non inviato",
      "retry": "Invia di nuovo",
      "rejected": "Questo messaggio non può essere inviato.",
      "wait": "Aspetta un attimo.",
      "blocked": "Questa chat non è disponibile.",
      "copied": "Link copiato",
      "copy": "Copia link",
      "profile": "Così posso contattarti (facoltativo)",
      "name": "Nome",
      "email": "E-mail",
      "phone": "Telefono / WhatsApp",
      "notify": "Ricevi le risposte via e-mail",
      "save": "Salva",
      "saved": "Salvato",
      "unsub": "Non riceverai più e-mail su questa chat.",
      "offline": "Nessuna connessione.",
      "sent": "Inviato",
      "read": "Letto",
      "sending": "Invio in corso",
      "unread": "da leggere",
      "you": "Tu",
      "mailLink": "Invia il link della chat via e-mail",
      "mailSent": "L’e-mail è in arrivo",
      "later": "Riprova più tardi",
      "hoApp": "un’app",
      "hoBrowser": "il tuo browser",
      "hoTitle": "Sei nel browser di {app}.",
      "hoText": "Per tornare a questa chat più tardi, aprila con {browser}.",
      "hoOpenIos": "Apri in Safari",
      "hoOpen": "Apri nel browser",
      "dismiss": "Chiudi avviso",
      "hoMenuIos": "Oppure tocca ⋯ in alto a destra e scegli “Apri in Safari”.",
      "hoMenu": "Oppure tocca ⋮ in alto a destra e scegli “Apri nel browser”.",
      "hoFail": "Impossibile creare il link.",
      "paused": "In pausa, tocca per aggiornare",
      "welcome": "Ciao! Scrivimi pure, ti rispondo il prima possibile."
    },
    "ru": {
      "open": "Открыть чат",
      "close": "Закрыть чат",
      "online": "в сети",
      "wa": "Напиши мне прямо в WhatsApp",
      "placeholder": "Напиши сообщение …",
      "send": "Отправить",
      "hint": "Сохраняется только в этом браузере.",
      "privacy": "Конфиденциальность",
      "notice": "Этот чат сохраняется в этом браузере. После первого сообщения ты получишь код, с которым сможешь снова открыть его на любом устройстве. Что-то важное лучше присылай мне {via}.",
      "ccTitle": "Твой код разговора",
      "ccText": "С ним ты снова откроешь этот разговор на любом устройстве. Лучше всего сделай скриншот. Никому не передавай код.",
      "ccCopy": "Копировать код",
      "ccCopied": "Код скопирован",
      "rsQ": "Разговор уже начат?",
      "rsLink": "Продолжить по коду",
      "rsPh": "Код, например 7K4M-2P9X",
      "rsGo": "Продолжить",
      "rsBad": "Код не найден, проверь его.",
      "rsOld": "Срок действия этого кода истёк.",
      "rsMany": "Слишком много попыток. Попробуй снова через 10 минут.",
      "rsDone": "Разговор продолжен",
      "viaWa": "через WhatsApp или через контактную форму",
      "viaForm": "через контактную форму",
      "today": "Сегодня",
      "yesterday": "Вчера",
      "failed": "Не отправлено",
      "retry": "Отправить снова",
      "rejected": "Это сообщение нельзя отправить.",
      "wait": "Подожди немного.",
      "blocked": "Этот чат недоступен.",
      "copied": "Ссылка скопирована",
      "copy": "Копировать ссылку",
      "profile": "Чтобы связаться с тобой (необязательно)",
      "name": "Имя",
      "email": "E-mail",
      "phone": "Телефон / WhatsApp",
      "notify": "Получать ответы по e-mail",
      "save": "Сохранить",
      "saved": "Сохранено",
      "unsub": "Ты больше не будешь получать письма об этом чате.",
      "offline": "Нет соединения.",
      "sent": "Отправлено",
      "read": "Прочитано",
      "sending": "Отправляется",
      "unread": "непрочитанных",
      "you": "Ты",
      "mailLink": "Отправить ссылку на чат по e-mail",
      "mailSent": "Письмо уже в пути",
      "later": "Попробуй позже",
      "hoApp": "приложения",
      "hoBrowser": "своём браузере",
      "hoTitle": "Ты во встроенном браузере {app}.",
      "hoText": "Чтобы потом вернуться в этот чат, открой его в {browser}.",
      "hoOpenIos": "Открыть в Safari",
      "hoOpen": "Открыть в браузере",
      "dismiss": "Закрыть подсказку",
      "hoMenuIos": "Или нажми ⋯ вверху справа и выбери «Открыть в Safari».",
      "hoMenu": "Или нажми ⋮ вверху справа и выбери «Открыть в браузере».",
      "hoFail": "Не удалось создать ссылку.",
      "paused": "На паузе, нажми, чтобы обновить",
      "welcome": "Привет! Пиши мне, отвечу как можно скорее."
    },
    "uk": {
      "open": "Відкрити чат",
      "close": "Закрити чат",
      "online": "онлайн",
      "wa": "Напиши мені одразу у WhatsApp",
      "placeholder": "Напиши повідомлення …",
      "send": "Надіслати",
      "hint": "Зберігається лише в цьому браузері.",
      "privacy": "Конфіденційність",
      "notice": "Цей чат зберігається в цьому браузері. Після першого повідомлення ти отримаєш код, з яким зможеш знову відкрити його на будь-якому пристрої. Щось важливе краще надсилай мені {via}.",
      "ccTitle": "Твій код розмови",
      "ccText": "З ним ти знову відкриєш цю розмову на будь-якому пристрої. Найкраще зроби скриншот. Нікому не передавай код.",
      "ccCopy": "Копіювати код",
      "ccCopied": "Код скопійовано",
      "rsQ": "Розмову вже розпочато?",
      "rsLink": "Продовжити за кодом",
      "rsPh": "Код, наприклад 7K4M-2P9X",
      "rsGo": "Продовжити",
      "rsBad": "Код не знайдено, перевір його.",
      "rsOld": "Термін дії цього коду минув.",
      "rsMany": "Забагато спроб. Спробуй ще раз за 10 хвилин.",
      "rsDone": "Розмову продовжено",
      "viaWa": "через WhatsApp або через контактну форму",
      "viaForm": "через контактну форму",
      "today": "Сьогодні",
      "yesterday": "Учора",
      "failed": "Не надіслано",
      "retry": "Надіслати знову",
      "rejected": "Це повідомлення не можна надіслати.",
      "wait": "Зачекай трохи.",
      "blocked": "Цей чат недоступний.",
      "copied": "Посилання скопійовано",
      "copy": "Копіювати посилання",
      "profile": "Щоб зв’язатися з тобою (необов’язково)",
      "name": "Ім’я",
      "email": "E-mail",
      "phone": "Телефон / WhatsApp",
      "notify": "Отримувати відповіді на e-mail",
      "save": "Зберегти",
      "saved": "Збережено",
      "unsub": "Ти більше не отримуватимеш листів щодо цього чату.",
      "offline": "Немає з’єднання.",
      "sent": "Надіслано",
      "read": "Прочитано",
      "sending": "Надсилається",
      "unread": "непрочитаних",
      "you": "Ти",
      "mailLink": "Надіслати посилання на чат на e-mail",
      "mailSent": "Лист уже в дорозі",
      "later": "Спробуй пізніше",
      "hoApp": "застосунку",
      "hoBrowser": "своєму браузері",
      "hoTitle": "Ти у вбудованому браузері {app}.",
      "hoText": "Щоб пізніше повернутися до цього чату, відкрий його в {browser}.",
      "hoOpenIos": "Відкрити в Safari",
      "hoOpen": "Відкрити в браузері",
      "dismiss": "Закрити підказку",
      "hoMenuIos": "Або торкнися ⋯ угорі праворуч і вибери «Відкрити в Safari».",
      "hoMenu": "Або торкнися ⋮ угорі праворуч і вибери «Відкрити в браузері».",
      "hoFail": "Не вдалося створити посилання.",
      "paused": "Призупинено, торкнися, щоб оновити",
      "welcome": "Привіт! Пиши мені, відповім якнайшвидше."
    },
    "pl": {
      "open": "Otwórz czat",
      "close": "Zamknij czat",
      "online": "online",
      "wa": "Napisz do mnie bezpośrednio przez WhatsApp",
      "placeholder": "Napisz wiadomość …",
      "send": "Wyślij",
      "hint": "Zapisany tylko w tej przeglądarce.",
      "privacy": "Ochrona danych",
      "notice": "Ten czat jest zapisywany w tej przeglądarce. Po pierwszej wiadomości dostaniesz kod, dzięki któremu otworzysz go ponownie na każdym urządzeniu. Ważne sprawy najlepiej przesyłaj mi {via}.",
      "ccTitle": "Twój kod rozmowy",
      "ccText": "Dzięki niemu otworzysz tę rozmowę ponownie na każdym urządzeniu. Najlepiej zrób zrzut ekranu. Nie przekazuj nikomu tego kodu.",
      "ccCopy": "Kopiuj kod",
      "ccCopied": "Kod skopiowany",
      "rsQ": "Masz już rozpoczętą rozmowę?",
      "rsLink": "Kontynuuj z kodem",
      "rsPh": "Kod, np. 7K4M-2P9X",
      "rsGo": "Kontynuuj",
      "rsBad": "Nie znaleziono kodu. Sprawdź go, proszę.",
      "rsOld": "Ten kod wygasł.",
      "rsMany": "Zbyt wiele prób. Spróbuj ponownie za 10 minut.",
      "rsDone": "Rozmowa wznowiona",
      "viaWa": "przez WhatsApp lub formularz kontaktowy",
      "viaForm": "przez formularz kontaktowy",
      "today": "Dzisiaj",
      "yesterday": "Wczoraj",
      "failed": "Nie wysłano",
      "retry": "Wyślij ponownie",
      "rejected": "Tej wiadomości nie można wysłać.",
      "wait": "Poczekaj chwilę.",
      "blocked": "Ten czat jest niedostępny.",
      "copied": "Link skopiowany",
      "copy": "Kopiuj link",
      "profile": "Jak mogę się z tobą skontaktować? (opcjonalnie)",
      "name": "Imię",
      "email": "E-mail",
      "phone": "Telefon / WhatsApp",
      "notify": "Otrzymuj odpowiedzi e-mailem",
      "save": "Zapisz",
      "saved": "Zapisano",
      "unsub": "Nie będziesz już dostawać e-maili dotyczących tego czatu.",
      "offline": "Brak połączenia.",
      "sent": "Wysłano",
      "read": "Przeczytano",
      "sending": "Wysyłanie",
      "unread": "nieprzeczytane wiadomości",
      "you": "Ty",
      "mailLink": "Wyślij link do czatu e-mailem",
      "mailSent": "E-mail jest w drodze",
      "later": "Spróbuj ponownie później",
      "hoApp": "wbudowanej w aplikację",
      "hoBrowser": "swojej przeglądarce",
      "hoTitle": "Jesteś w przeglądarce {app}.",
      "hoText": "Aby później wrócić do tego czatu, otwórz go w {browser}.",
      "hoOpenIos": "Otwórz w Safari",
      "hoOpen": "Otwórz w przeglądarce",
      "dismiss": "Zamknij wskazówkę",
      "hoMenuIos": "Albo stuknij ⋯ w prawym górnym rogu i wybierz „Otwórz w Safari”.",
      "hoMenu": "Albo stuknij ⋮ w prawym górnym rogu i wybierz „Otwórz w przeglądarce”.",
      "hoFail": "Nie udało się utworzyć linku.",
      "paused": "Wstrzymane. Stuknij, aby odświeżyć",
      "welcome": "Cześć! Śmiało pisz, odpowiem tak szybko, jak się da."
    },
    "bg": {
      "open": "Отвори чата",
      "close": "Затвори чата",
      "online": "онлайн",
      "wa": "Пиши ми директно в WhatsApp",
      "placeholder": "Напиши съобщение …",
      "send": "Изпрати",
      "hint": "Запазва се само в този браузър.",
      "privacy": "Поверителност",
      "notice": "Този чат се запазва в този браузър. След първото си съобщение ще получиш код, с който можеш да го отвориш отново на всяко устройство. Ако е нещо важно, най-добре ми пиши {via}.",
      "ccTitle": "Твоят код за разговора",
      "ccText": "С него отваряш този разговор отново на всяко устройство. Най-добре направи екранна снимка. Не давай кода на никого.",
      "ccCopy": "Копирай кода",
      "ccCopied": "Кодът е копиран",
      "rsQ": "Вече започна разговор?",
      "rsLink": "Продължи с код",
      "rsPh": "Код, напр. 7K4M-2P9X",
      "rsGo": "Продължи",
      "rsBad": "Кодът не е намерен. Провери го, моля.",
      "rsOld": "Този код е изтекъл.",
      "rsMany": "Твърде много опити. Опитай пак след 10 минути.",
      "rsDone": "Разговорът е възстановен",
      "viaWa": "в WhatsApp или чрез формата за контакт",
      "viaForm": "чрез формата за контакт",
      "today": "Днес",
      "yesterday": "Вчера",
      "failed": "Не е изпратено",
      "retry": "Изпрати отново",
      "rejected": "Това съобщение не може да бъде изпратено.",
      "wait": "Изчакай малко.",
      "blocked": "Този чат не е достъпен.",
      "copied": "Линкът е копиран",
      "copy": "Копирай линка",
      "profile": "За да мога да се свържа с теб (по желание)",
      "name": "Име",
      "email": "Имейл",
      "phone": "Телефон / WhatsApp",
      "notify": "Получавай отговорите по имейл",
      "save": "Запази",
      "saved": "Запазено",
      "unsub": "Вече няма да получаваш имейли за този чат.",
      "offline": "Няма връзка.",
      "sent": "Изпратено",
      "read": "Прочетено",
      "sending": "Изпраща се",
      "unread": "непрочетени съобщения",
      "you": "Ти",
      "mailLink": "Изпрати линка към чата по имейл",
      "mailSent": "Имейлът е на път",
      "later": "Опитай пак по-късно",
      "hoApp": "приложението",
      "hoBrowser": "своя браузър",
      "hoTitle": "Намираш се в браузъра на {app}.",
      "hoText": "За да се върнеш по-късно в този чат, отвори го в {browser}.",
      "hoOpenIos": "Отвори в Safari",
      "hoOpen": "Отвори в браузъра",
      "dismiss": "Затвори",
      "hoMenuIos": "Или докосни ⋯ горе вдясно и избери „Отвори в Safari“.",
      "hoMenu": "Или докосни ⋮ горе вдясно и избери „Отвори в браузъра“.",
      "hoFail": "Линкът не можа да бъде създаден.",
      "paused": "На пауза. Докосни, за да обновиш",
      "welcome": "Здравей! Пиши ми спокойно, ще отговоря възможно най-бързо."
    },
    "hi": {
      "open": "चैट खोलें",
      "close": "चैट बंद करें",
      "online": "ऑनलाइन",
      "wa": "मुझे सीधे WhatsApp पर मैसेज करें",
      "placeholder": "मैसेज लिखें …",
      "send": "भेजें",
      "hint": "सिर्फ़ इसी ब्राउज़र में सेव है।",
      "privacy": "प्राइवेसी",
      "notice": "यह चैट इसी ब्राउज़र में सेव होती है। आपके पहले मैसेज के बाद आपको एक कोड मिलेगा, जिससे आप इसे किसी भी डिवाइस पर फिर से खोल सकते हैं। कोई ज़रूरी बात हो तो मुझे {via} भेजें।",
      "ccTitle": "आपका बातचीत कोड",
      "ccText": "इससे आप यह बातचीत किसी भी डिवाइस पर फिर से खोल सकते हैं। सबसे अच्छा है कि आप इसका स्क्रीनशॉट ले लें। यह कोड किसी को न दें।",
      "ccCopy": "कोड कॉपी करें",
      "ccCopied": "कोड कॉपी हो गया",
      "rsQ": "पहले से बातचीत शुरू की है?",
      "rsLink": "कोड से जारी रखें",
      "rsPh": "कोड, जैसे 7K4M-2P9X",
      "rsGo": "जारी रखें",
      "rsBad": "कोड नहीं मिला। कृपया जाँच लें।",
      "rsOld": "यह कोड एक्सपायर हो चुका है।",
      "rsMany": "बहुत ज़्यादा कोशिशें। कृपया 10 मिनट बाद फिर से कोशिश करें।",
      "rsDone": "बातचीत फिर से शुरू हो गई",
      "viaWa": "WhatsApp या कॉन्टैक्ट फ़ॉर्म से",
      "viaForm": "कॉन्टैक्ट फ़ॉर्म से",
      "today": "आज",
      "yesterday": "कल",
      "failed": "नहीं भेजा गया",
      "retry": "फिर से भेजें",
      "rejected": "यह मैसेज नहीं भेजा जा सकता।",
      "wait": "कृपया थोड़ा रुकें।",
      "blocked": "यह चैट उपलब्ध नहीं है।",
      "copied": "लिंक कॉपी हो गया",
      "copy": "लिंक कॉपी करें",
      "profile": "ताकि मैं आपसे संपर्क कर सकूँ (वैकल्पिक)",
      "name": "नाम",
      "email": "ई-मेल",
      "phone": "फ़ोन / WhatsApp",
      "notify": "जवाब ई-मेल पर पाएँ",
      "save": "सेव करें",
      "saved": "सेव हो गया",
      "unsub": "अब आपको इस चैट के बारे में ई-मेल नहीं मिलेंगे।",
      "offline": "कोई कनेक्शन नहीं।",
      "sent": "भेजा गया",
      "read": "पढ़ा गया",
      "sending": "भेजा जा रहा है",
      "unread": "अपठित मैसेज",
      "you": "आप",
      "mailLink": "चैट लिंक ई-मेल से भेजें",
      "mailSent": "ई-मेल भेज दिया गया है",
      "later": "कृपया बाद में फिर से कोशिश करें",
      "hoApp": "इन-ऐप",
      "hoBrowser": "अपने ब्राउज़र",
      "hoTitle": "आप {app} ब्राउज़र में हैं।",
      "hoText": "बाद में इस चैट पर वापस आने के लिए इसे {browser} में खोलें।",
      "hoOpenIos": "Safari में खोलें",
      "hoOpen": "ब्राउज़र में खोलें",
      "dismiss": "बंद करें",
      "hoMenuIos": "या ऊपर दाईं ओर ⋯ पर टैप करें और “Safari में खोलें” चुनें।",
      "hoMenu": "या ऊपर दाईं ओर ⋮ पर टैप करें और “ब्राउज़र में खोलें” चुनें।",
      "hoFail": "लिंक नहीं बन सका।",
      "paused": "रुका हुआ है, रीफ़्रेश करने के लिए टैप करें",
      "welcome": "नमस्ते! बेझिझक मैसेज करें, जल्द से जल्द जवाब मिलेगा।"
    },
    "tr": {
      "open": "Sohbeti aç",
      "close": "Sohbeti kapat",
      "online": "çevrimiçi",
      "wa": "Bana doğrudan WhatsApp’tan yaz",
      "placeholder": "Mesaj yaz …",
      "send": "Gönder",
      "hint": "Sadece bu tarayıcıda kaydedilir.",
      "privacy": "Gizlilik",
      "notice": "Bu sohbet bu tarayıcıda kaydedilir. İlk mesajından sonra bir kod alırsın, bu kodla sohbeti her cihazda yeniden açabilirsin. Önemli konuları bana en iyisi {via} ilet.",
      "ccTitle": "Sohbet kodun",
      "ccText": "Bu kodla sohbeti her cihazda yeniden açabilirsin. En iyisi ekran görüntüsü al. Kodu kimseyle paylaşma.",
      "ccCopy": "Kodu kopyala",
      "ccCopied": "Kod kopyalandı",
      "rsQ": "Daha önce sohbet başlattın mı?",
      "rsLink": "Kodla devam et",
      "rsPh": "Kod, örn. 7K4M-2P9X",
      "rsGo": "Devam et",
      "rsBad": "Kod bulunamadı, lütfen kontrol et.",
      "rsOld": "Bu kodun süresi dolmuş.",
      "rsMany": "Çok fazla deneme oldu. Lütfen 10 dakika sonra tekrar dene.",
      "rsDone": "Sohbet geri yüklendi",
      "viaWa": "WhatsApp’tan ya da iletişim formundan",
      "viaForm": "iletişim formundan",
      "today": "Bugün",
      "yesterday": "Dün",
      "failed": "Gönderilemedi",
      "retry": "Tekrar gönder",
      "rejected": "Bu mesaj gönderilemiyor.",
      "wait": "Lütfen biraz bekle.",
      "blocked": "Bu sohbet kullanılamıyor.",
      "copied": "Bağlantı kopyalandı",
      "copy": "Bağlantıyı kopyala",
      "profile": "Sana ulaşabilmem için (isteğe bağlı)",
      "name": "Ad",
      "email": "E-posta",
      "phone": "Telefon / WhatsApp",
      "notify": "Yanıtları e-postayla al",
      "save": "Kaydet",
      "saved": "Kaydedildi",
      "unsub": "Bu sohbetle ilgili artık e-posta almayacaksın.",
      "offline": "Bağlantı yok.",
      "sent": "Gönderildi",
      "read": "Okundu",
      "sending": "Gönderiliyor",
      "unread": "okunmamış mesaj",
      "you": "Sen",
      "mailLink": "Sohbet bağlantısını e-postayla gönder",
      "mailSent": "E-posta yolda",
      "later": "Lütfen daha sonra tekrar dene",
      "hoApp": "bir uygulama",
      "hoBrowser": "kendi tarayıcın",
      "hoTitle": "Şu an {app} içindeki tarayıcıdasın.",
      "hoText": "Bu sohbete sonra tekrar dönebilmek için onu {browser} ile aç.",
      "hoOpenIos": "Safari’de aç",
      "hoOpen": "Tarayıcıda aç",
      "dismiss": "Uyarıyı kapat",
      "hoMenuIos": "Ya da sağ üstteki ⋯ simgesine dokun ve “Safari’de aç” seçeneğini seç.",
      "hoMenu": "Ya da sağ üstteki ⋮ simgesine dokun ve “Tarayıcıda aç” seçeneğini seç.",
      "hoFail": "Bağlantı oluşturulamadı.",
      "paused": "Duraklatıldı, yenilemek için dokun",
      "welcome": "Merhaba! Bana rahatça yaz, en kısa sürede cevap veririm."
    },
    "sr": {
      "open": "Otvori čet",
      "close": "Zatvori čet",
      "online": "na mreži",
      "wa": "Piši mi direktno na WhatsApp-u",
      "placeholder": "Napiši poruku …",
      "send": "Pošalji",
      "hint": "Sačuvano samo u ovom pregledaču.",
      "privacy": "Privatnost",
      "notice": "Ovaj čet se čuva u ovom pregledaču. Posle prve poruke dobijaš kod kojim ga možeš ponovo otvoriti na bilo kom uređaju. Za važne stvari najbolje mi piši {via}.",
      "ccTitle": "Tvoj kod za razgovor",
      "ccText": "Pomoću njega ponovo otvaraš ovaj razgovor na bilo kom uređaju. Najlakše je da napraviš snimak ekrana. Ne daj kod nikome.",
      "ccCopy": "Kopiraj kod",
      "ccCopied": "Kod je kopiran",
      "rsQ": "Razgovor je već započet?",
      "rsLink": "Nastavi uz kod",
      "rsPh": "Kod, npr. 7K4M-2P9X",
      "rsGo": "Nastavi",
      "rsBad": "Kod nije pronađen. Proveri ga.",
      "rsOld": "Ovaj kod je istekao.",
      "rsMany": "Previše pokušaja. Probaj ponovo za 10 minuta.",
      "rsDone": "Razgovor je nastavljen",
      "viaWa": "preko WhatsApp-a ili kontakt forme",
      "viaForm": "preko kontakt forme",
      "today": "Danas",
      "yesterday": "Juče",
      "failed": "Nije poslato",
      "retry": "Pošalji ponovo",
      "rejected": "Ova poruka ne može da se pošalje.",
      "wait": "Sačekaj malo.",
      "blocked": "Ovaj čet nije dostupan.",
      "copied": "Link je kopiran",
      "copy": "Kopiraj link",
      "profile": "Da mogu da ti se javim (opciono)",
      "name": "Ime",
      "email": "Imejl",
      "phone": "Telefon / WhatsApp",
      "notify": "Primaj odgovore imejlom",
      "save": "Sačuvaj",
      "saved": "Sačuvano",
      "unsub": "Više nećeš dobijati imejlove o ovom četu.",
      "offline": "Nema veze.",
      "sent": "Poslato",
      "read": "Pročitano",
      "sending": "Šalje se",
      "unread": "nepročitane poruke",
      "you": "Ti",
      "mailLink": "Pošalji link četa imejlom",
      "mailSent": "Imejl je poslat",
      "later": "Pokušaj ponovo kasnije",
      "hoApp": "ugrađenom",
      "hoBrowser": "svoj pregledač",
      "hoTitle": "Sada si u {app} pregledaču.",
      "hoText": "Za povratak u ovaj čet kasnije koristi {browser}.",
      "hoOpenIos": "Otvori u Safariju",
      "hoOpen": "Otvori u pregledaču",
      "dismiss": "Zatvori",
      "hoMenuIos": "Ili dodirni ⋯ gore desno i izaberi „Otvori u Safariju“.",
      "hoMenu": "Ili dodirni ⋮ gore desno i izaberi „Otvori u pregledaču“.",
      "hoFail": "Link nije mogao da se napravi.",
      "paused": "Pauzirano, dodirni za osvežavanje",
      "welcome": "Ćao! Slobodno mi piši, odgovoriću što pre mogu."
    },
    "es": {
      "open": "Abrir chat",
      "close": "Cerrar chat",
      "online": "en línea",
      "wa": "Escríbeme directamente por WhatsApp",
      "placeholder": "Escribe un mensaje…",
      "send": "Enviar",
      "hint": "Solo se guarda en este navegador.",
      "privacy": "Privacidad",
      "notice": "Este chat se guarda en este navegador. Después de tu primer mensaje recibirás un código para volver a abrirlo en cualquier dispositivo. Si es algo importante, mejor escríbeme {via}.",
      "ccTitle": "Tu código de conversación",
      "ccText": "Con él vuelves a abrir esta conversación en cualquier dispositivo. Lo más fácil es hacer una captura de pantalla. No compartas el código con nadie.",
      "ccCopy": "Copiar código",
      "ccCopied": "Código copiado",
      "rsQ": "¿Ya has empezado una conversación?",
      "rsLink": "Continuar con código",
      "rsPh": "Código, p. ej. 7K4M-2P9X",
      "rsGo": "Continuar",
      "rsBad": "No encontramos ese código. Revísalo, por favor.",
      "rsOld": "Este código ha caducado.",
      "rsMany": "Demasiados intentos. Vuelve a probar dentro de 10 minutos.",
      "rsDone": "Conversación recuperada",
      "viaWa": "por WhatsApp o con el formulario de contacto",
      "viaForm": "con el formulario de contacto",
      "today": "Hoy",
      "yesterday": "Ayer",
      "failed": "No enviado",
      "retry": "Reenviar",
      "rejected": "Este mensaje no se puede enviar.",
      "wait": "Espera un momento, por favor.",
      "blocked": "Este chat no está disponible.",
      "copied": "Enlace copiado",
      "copy": "Copiar enlace",
      "profile": "Para poder contactarte (opcional)",
      "name": "Nombre",
      "email": "E-mail",
      "phone": "Teléfono / WhatsApp",
      "notify": "Recibir respuestas por e-mail",
      "save": "Guardar",
      "saved": "Guardado",
      "unsub": "Ya no recibirás más e-mails sobre este chat.",
      "offline": "Sin conexión.",
      "sent": "Enviado",
      "read": "Leído",
      "sending": "Enviando",
      "unread": "mensajes sin leer",
      "you": "Tú",
      "mailLink": "Enviarme el enlace del chat por e-mail",
      "mailSent": "El e-mail ya va de camino",
      "later": "Inténtalo más tarde",
      "hoApp": "una app",
      "hoBrowser": "tu navegador",
      "hoTitle": "Estás en el navegador de {app}.",
      "hoText": "Para poder volver a este chat más tarde, ábrelo en {browser}.",
      "hoOpenIos": "Abrir en Safari",
      "hoOpen": "Abrir en el navegador",
      "dismiss": "Cerrar aviso",
      "hoMenuIos": "O toca ⋯ arriba a la derecha y elige «Abrir en Safari».",
      "hoMenu": "O toca ⋮ arriba a la derecha y elige «Abrir en el navegador».",
      "hoFail": "No se ha podido crear el enlace.",
      "paused": "En pausa, toca para actualizar",
      "welcome": "¡Hola! Escríbeme sin compromiso, te respondo lo antes posible."
    },
    "zh": {
      "open": "打开聊天",
      "close": "关闭聊天",
      "online": "在线",
      "wa": "直接在WhatsApp上给我发消息",
      "placeholder": "输入消息……",
      "send": "发送",
      "hint": "只保存在这个浏览器里。",
      "privacy": "隐私政策",
      "notice": "这个聊天会保存在这个浏览器里。发出第一条消息后，你会拿到一个代码，用它可以在任何设备上重新打开这个聊天。重要的事情最好{via}发给我。",
      "ccTitle": "你的对话代码",
      "ccText": "用它可以在任何设备上重新打开这个对话，最方便的是截个图保存。不要把代码告诉别人。",
      "ccCopy": "复制代码",
      "ccCopied": "代码已复制",
      "rsQ": "之前已经聊过了？",
      "rsLink": "用代码继续聊",
      "rsPh": "代码，例如7K4M-2P9X",
      "rsGo": "继续",
      "rsBad": "找不到这个代码，请检查一下。",
      "rsOld": "这个代码已过期。",
      "rsMany": "尝试次数太多了，请10分钟后再试。",
      "rsDone": "对话已恢复",
      "viaWa": "通过WhatsApp或联系表单",
      "viaForm": "通过联系表单",
      "today": "今天",
      "yesterday": "昨天",
      "failed": "未发送",
      "retry": "重新发送",
      "rejected": "这条消息无法发送。",
      "wait": "请稍等一下。",
      "blocked": "这个聊天暂时不可用。",
      "copied": "链接已复制",
      "copy": "复制链接",
      "profile": "方便我联系你（选填）",
      "name": "姓名",
      "email": "电子邮箱",
      "phone": "电话/WhatsApp",
      "notify": "通过邮件接收回复",
      "save": "保存",
      "saved": "已保存",
      "unsub": "你不会再收到关于这个聊天的邮件了。",
      "offline": "没有网络连接。",
      "sent": "已发送",
      "read": "已读",
      "sending": "发送中",
      "unread": "条未读消息",
      "you": "你",
      "mailLink": "把聊天链接发到邮箱",
      "mailSent": "邮件已发出",
      "later": "请稍后再试",
      "hoApp": "App",
      "hoBrowser": "你的浏览器",
      "hoTitle": "你正在使用{app}内置浏览器。",
      "hoText": "为了以后还能回到这个聊天，请用{browser}打开。",
      "hoOpenIos": "在Safari中打开",
      "hoOpen": "在浏览器中打开",
      "dismiss": "关闭提示",
      "hoMenuIos": "或者点右上角的⋯，选择“在Safari中打开”。",
      "hoMenu": "或者点右上角的⋮，选择“在浏览器中打开”。",
      "hoFail": "链接生成失败。",
      "paused": "已暂停，点一下刷新",
      "welcome": "你好！有什么想问的尽管发消息，我会尽快回复你。"
    },
    "ko": {
      "open": "채팅 열기",
      "close": "채팅 닫기",
      "online": "온라인",
      "wa": "WhatsApp으로 바로 메시지 보내기",
      "placeholder": "메시지를 입력하세요 …",
      "send": "보내기",
      "hint": "이 브라우저에만 저장돼요.",
      "privacy": "개인정보 처리방침",
      "notice": "이 채팅은 이 브라우저에 저장돼요. 첫 메시지를 보내면 코드를 받는데, 이 코드로 어떤 기기에서든 채팅을 다시 열 수 있어요. 중요한 내용은 {via} 보내 주세요.",
      "ccTitle": "내 대화 코드",
      "ccText": "이 코드로 어떤 기기에서든 이 대화를 다시 열 수 있어요. 스크린샷으로 저장해 두면 가장 편해요. 코드는 다른 사람에게 알려 주지 마세요.",
      "ccCopy": "코드 복사",
      "ccCopied": "코드를 복사했어요",
      "rsQ": "이미 대화를 시작했나요?",
      "rsLink": "코드로 이어서 하기",
      "rsPh": "코드 (예: 7K4M-2P9X)",
      "rsGo": "이어서 하기",
      "rsBad": "코드를 찾을 수 없어요. 다시 확인해 주세요.",
      "rsOld": "만료된 코드예요.",
      "rsMany": "시도 횟수가 너무 많아요. 10분 뒤에 다시 해 주세요.",
      "rsDone": "대화를 다시 불러왔어요",
      "viaWa": "WhatsApp이나 문의 양식으로",
      "viaForm": "문의 양식으로",
      "today": "오늘",
      "yesterday": "어제",
      "failed": "전송 실패",
      "retry": "다시 보내기",
      "rejected": "이 메시지는 보낼 수 없어요.",
      "wait": "잠시만 기다려 주세요.",
      "blocked": "지금은 이 채팅을 이용할 수 없어요.",
      "copied": "링크를 복사했어요",
      "copy": "링크 복사",
      "profile": "제가 연락드릴 수 있도록 (선택)",
      "name": "이름",
      "email": "이메일",
      "phone": "전화 / WhatsApp",
      "notify": "답장을 이메일로 받기",
      "save": "저장",
      "saved": "저장했어요",
      "unsub": "이제 이 채팅에 관한 이메일은 더 이상 보내지 않아요.",
      "offline": "인터넷에 연결되어 있지 않아요.",
      "sent": "전송됨",
      "read": "읽음",
      "sending": "보내는 중",
      "unread": "읽지 않은 메시지",
      "you": "나",
      "mailLink": "채팅 링크를 이메일로 받기",
      "mailSent": "이메일을 보냈어요",
      "later": "잠시 후 다시 시도해 주세요",
      "hoApp": "인앱",
      "hoBrowser": "기본 브라우저",
      "hoTitle": "지금 {app} 브라우저로 보고 있어요.",
      "hoText": "나중에 이 채팅으로 다시 돌아오려면 {browser}에서 열어 주세요.",
      "hoOpenIos": "Safari에서 열기",
      "hoOpen": "브라우저에서 열기",
      "dismiss": "안내 닫기",
      "hoMenuIos": "또는 오른쪽 위의 ⋯를 누르고 ‘Safari에서 열기’를 선택해 주세요.",
      "hoMenu": "또는 오른쪽 위의 ⋮를 누르고 ‘브라우저에서 열기’를 선택해 주세요.",
      "hoFail": "링크를 만들지 못했어요.",
      "paused": "일시 중지됐어요. 눌러서 새로고침하세요",
      "welcome": "안녕하세요! 편하게 메시지 남겨 주세요. 최대한 빨리 답장드릴게요."
    }
  };
  /* i18n:end */
  var LANG = pageLang(), t = T[LANG];

  // ── Zustand ────────────────────────────────────────────────────────────────
  var cfg = null, token = null, tokenStored = false, convId = null, status = 'open';
  var ticket = null, sessionDone = false; // Ticket aus `session` (nur im Speicher), Header X-FS-Ticket bei schreibenden Aufrufen
  var cfTok = null, cfAt = 0, cfWait = null; // Turnstile-Token (einmal gültig), Zeitpunkt, laufende Prüfung
  var lastActivity = Date.now();          // letzte Interaktion/Nachricht → Polling-Abstand (geschlossen) + Ruhestopp
  var visitor = { name: null, email: null, phone: null, notifyByEmail: false };
  var messages = [];          // {id, sender, body, createdAt, readAt, clientId, state}
  var ownerSeen = null;       // ISO
  var ownerRead = null;       // ISO: bis hierhin hat der Betreiber gelesen (Feld ownerReadAt)
  var isOpen = false, pollTimer = null, started = false, blocked = false, mounted = false;
  // Polling: offen = Long-Poll-Schleife (wait=25), geschlossen = Timer 20/60 s; Ruhestopp nach 15/30 min ohne Interaktion
  var LONG_WAIT = 25, IDLE_OPEN = 15 * 60000, IDLE_CLOSED = 30 * 60000;
  var polling = false, pollAgain = false, pollCtl = null, pollGen = 0, pollFails = 0;
  var paused = false, idleTimer = null, pauseEl = null;
  var hoUrl = null, hoBusy = false, hoGone = false; // Übergabe-Karte (In-App-Browser)
  var code = null, rsOpen = false, rsBusy = false, rsErr = null, rsVal = ''; // Gesprächs-Code (Karte) + „Mit Code fortsetzen“
  var root, host, btn, badge, win, list, ta, sendBtn, hintEl, profileEl, statusEl, toastEl;

  // ── Helfer ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rnd(bytes) {
    var a = new Uint8Array(bytes), out = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return out;
  }
  function readToken() {
    try { var v = localStorage.getItem(TOKEN_KEY); if (v) return v; } catch (e) {}
    var m = document.cookie.match(/(?:^|; )fs_chat_token=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function storeToken(v) {
    tokenStored = true;
    try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {}
    try { document.cookie = TOKEN_KEY + '=' + encodeURIComponent(v) + '; Max-Age=' + (180 * 86400) + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
  }
  /** #rgb, #rrggbb, #rrggbbaa, rgb(…), rgba(…) → [r,g,b]; sonst null */
  function parseColor(v) {
    v = String(v || '').trim();
    var m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
    if (m) {
      var h = m[1];
      if (h.length <= 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(v);
    if (m) return [m[1], m[2], m[3]].map(function (n) { return Math.max(0, Math.min(255, Math.round(+n))); });
    return null;
  }
  /** Markenfarbe der Seite: erste gültige CSS-Variable auf body oder html, sonst brandColor des Kontos, sonst #111 */
  function pageBrand() {
    var names = ['--fs-primary', '--primary', '--accent', '--green', '--blue', '--brand'];
    var els = [document.body, document.documentElement];
    for (var i = 0; i < names.length; i++) for (var k = 0; k < els.length; k++) {
      try { var rgb = parseColor(getComputedStyle(els[k]).getPropertyValue(names[i])); if (rgb) return rgb; } catch (e) {}
    }
    return parseColor(cfg.owner && cfg.owner.brandColor) || [17, 17, 17];
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    try { return d.toLocaleTimeString(LANG === 'en' ? 'en-GB' : 'de-DE', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  function dayKey(iso) { var d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(iso) {
    var d = new Date(iso), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(iso) === dayKey(now)) return t.today;
    if (dayKey(iso) === dayKey(y)) return t.yesterday;
    var o = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    try { return d.toLocaleDateString(LANG === 'en' ? 'en-GB' : 'de-DE', o); } catch (e) { return d.toLocaleDateString(); }
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  var LINK_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
  function linkify(text) {
    var out = '', last = 0, m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(text))) {
      out += esc(text.slice(last, m.index));
      var url = m[1], href = /^www\./i.test(url) ? 'https://' + url : url;
      var shown = url.replace(/^https?:\/\//, '');
      if (shown.length > 42) shown = shown.slice(0, 40) + '…';
      out += '<span class="lk"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(shown) + '</a>' +
        '<button type="button" class="cp" data-copy="' + esc(href) + '" aria-label="' + t.copy + '" title="' + t.copy + '">' + ICON.copy + '</button></span>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }
  function api(name, opts) {
    opts = opts || {};
    var h = { Accept: 'application/json' };
    if (token) h['X-FS-Visitor'] = token;
    if (ticket && opts.method === 'POST' && name !== 'session') h['X-FS-Ticket'] = ticket;
    var init = { method: opts.method || 'GET', headers: h, credentials: 'same-origin' };
    if (opts.signal) init.signal = opts.signal;
    if (opts.body !== undefined) { h['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(API + name + (opts.query || ''), init).then(function (r) {
      return r.text().then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (r.status === 403 && j && j.error === 'BLOCKED') { setBlocked(); }
        return { ok: r.ok, status: r.status, json: j || {} };
      });
    });
  }
  /** Ticket per `session` holen (fehlt es in der Antwort, läuft alles ohne Header weiter). Lehnt nie ab. */
  function fetchTicket() {
    sessionDone = true;
    return api('session', { method: 'POST', body: { visitorToken: token, pageUrl: location.href } }).then(function (s) {
      if (s.ok) {
        if (typeof s.json.ticket === 'string' && s.json.ticket) ticket = s.json.ticket;
        if (s.json.conversationId && !convId) convId = s.json.conversationId;
      }
    }, function () {});
  }
  /** Schreibender Aufruf mit Ticket; bei 403 TICKET_REQUIRED/TICKET_INVALID einmal neues Ticket holen und wiederholen. */
  function apiT(name, opts) {
    var pre = (ticket || sessionDone) ? Promise.resolve() : fetchTicket();
    return pre.then(function () { return api(name, opts); }).then(function (r) {
      if (r.status !== 403 || !r.json || (r.json.error !== 'TICKET_REQUIRED' && r.json.error !== 'TICKET_INVALID')) return r;
      ticket = null;
      return fetchTicket().then(function () { return api(name, opts); });
    });
  }
  function hp() {
    var f = profileEl && profileEl.querySelector('form');
    return f && f.website ? String(f.website.value || '') : '';
  }
  function appName() {
    var s = IAB ? IAB[0].toLowerCase() : '';
    if (s === 'instagram') return 'Instagram';
    if (s.indexOf('fb') === 0) return 'Facebook';
    if (s === 'threads' || s === 'barcelona') return 'Threads';
    if (s === 'tiktok' || s === 'musical_ly') return 'TikTok';
    if (s === 'snapchat') return 'Snapchat';
    if (s === 'linkedinapp') return 'LinkedIn';
    if (s === 'pinterest') return 'Pinterest';
    if (s === 'line/') return 'LINE';
    return t.hoApp;
  }

  // ── Symbole ────────────────────────────────────────────────────────────────
  var ICON = {
    chat: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.9-.9L3 20l1.3-4.1A8 8 0 0 1 3.5 11.5 8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3z"/></svg>',
    chatf: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 3C6.9 3 3 6.5 3 11c0 2 .8 3.8 2.1 5.2L4 21l4.6-1.7c1 .3 2.2.5 3.4.5 5.1 0 9-3.5 9-8s-3.9-8-9-8z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4 8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6l.5-.5.3-.5v-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5h-.4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    tick: '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2"/></svg>',
    tick2: '<svg viewBox="0 0 20 12" width="18" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 6.5l3.2 3.2L11 3.2M8 9.2l1.2 1.2L15.5 3.2"/></svg>',
    clock: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.3 1.4"/></svg>',
    warn: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/></svg>'
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  function css(brand, brandText, brandSoft) {
    return ':host{all:initial;position:fixed;inset:auto 0 0 auto;z-index:2147483000;font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;-webkit-font-smoothing:antialiased;--b:' + brand + ';--bt:' + brandText + ';--bs:' + brandSoft + ';--fl:#F2F3F5;--hl:rgba(0,0,0,.06);--mu:#6B7280;--ln:#8A8F98}' +
    '*,*::before,*::after{box-sizing:border-box}button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;background:none;border:0;padding:0;margin:0}a{color:inherit}' +
    'button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--b);outline-offset:2px}' +
    '.fab{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));width:56px;height:56px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;transform:scale(.8);transition:transform .3s cubic-bezier(.2,.8,.3,1),opacity .3s,box-shadow .2s}' +
    '.fab.photo{background:#fff;color:#111;box-shadow:0 8px 24px rgba(0,0,0,.2),0 0 0 2px #fff}.fab.photo.open{background:var(--b);color:var(--bt)}.fab .c0{position:relative;width:100%;height:100%;align-items:center;justify-content:center}.fab .ph{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}.fab .bd{position:absolute;right:-3px;bottom:-3px;width:24px;height:24px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2.5px #fff}.fab .bd svg{width:13px;height:13px}.fab .in{font-weight:600;font-size:17px;letter-spacing:.02em}' +
    '.fab.in{opacity:1;transform:scale(1)}.fab:hover{box-shadow:0 10px 28px rgba(0,0,0,.22)}.fab:active{transform:scale(.96)}.fab:focus-visible{outline-offset:3px}' +
    '.fab .i{display:flex;transition:transform .25s,opacity .2s}.fab.open .i.c0{transform:rotate(90deg) scale(.4);opacity:0;position:absolute}.fab .i.c1{position:absolute;transform:rotate(-90deg) scale(.4);opacity:0}.fab.open .i.c1{transform:none;opacity:1;position:static}' +
    '.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#E5484D;color:#fff;font-size:11px;font-weight:700;line-height:20px;text-align:center;border:2px solid #fff;display:none}.badge.on{display:block}' +
    '.win{position:fixed;inset:0;background:#fff;display:none;flex-direction:column;overflow:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);opacity:0;transform:scale(.96);transform-origin:50% 100%;transition:opacity .2s,transform .2s cubic-bezier(.2,.8,.3,1)}' +
    '.win.show{display:flex}.win.in{opacity:1;transform:none}' +
    '@media(min-width:640px){.win{inset:auto max(20px,env(safe-area-inset-right)) max(88px,calc(env(safe-area-inset-bottom) + 88px)) auto;width:380px;height:min(640px,calc(100vh - 40px));max-height:calc(100vh - 108px);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.04);padding:0;transform-origin:100% 100%}}' +
    '.hd{display:flex;align-items:center;gap:12px;padding:12px 8px 12px 16px;border-bottom:1px solid var(--hl);background:#fff;flex:none}' +
    '.av{width:36px;height:36px;border-radius:50%;background:var(--fl);color:#111;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;overflow:hidden;flex:none;letter-spacing:.02em}.av img{width:100%;height:100%;object-fit:cover;display:block}' +
    // Kopf: Höhe immer 40 px (Schließen-Knopf) → Name mittig; Statuszeile nur bei „online“, kein Springen
    '.who{flex:1;min-width:0}.nm{font-weight:600;font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st{display:none;font-size:12px;line-height:1.3;color:var(--mu);align-items:center;gap:6px;margin-top:2px}.st.on{display:flex}.st .dot{width:6px;height:6px;border-radius:50%;background:#22C55E;flex:none}' +
    '.x{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--mu);flex:none}.x:hover{background:var(--fl);color:#111}.x .c{display:none}.x .d{display:flex}@media(min-width:640px){.x .c{display:flex}.x .d{display:none}}' +
    '.list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 6px;background:#fff;scroll-behavior:smooth}' +
    '@media(prefers-reduced-motion:reduce){.list{scroll-behavior:auto}.fab,.win,.m,.ho,.fab .i{transition:none!important;animation:none!important}}' +
    '.day{text-align:center;font-size:12px;color:var(--ln);margin:10px 0 12px}' +
    '.m{display:flex;margin:0 0 8px;animation:up .2s ease-out both}@keyframes up{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}.m.me{justify-content:flex-end}.m+.m.same{margin-top:-5px}' +
    '.bb{max-width:80%;padding:9px 12px 7px 13px;border-radius:18px;background:var(--fl);color:#111;font-size:15px;line-height:1.4;word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap;position:relative}' +
    '.m.them.tl .bb{border-bottom-left-radius:6px}.m.me .bb{background:var(--b);color:var(--bt)}.m.me.tl .bb{border-bottom-right-radius:6px}' +
    '.mt{display:inline-flex;align-items:center;gap:4px;float:right;margin:7px 0 0 10px;font-size:11px;line-height:1;opacity:.6;position:relative;top:1px}.m.me .mt{opacity:.78}.mt .tk{display:inline-flex}' +
    '.lk a{color:var(--b);text-decoration:underline;text-underline-offset:2px;word-break:break-all}.m.me .lk a{color:inherit}.cp{display:inline-flex;vertical-align:-2px;margin-left:5px;padding:2px;border-radius:5px;opacity:.6}.cp:hover{opacity:1;background:rgba(0,0,0,.08)}.m.me .cp:hover{background:rgba(255,255,255,.2)}' +
    '.err{clear:both;display:flex;justify-content:flex-end;align-items:center;gap:5px;font-size:12px;color:#C0392B;margin:-3px 2px 8px}.err button{text-decoration:underline;text-underline-offset:2px;font-weight:500;color:#C0392B}' +
    '.sys{text-align:center;font-size:12px;color:var(--ln);margin:6px 20px 12px}.sys.note{margin:0 6px 16px;line-height:1.45}.sys.pause{margin:4px 20px 10px;color:#9CA3AF}' +
    '.war{display:flex;margin:0 0 14px}.war.mid{justify-content:center}.wab{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 14px 0 12px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.1);color:#111;font-weight:500;font-size:14px;text-decoration:none;transition:background .15s,border-color .15s}.wab svg{color:#25D366}.wab:hover{background:#FAFAFA;border-color:rgba(0,0,0,.18)}' +
    '.blk{text-align:center;padding:32px 20px 16px;color:var(--mu);font-size:14px}' +
    '.ft{flex:none;background:#fff;border-top:1px solid var(--hl)}' +
    '.pf{border-bottom:1px solid var(--hl)}.pf summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:9px 16px;font-size:13px;color:var(--mu);cursor:pointer;user-select:none}.pf[open] summary{color:#111}.pf summary::-webkit-details-marker{display:none}.pf summary .ar{display:flex;color:#9CA3AF;transition:transform .2s}.pf[open] summary .ar{transform:rotate(180deg)}' +
    '.pf .fm{padding:2px 16px 12px;display:grid;gap:8px}.pf input:not([type=checkbox]){width:100%;height:40px;border:0;border-radius:12px;padding:0 12px;font-size:15px;background:var(--fl);outline:none;transition:box-shadow .15s}.pf input:focus{box-shadow:0 0 0 3px var(--bs)}' +
    // Honeypot: für Menschen unsichtbar (nicht display:none, sonst lassen Bots es aus), nie im Tab-Fluss
    '.pf input.hp{position:absolute;left:-9999px;top:0;width:1px;height:0;opacity:0;pointer-events:none}' +
    '.sw{display:flex;align-items:center;gap:10px;font-size:13px;color:#374151;margin:2px 0}.sw.off{opacity:.5}.pf input[type=checkbox]{appearance:none;-webkit-appearance:none;width:36px;height:22px;border-radius:11px;background:#D1D5DB;position:relative;flex:none;border:0;padding:0;margin:0;cursor:pointer;transition:background .2s}.pf input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .2s}.pf input[type=checkbox]:checked{background:var(--b)}.pf input[type=checkbox]:checked::after{transform:translateX(14px)}' +
    '.row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.pb{height:34px;padding:0 16px;border-radius:999px;background:var(--b);color:var(--bt);font-weight:600;font-size:13px;transition:opacity .15s}.pb:hover{opacity:.9}.pb:disabled{opacity:.5;cursor:default}.ok{font-size:12px;color:#16A34A}' +
    '.lnk{font-size:13px;color:var(--mu);text-decoration:underline;text-underline-offset:2px;margin-left:auto}.lnk:hover{color:#111}.lnk:disabled{opacity:.5}' +
    '.cmp{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 8px 16px}' +
    '.ta{flex:1;min-height:44px;max-height:132px;resize:none;border:0;border-radius:22px;padding:11px 16px;font-size:16px;line-height:22px;background:var(--fl);overflow-y:auto;outline:none;transition:box-shadow .15s}.ta:focus{box-shadow:0 0 0 3px var(--bs)}.ta::placeholder{color:#9CA3AF}@media(min-width:640px){.ta{font-size:15px}}' +
    '.sb{width:38px;height:38px;margin-bottom:3px;border-radius:50%;background:var(--b);color:var(--bt);display:flex;align-items:center;justify-content:center;flex:none;transition:transform .15s,opacity .15s}.sb:disabled{opacity:.4;cursor:default}.sb:not(:disabled):hover{transform:scale(1.06)}' +
    '.hint{font-size:11px;color:var(--ln);text-align:center;padding:0 16px 10px}.hint a{text-decoration:underline;text-underline-offset:2px}' +
    '.toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%) translateY(6px);background:rgba(17,17,17,.9);color:#fff;font-size:12.5px;font-weight:500;padding:8px 14px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;white-space:nowrap}.toast.on{opacity:1;transform:translateX(-50%)}' +
    '.ho{position:relative;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px 14px;margin:4px 0 14px;font-size:13px;line-height:1.45;color:#374151;animation:up .2s ease-out both}.ho b{display:block;color:#111;font-weight:600;padding-right:26px;margin-bottom:1px}' +
    '.hx{position:absolute;top:6px;right:6px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#9CA3AF}.hx:hover{background:var(--fl);color:#111}.hx svg{width:15px;height:15px}' +
    '.hb{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sec{height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,.1);background:#fff;color:#111;font-size:13px;font-weight:500}.sec:hover{background:#FAFAFA}.sec:disabled{opacity:.5;cursor:default}' +
    '.fb{display:grid;gap:6px;margin-top:10px}.fb input{width:100%;height:36px;border:0;border-radius:10px;padding:0 10px;font-size:12px;background:var(--fl);color:#374151;outline:none}.fb input:focus{box-shadow:0 0 0 3px var(--bs)}.fb p{margin:0;font-size:12px;color:var(--mu)}' +
    '.cc{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px 14px;margin:0 0 14px;font-size:13px;line-height:1.45;color:#374151;animation:up .2s ease-out both}.cc b{display:block;color:#111;font-weight:600;margin-bottom:6px}.cv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}.cd{font:600 20px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:var(--b);user-select:all;-webkit-user-select:all}.cc p{margin:0;font-size:12px;color:var(--mu)}' +
    '.rs{margin:0 0 14px;font-size:13px;color:var(--mu);text-align:center}.rs .lk2{color:var(--b);font-weight:500;text-decoration:underline;text-underline-offset:2px}.rf{display:flex;gap:8px;margin-top:8px}.rf input{flex:1;min-width:0;height:40px;border:0;border-radius:12px;padding:0 12px;font:600 16px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;background:var(--fl);color:#111;outline:none}.rf input:focus{box-shadow:0 0 0 3px var(--bs)}.rf input::placeholder{font-weight:400;letter-spacing:0;text-transform:none;color:#9CA3AF}.rf .pb{height:40px}.re{color:#C0392B;font-size:12px;margin-top:6px;text-align:left}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}';
  }

  // ── Aufbau ─────────────────────────────────────────────────────────────────
  function mount() {
    if (mounted) return; mounted = true;
    var rgb = pageBrand();
    // sehr helle Markenfarbe: für Blasen/Knöpfe abdunkeln, damit der Text lesbar bleibt
    if (luminance(rgb) > 0.75) rgb = rgb.map(function (v) { return Math.round(v * 0.78); });
    var brand = 'rgb(' + rgb.join(',') + ')';
    var brandText = luminance(rgb) < 0.45 ? '#fff' : '#111';
    var brandSoft = 'rgba(' + rgb.join(',') + ',.28)';
    host = document.createElement('div');
    host.id = 'fs-chat';
    host.setAttribute('data-fs-chat-widget', '1');
    root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = css(brand, brandText, brandSoft);
    root.appendChild(style);

    var owner = cfg.owner || {};
    var avatar = owner.avatarUrl ? '<img src="' + esc(owner.avatarUrl) + '" alt="">' : esc(initials(owner.name));
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<button type="button" class="fab' + (owner.avatarUrl ? ' photo' : '') + '" aria-label="' + t.open + '" aria-expanded="false" aria-haspopup="dialog" aria-controls="win">' +
        // Starter: Profilbild + kleiner Chat-Punkt in der Seitenfarbe; ohne Bild Initialen auf der Seitenfarbe
        '<span class="i c0">' + (owner.avatarUrl ? '<img class="ph" src="' + esc(owner.avatarUrl) + '" alt=""><span class="bd">' + ICON.chatf + '</span>' : '<span class="in">' + esc(initials(owner.name)) + '</span>') + '</span><span class="i c1">' + ICON.down + '</span>' +
        '<span class="badge" aria-hidden="true"></span><span class="sr" id="sr"></span></button>' +
      '<section class="win" id="win" role="dialog" aria-modal="true" aria-label="Chat" tabindex="-1">' +
        '<div class="hd"><div class="av">' + avatar + '</div><div class="who"><div class="nm">' + esc(owner.name || 'Chat') + '</div>' +
        '<div class="st"><span class="dot"></span><span class="stt">' + t.online + '</span></div></div>' +
        '<button type="button" class="x" aria-label="' + t.close + '"><span class="d">' + ICON.down + '</span><span class="c">' + ICON.close + '</span></button></div>' +
        '<div class="list" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="toast" role="status"></div>' +
        '<div class="ft">' +
          '<details class="pf" hidden><summary><span>' + t.profile + '</span><span class="ar">' + ICON.down + '</span></summary>' +
          '<form class="fm" novalidate><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<input name="name" autocomplete="name" placeholder="' + t.name + '" maxlength="100">' +
          '<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="' + t.email + '" maxlength="200">' +
          '<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + t.phone + '" maxlength="40">' +
          '<label class="sw off"><input type="checkbox" name="notify" disabled><span>' + t.notify + '</span></label>' +
          '<div class="row"><button type="submit" class="pb">' + t.save + '</button><span class="ok" hidden>' + t.saved + '</span>' +
          '<button type="button" class="lnk ml" hidden>' + t.mailLink + '</button></div></form></details>' +
          '<div class="cmp"><textarea class="ta" rows="1" placeholder="' + t.placeholder + '" aria-label="' + t.placeholder + '" maxlength="2000"></textarea>' +
          '<button type="button" class="sb" aria-label="' + t.send + '" disabled>' + ICON.send + '</button></div>' +
          '<div class="hint">' + t.hint + ' <a href="/datenschutz">' + t.privacy + '</a></div>' +
        '</div>' +
      '</section>';
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    document.body.appendChild(host);

    btn = root.querySelector('.fab'); badge = root.querySelector('.badge'); win = root.querySelector('.win');
    list = root.querySelector('.list'); ta = root.querySelector('.ta'); sendBtn = root.querySelector('.sb');
    hintEl = root.querySelector('.hint'); profileEl = root.querySelector('.pf'); statusEl = root.querySelector('.st');
    toastEl = root.querySelector('.toast');

    btn.addEventListener('click', function () { isOpen ? close() : open(); });
    root.querySelector('.x').addEventListener('click', close);
    win.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    ta.addEventListener('input', function () { grow(); sendBtn.disabled = !ta.value.trim() || blocked; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    sendBtn.addEventListener('click', submit);
    list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      if (b.dataset.copy) { copyLink(b.dataset.copy); }
      else if (b.dataset.retry) { retry(b.dataset.retry); }
      else if (b.dataset.drop) { dropMessage(b.dataset.drop); }
      else if (b.dataset.ho) { handoff(b.dataset.ho); }
      else if (b.dataset.cc) { copyLink(code, null, t.ccCopied); }
      else if (b.dataset.rs === 'open') { rsOpen = true; rsErr = null; renderAll(); focusRs(); }
      else if (b.dataset.rs === 'go') { resumeByCode(); }
    });
    list.addEventListener('input', function (e) {
      var inp = e.target;
      if (!inp || !inp.classList || !inp.classList.contains('ri')) return;
      var v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      rsVal = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
      if (inp.value !== rsVal) inp.value = rsVal;
    });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('ri')) { e.preventDefault(); resumeByCode(); }
    });
    var form = profileEl.querySelector('form');
    var emailIn = form.email, notifyIn = form.notify;
    emailIn.addEventListener('input', function () {
      var has = !!emailIn.value.trim();
      notifyIn.disabled = !has; notifyIn.parentNode.classList.toggle('off', !has);
      if (has && !emailIn.dataset.touched) { notifyIn.checked = true; emailIn.dataset.touched = '1'; }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); saveProfile(form); });
    form.querySelector('.ml').addEventListener('click', mailLink);
    // Ruhestopp: jede Interaktion im Widget zählt (kein `scroll`: das feuert auch bei programmatischem scrollBottom);
    // Tab versteckt → alles anhalten (laufenden Long-Poll abbrechen); sichtbar/Fokus → weiter
    var evs = ['pointerdown', 'touchstart', 'keydown', 'input', 'wheel'];
    for (var i = 0; i < evs.length; i++) root.addEventListener(evs[i], interact, { passive: true, capture: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopPoll(); else wake(); });
    window.addEventListener('focus', function () { touch(); if (paused) wake(); });

    renderAll();
    setTimeout(function () { btn.classList.add('in'); }, REDUCED ? 0 : 1500);
  }

  function grow() {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 132) + 'px';
  }

  function open() {
    if (isOpen) return; isOpen = true;
    win.classList.add('show'); btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', t.close);
    requestAnimationFrame(function () { requestAnimationFrame(function () { win.classList.add('in'); }); });
    scrollBottom(true);
    setTimeout(function () { if (!blocked && window.innerWidth >= 640) ta.focus(); else win.focus(); }, REDUCED ? 0 : 80);
    markRead();
    wake(); // Öffnen = sofort eine Anfrage, dann Long-Poll-Schleife
    preCheck();
  }
  function close() {
    if (!isOpen) return; isOpen = false;
    win.classList.remove('in'); btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', t.open);
    setTimeout(function () { if (!isOpen) win.classList.remove('show'); }, REDUCED ? 0 : 220);
    btn.focus();
    stopPoll(); touch(); schedulePoll(); // Long-Poll abbrechen, geschlossen weiter mit 20 s
  }
  function scrollBottom(instant) {
    if (instant) list.style.scrollBehavior = 'auto';
    list.scrollTop = list.scrollHeight;
    if (instant) setTimeout(function () { list.style.scrollBehavior = ''; }, 50);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }
  function copyLink(url, fail, msg) {
    var done = function () { toast(msg || t.copied); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url) ? done() : fail && fail(); });
    else { fallbackCopy(url) ? done() : fail && fail(); }
  }
  function fallbackCopy(txt) {
    var el = document.createElement('textarea'), ok = false; el.value = txt; el.setAttribute('readonly', ''); el.style.position = 'fixed'; el.style.opacity = '0';
    root.appendChild(el); el.select(); try { ok = document.execCommand('copy'); } catch (e) {} root.removeChild(el);
    return ok;
  }

  // ── Darstellung ────────────────────────────────────────────────────────────
  function unreadCount() {
    var n = 0;
    for (var i = 0; i < messages.length; i++) if (messages[i].sender === 'owner' && !messages[i].readAt) n++;
    return n;
  }
  function renderBadge() {
    var n = unreadCount();
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.classList.toggle('on', n > 0 && !isOpen);
    root.getElementById('sr').textContent = n > 0 ? n + ' ' + t.unread : '';
  }
  function renderStatus() {
    var on = !paused && ownerSeen && (Date.now() - new Date(ownerSeen).getTime()) < 90000;
    statusEl.classList.toggle('on', !!on);
  }
  function ticks(m) {
    if (m.state === 'sending') return '<span class="tk" title="' + t.sending + '">' + ICON.clock + '</span>';
    if (m.state === 'failed') return '<span class="tk" title="' + t.failed + '">' + ICON.warn + '</span>';
    if (m.readAt) return '<span class="tk rd" title="' + t.read + '">' + ICON.tick2 + '</span>';
    return '<span class="tk sn" title="' + t.sent + '">' + ICON.tick + '</span>';
  }
  function near(a, b) { return a && b && a.sender === b.sender && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < 120000; }
  function bubble(m, same, tail) {
    var me = m.sender === 'visitor';
    var h = '<div class="m ' + (me ? 'me' : 'them') + (same ? ' same' : '') + (tail ? ' tl' : '') + '" data-id="' + esc(m.id || m.clientId) + '"><div class="bb">' +
      linkify(m.body) + '<span class="mt">' + fmtTime(m.createdAt) + (me ? ticks(m) : '') + '</span></div></div>';
    if (me && m.state === 'failed') {
      h += '<div class="err">' + ICON.warn + ' ' + (m.errorText || t.failed) + (m.retryable
        ? ' · <button type="button" data-retry="' + esc(m.clientId) + '">' + t.retry + '</button>'
        : ' · <button type="button" data-drop="' + esc(m.clientId) + '" aria-label="OK">OK</button>') + '</div>';
    }
    return h;
  }
  function waButton(mid) {
    if (!cfg.whatsappUrl) return '';
    return '<div class="war' + (mid ? ' mid' : '') + '"><a class="wab" href="' + esc(cfg.whatsappUrl) + '" target="_blank" rel="noopener noreferrer">' + ICON.wa + '<span>' + t.wa + '</span></a></div>';
  }
  function hoDismissed() {
    if (hoGone) return true;
    try { return localStorage.getItem(HO_KEY) === convId; } catch (e) { return false; }
  }
  /** Hinweiskarte im In-App-Browser: Gespräch in Safari/Browser übernehmen (Konzept „Übergabe“) */
  function handoffCard() {
    if (!IAB || !convId || blocked || hoDismissed()) return '';
    var h = '<div class="ho" role="note"><button type="button" class="hx" data-ho="x" aria-label="' + t.dismiss + '">' + ICON.close + '</button>' +
      '<b>' + esc(t.hoTitle.replace('{app}', appName())) + '</b>' + esc(t.hoText.replace('{browser}', IOS ? 'Safari' : t.hoBrowser)) +
      '<div class="hb"><button type="button" class="pb" data-ho="open"' + (hoBusy ? ' disabled' : '') + '>' + (IOS ? t.hoOpenIos : t.hoOpen) + '</button>' +
      '<button type="button" class="sec" data-ho="copy"' + (hoBusy ? ' disabled' : '') + '>' + t.copy + '</button></div>';
    if (hoUrl) h += '<div class="fb"><input readonly value="' + esc(hoUrl) + '" aria-label="Link"><p>' + esc(IOS ? t.hoMenuIos : t.hoMenu) + '</p></div>';
    return h + '</div>';
  }
  /** Karte „Dein Gesprächs-Code“ (mit Gespräch, ganz oben) */
  function codeCard() {
    if (!convId || !code) return '';
    return '<div class="cc" role="note"><b>' + t.ccTitle + '</b><div class="cv"><span class="cd" aria-label="' + t.ccTitle + '">' + esc(code) + '</span>' +
      '<button type="button" class="sec" data-cc="copy">' + ICON.copy + ' ' + t.ccCopy + '</button></div><p>' + esc(t.ccText) + '</p></div>';
  }
  /** „Schon ein Gespräch begonnen? Mit Code fortsetzen“ (ohne Gespräch, unter der Begrüßung) */
  function resumeCard() {
    if (convId) return '';
    var h = '<div class="rs">' + esc(t.rsQ) + ' ';
    if (!rsOpen) return h + '<button type="button" class="lk2" data-rs="open">' + t.rsLink + '</button></div>';
    h += '<div class="rf"><input class="ri" value="' + esc(rsVal) + '" placeholder="' + t.rsPh + '" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="' + t.rsPh + '"' + (rsBusy ? ' disabled' : '') + '>' +
      '<button type="button" class="pb" data-rs="go"' + (rsBusy ? ' disabled' : '') + '>' + t.rsGo + '</button></div>';
    if (rsErr) h += '<div class="re" role="alert">' + esc(rsErr) + '</div>';
    return h + '</div>';
  }
  function focusRs() {
    var inp = list.querySelector('.ri');
    if (inp) { try { inp.focus(); } catch (e) {} }
  }
  /** Sprachwechsel auf der Seite: feste Beschriftungen des Widgets neu setzen, Liste neu zeichnen (Nachrichten bleiben) */
  function applyLang(l) {
    LANG = l; t = T[l];
    if (!mounted || !root) return;
    btn.setAttribute('aria-label', isOpen ? t.close : t.open);
    root.querySelector('.x').setAttribute('aria-label', t.close);
    root.querySelector('.stt').textContent = t.online;
    profileEl.querySelector('summary span').textContent = t.profile;
    var f = profileEl.querySelector('form');
    f.name.placeholder = t.name; f.email.placeholder = t.email; f.phone.placeholder = t.phone;
    f.notify.parentNode.querySelector('span').textContent = t.notify;
    f.querySelector('.pb').textContent = t.save; f.querySelector('.ok').textContent = t.saved; f.querySelector('.ml').textContent = t.mailLink;
    ta.placeholder = t.placeholder; ta.setAttribute('aria-label', t.placeholder);
    sendBtn.setAttribute('aria-label', t.send);
    hintEl.innerHTML = t.hint + ' <a href="/datenschutz">' + t.privacy + '</a>';
    if (pauseEl) pauseEl.textContent = t.paused;
    renderAll();
  }
  try {
    new MutationObserver(function () { var l = pageLang(); if (l !== LANG) applyLang(l); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang', 'lang'] });
  } catch (e) {}

  function renderAll() {
    var h = '';
    if (blocked) {
      h = '<div class="blk">' + esc(t.blocked) + '</div>' + waButton(true);
    } else {
      // Mit Gespräch: Karte „Dein Gesprächs-Code“ ganz oben; davor ehrlicher Hinweis (dieser Browser, Code kommt, Wichtiges per WhatsApp/Kontaktformular).
      // Dann Begrüßung ohne Zeitstempel, WhatsApp-Knopf (falls vorhanden), ohne Gespräch „Mit Code fortsetzen“.
      h += codeCard() || '<div class="sys note">' + esc(t.notice.replace('{via}', cfg.whatsappUrl ? t.viaWa : t.viaForm)) + '</div>';
      var welcome = cfg.welcomeDefault ? t.welcome : cfg.welcome; // Standardtext folgt der Seitensprache, eigener Text bleibt wie eingegeben
      if (welcome) h += '<div class="m them tl"><div class="bb">' + linkify(welcome) + '</div></div>';
      h += waButton() + resumeCard();
      var lastDay = null, prev = null;
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        if (m.sender === 'system') { h += '<div class="sys">' + esc(m.body) + '</div>'; prev = null; continue; }
        var dk = dayKey(m.createdAt);
        if (dk !== lastDay) { h += '<div class="day">' + esc(dayLabel(m.createdAt)) + '</div>'; lastDay = dk; prev = null; }
        var next = messages[i + 1];
        h += bubble(m, near(prev, m), !(next && next.sender !== 'system' && near(m, next) && dayKey(next.createdAt) === dk));
        prev = m;
      }
      h += handoffCard();
    }
    list.innerHTML = h;
    if (paused && pauseEl) list.appendChild(pauseEl);
    renderBadge(); renderStatus();
    var hasConv = !!convId;
    hintEl.hidden = hasConv || blocked;
    profileEl.hidden = !hasConv || blocked;
    root.querySelector('.ft').hidden = blocked;
    if (isOpen) scrollBottom();
  }
  function fillProfile() {
    var f = profileEl.querySelector('form');
    f.name.value = visitor.name || ''; f.email.value = visitor.email || ''; f.phone.value = visitor.phone || '';
    var has = !!(visitor.email || '').trim();
    f.notify.disabled = !has; f.notify.parentNode.classList.toggle('off', !has);
    f.notify.checked = has && !!visitor.notifyByEmail;
    if (has) f.email.dataset.touched = '1';
    f.querySelector('.ml').hidden = !has || !convId;
  }

  // ── Daten ──────────────────────────────────────────────────────────────────
  function applySession(j) {
    sessionDone = true;
    if (typeof j.ticket === 'string' && j.ticket) ticket = j.ticket;
    if (j.conversationId) convId = j.conversationId;
    if (j.visitorToken) { token = j.visitorToken; }
    if (j.status) status = j.status;
    if (j.visitor) { visitor = j.visitor; }
    if (Array.isArray(j.messages)) messages = j.messages.map(function (m) { m.state = 'sent'; return m; });
    if (j.ownerLastSeenAt !== undefined) ownerSeen = j.ownerLastSeenAt;
    if (typeof j.resumeCode === 'string') code = j.resumeCode;
    applyOwnerRead(j.ownerReadAt);
    if (status === 'blocked') blocked = true;
  }
  /** ownerReadAt vom Server: eigene Nachrichten bis zu diesem Zeitpunkt gelten als gelesen (✓✓). Fehlt das Feld, bleibt die Heuristik in mergeNew. */
  function applyOwnerRead(iso) {
    if (iso === undefined) return;
    ownerRead = iso || null;
    if (!ownerRead) return;
    var changed = false;
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (m.sender === 'visitor' && m.state === 'sent' && !m.readAt && m.createdAt <= ownerRead) { m.readAt = ownerRead; changed = true; }
    }
    return changed;
  }
  function lastId() {
    for (var i = messages.length - 1; i >= 0; i--) if (messages[i].id && messages[i].state === 'sent') return messages[i].id;
    return null;
  }
  function mergeNew(arr) {
    var added = 0, ownerNew = 0;
    for (var i = 0; i < arr.length; i++) {
      var m = arr[i], found = false;
      for (var k = 0; k < messages.length; k++) {
        if ((m.id && messages[k].id === m.id) || (m.clientId && messages[k].clientId === m.clientId && messages[k].sender === m.sender)) {
          messages[k] = m; messages[k].state = 'sent'; found = true; break;
        }
      }
      if (!found) {
        m.state = 'sent'; messages.push(m); added++;
        if (m.sender === 'owner') {
          ownerNew++;
          // Antwort des Betreibers ⇒ frühere eigene Nachrichten gelten als gelesen (✓✓)
          for (var j = 0; j < messages.length - 1; j++) if (messages[j].sender === 'visitor' && !messages[j].readAt && messages[j].createdAt <= m.createdAt) messages[j].readAt = m.createdAt;
        }
      }
    }
    return { added: added, ownerNew: ownerNew };
  }
  // ── Polling ────────────────────────────────────────────────────────────────
  // Offen: Long-Poll-Schleife `GET messages?after=&wait=25` (Server antwortet sofort bei Neuem, sonst nach ≤ 25 s),
  //   300 ms Pause zwischen den Anfragen; kommt die Antwort trotz wait in < 1 s (alter Server/Proxy) → 3 s Abstand.
  // Geschlossen mit Gespräch: 20 s, nach 10 min 60 s (ohne wait). Fehler: 5 → 10 → 20 → 30 s.
  // Ruhestopp: 15 min (offen) / 30 min (geschlossen) ohne Interaktion → keine Anfragen mehr, Hinweis im Verlauf.
  // Nur eine Anfrage gleichzeitig (polling); stopPoll() bricht sie ab (AbortController) und entwertet die Antwort (pollGen).
  function pollDelay() { return Date.now() - lastActivity > 600000 ? 60000 : 20000; }
  function idleLimit() {
    var h = window.__fsChatIdleMs; // Test-Hook: nur wirksam, wenn gesetzt
    if (typeof h === 'number' && h > 0) return isOpen ? h : h * 2;
    return isOpen ? IDLE_OPEN : IDLE_CLOSED;
  }
  function backoff() { return Math.min(30000, 5000 * Math.pow(2, Math.min(pollFails, 4) - 1)); }
  function schedulePoll(ms) {
    clearTimeout(pollTimer); pollTimer = null;
    if (!mounted || blocked || paused) return;
    if (!isOpen && !convId) return;
    if (ms === undefined) ms = pollDelay();
    pollTimer = setTimeout(poll, ms);
  }
  function stopPoll() {
    clearTimeout(pollTimer); pollTimer = null;
    pollGen++; polling = false; pollAgain = false;
    if (pollCtl) { try { pollCtl.abort(); } catch (e) {} pollCtl = null; }
  }
  function touch() { lastActivity = Date.now(); armIdle(); }
  function interact() { touch(); if (paused) wake(); }
  function armIdle() {
    clearTimeout(idleTimer); idleTimer = null;
    if (!mounted || paused || blocked) return;
    idleTimer = setTimeout(checkIdle, Math.max(50, idleLimit() - (Date.now() - lastActivity) + 50));
  }
  function checkIdle() {
    idleTimer = null;
    if (paused || !convId) return;
    if (Date.now() - lastActivity >= idleLimit()) pause(); else armIdle();
  }
  /** Ruhestopp: keine Anfragen mehr, Status wie offline, grauer Hinweis ganz unten im Verlauf */
  function pause() {
    if (paused) return; paused = true;
    stopPoll(); clearTimeout(idleTimer); idleTimer = null;
    if (!pauseEl) { pauseEl = document.createElement('div'); pauseEl.className = 'sys pause'; pauseEl.setAttribute('role', 'status'); pauseEl.textContent = t.paused; }
    list.appendChild(pauseEl);
    renderStatus();
    if (isOpen) scrollBottom();
  }
  /** Wiederaufnahme (Interaktion, Öffnen, sichtbar, Fokus): Hinweis weg, sofort eine Anfrage */
  function wake() {
    if (paused) { paused = false; if (pauseEl && pauseEl.parentNode) pauseEl.parentNode.removeChild(pauseEl); renderStatus(); }
    touch(); stopPoll(); schedulePoll(0);
  }
  function poll() {
    clearTimeout(pollTimer); pollTimer = null;
    if (!mounted || blocked || paused || document.hidden || !convId || !token) return;
    if (Date.now() - lastActivity >= idleLimit()) { pause(); return; }
    if (polling) { pollAgain = true; return; }
    var wait = isOpen ? LONG_WAIT : 0, after = lastId(), gen = pollGen, t0 = Date.now();
    var q = after ? '?after=' + encodeURIComponent(after) : '';
    if (wait) q += (q ? '&' : '?') + 'wait=' + wait;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    pollCtl = ctl; polling = true;
    api('messages', { query: q, signal: ctl && ctl.signal }).then(function (r) {
      if (gen !== pollGen) return; // abgebrochen/veraltet
      polling = false; pollCtl = null;
      var again = pollAgain; pollAgain = false;
      if (r.ok) {
        pollFails = 0;
        if (r.json.status) { status = r.json.status; if (status === 'blocked') { setBlocked(); return; } }
        if (r.json.ownerLastSeenAt !== undefined) ownerSeen = r.json.ownerLastSeenAt;
        var res = mergeNew(r.json.messages || []);
        var readChanged = applyOwnerRead(r.json.ownerReadAt);
        if (res.ownerNew) touch();
        if (res.added || readChanged) renderAll(); else { renderStatus(); renderBadge(); }
        if (res.ownerNew && isOpen && !document.hidden) markRead();
        // Schnelle Antwort ohne Änderung trotz wait (Server/Proxy kennt kein wait) → 3 s statt 300 ms, kein Dauerfeuer
        var fast = wait && Date.now() - t0 < 1000 && !res.added && !readChanged;
        schedulePoll(again ? 0 : isOpen ? (fast ? 3000 : 300) : undefined);
        return;
      }
      pollFails++;
      schedulePoll(Math.max(backoff(), isOpen ? 0 : pollDelay()));
    }, function () {
      if (gen !== pollGen) return;
      polling = false; pollCtl = null; pollAgain = false; pollFails++;
      schedulePoll(Math.max(backoff(), isOpen ? 0 : pollDelay()));
    });
  }
  function markRead() {
    if (!convId || !token || !unreadCount()) { renderBadge(); return; }
    apiT('read', { method: 'POST', body: {} }).then(function (r) {
      if (!r.ok) return;
      var now = new Date().toISOString();
      for (var i = 0; i < messages.length; i++) if (messages[i].sender === 'owner' && !messages[i].readAt) messages[i].readAt = now;
      renderBadge();
    }, function () {});
  }
  function setBlocked() {
    if (blocked) return; blocked = true; stopPoll(); clearTimeout(idleTimer);
    if (mounted) renderAll();
  }

  function submit() {
    var text = ta.value.trim();
    if (!text || blocked) return;
    ta.value = ''; grow(); sendBtn.disabled = true;
    var m = { clientId: 'c' + rnd(8), sender: 'visitor', body: text, createdAt: new Date().toISOString(), readAt: null, state: 'sending' };
    messages.push(m); renderAll(); scrollBottom();
    send(m);
    if (window.innerWidth >= 640) ta.focus();
  }
  /**
   * Turnstile-Token holen: unsichtbares iframe auf app.finestsites.io, Antwort per postMessage.
   * Löst immer auf ('' bei Fehler/Zeitüberschreitung/Prüfung aus) – entschieden wird auf dem Server.
   */
  function runCheck() {
    if (cfWait) return cfWait;
    cfWait = new Promise(function (resolve) {
      var done = false, fr = document.createElement('iframe');
      function finish(tok) {
        if (done) return; done = true;
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        if (fr.parentNode) fr.parentNode.removeChild(fr);
        cfWait = null;
        if (tok) { cfTok = tok; cfAt = Date.now(); }
        resolve(tok || '');
      }
      function onMsg(e) {
        if (e.origin !== CHECK_ORIGIN || e.source !== fr.contentWindow) return;
        var d = e.data || {};
        if (d.type !== 'fs-chat-check') return;
        finish(typeof d.token === 'string' ? d.token : '');
      }
      var timer = setTimeout(function () { finish(''); }, CHECK_TIMEOUT_MS);
      window.addEventListener('message', onMsg);
      fr.src = CHECK_URL;
      fr.title = 'Sicherheitsprüfung';
      fr.setAttribute('aria-hidden', 'true');
      fr.tabIndex = -1;
      fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:300px;height:80px;border:0;opacity:0;pointer-events:none';
      (document.body || document.documentElement).appendChild(fr);
    });
    return cfWait;
  }
  /** Token für die erste Nachricht: vorab geholtes nehmen (einmal gültig), sonst jetzt prüfen. */
  function checkToken() {
    if (convId) return Promise.resolve('');
    if (cfTok && Date.now() - cfAt < CHECK_MAX_AGE_MS) { var tk = cfTok; cfTok = null; return Promise.resolve(tk); }
    cfTok = null;
    return runCheck().then(function () { var tk = cfTok; cfTok = null; return tk || ''; });
  }
  /** Beim Öffnen vorab prüfen, damit die erste Nachricht nicht wartet. */
  function preCheck() {
    if (convId || blocked || cfWait || (cfTok && Date.now() - cfAt < CHECK_MAX_AGE_MS)) return;
    runCheck();
  }
  function send(m) {
    if (!token) token = rnd(32);
    // Vor der ersten Nachricht holt apiT einmal `session` (Ticket); hp = Honeypot, wd = Automations-Signal, cf = Turnstile
    checkToken().then(function (cf) {
      return apiT('messages', { method: 'POST', body: { body: m.body, clientId: m.clientId, pageUrl: location.href, hp: hp(), wd: !!navigator.webdriver, cf: cf || undefined } });
    }).then(function (r) {
      if (r.ok && r.json.message) {
        if (!tokenStored) storeToken(token);
        var first = !convId;
        if (r.json.conversationId) convId = r.json.conversationId;
        else if (r.json.message.conversationId) convId = r.json.message.conversationId;
        if (typeof r.json.resumeCode === 'string') code = r.json.resumeCode;
        mergeNew([r.json.message]);
        renderAll();
        if (first) { fillProfile(); profileEl.open = true; }
        touch();
        // laufende Long-Poll-Anfrage nicht abbrechen (Antwort kam über den POST); lastId() gilt beim nächsten Durchlauf
        if (!polling) schedulePoll(isOpen ? 300 : undefined);
        return;
      }
      if (r.status === 403 && r.json.error === 'BLOCKED') return;
      m.state = 'failed';
      if (r.status === 422) { m.errorText = t.rejected; m.retryable = false; }
      else if (r.status === 429) { m.errorText = t.wait; m.retryable = true; }
      else { m.errorText = t.failed; m.retryable = true; }
      renderAll();
    }, function () {
      m.state = 'failed'; m.errorText = t.offline; m.retryable = true; renderAll();
    });
  }
  function retry(clientId) {
    for (var i = 0; i < messages.length; i++) if (messages[i].clientId === clientId) {
      messages[i].state = 'sending'; messages[i].errorText = null; renderAll(); send(messages[i]); return;
    }
  }
  function dropMessage(clientId) {
    messages = messages.filter(function (m) { return m.clientId !== clientId; }); renderAll();
  }
  function saveProfile(form) {
    var body = {
      name: form.name.value.trim() || null, email: form.email.value.trim() || null,
      phone: form.phone.value.trim() || null, notifyByEmail: !!(form.email.value.trim() && form.notify.checked), hp: hp()
    };
    apiT('profile', { method: 'POST', body: body }).then(function (r) {
      if (!r.ok) return;
      if (r.json.visitor) visitor = r.json.visitor;
      form.querySelector('.ml').hidden = !(visitor.email || '').trim();
      var ok = form.querySelector('.ok'); ok.hidden = false;
      setTimeout(function () { ok.hidden = true; profileEl.open = false; }, 1200);
    }, function () {});
  }

  // ── Gespräch per Code fortsetzen (`POST resume`): dieser Browser kommt als weiterer Zugang dazu ──
  function resumeByCode() {
    var v = rsVal.replace('-', '');
    if (rsBusy) return;
    if (v.length !== 8) { rsErr = t.rsBad; renderAll(); focusRs(); return; }
    rsBusy = true; rsErr = null; renderAll();
    if (!token) token = rnd(32);
    apiT('resume', { method: 'POST', body: { code: v, visitorToken: token } }).then(function (r) {
      rsBusy = false;
      if (r.ok && r.json.conversationId) {
        applySession(r.json); storeToken(token);
        rsOpen = false; rsVal = '';
        renderAll(); fillProfile(); toast(t.rsDone); wake();
        return;
      }
      if (r.status === 403 && r.json.error === 'BLOCKED') return;
      rsErr = r.status === 404 ? t.rsBad : r.status === 410 ? t.rsOld : r.status === 429 ? t.rsMany : t.failed;
      renderAll(); focusRs();
    }, function () { rsBusy = false; rsErr = t.offline; renderAll(); });
  }

  // ── Übergabe (In-App-Browser → Safari/Browser, Desktop → Handy per Mail) ───
  /** Holt einen frischen Einmal-Link (`?fs_chat=<token>`) für diese Seite; null bei Fehler. */
  function handoffLink() {
    if (!convId || !token) return Promise.resolve(null);
    return apiT('handoff', { method: 'POST', body: { via: 'link', pageUrl: location.href } }).then(function (r) {
      return r.ok && typeof r.json.url === 'string' && r.json.url.indexOf(location.origin + '/') === 0 ? r.json.url : null; // nur same-origin
    }, function () { return null; });
  }
  function handoff(action) {
    if (action === 'x') {
      hoGone = true;
      try { localStorage.setItem(HO_KEY, convId); } catch (e) {}
      renderAll(); return;
    }
    if (hoBusy) return;
    hoBusy = true; renderAll();
    handoffLink().then(function (url) {
      hoBusy = false;
      if (!url) { renderAll(); toast(t.hoFail); return; }
      if (action === 'copy') {
        copyLink(url, function () { hoUrl = url; renderAll(); selectHoLink(); });
        renderAll(); return;
      }
      // Jeder Klick holt einen frischen Link; der Link wird nur hier (nach Klick) in die URL geschrieben,
      // damit auch der ⋯-Menüpunkt „In Safari öffnen“ des In-App-Browsers den Token mitnimmt.
      if (IOS) {
        try { history.replaceState(null, '', url); } catch (e) {}
        try { window.open('x-safari-' + url, '_blank'); } catch (e) {}
      } else if (ANDROID) {
        try { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;end'; } catch (e) {}
      } else {
        try { window.open(url, '_blank', 'noopener'); } catch (e) {}
      }
      renderAll();
      setTimeout(function () {
        if (document.visibilityState === 'visible') { hoUrl = url; renderAll(); }
      }, 1200);
    });
  }
  function selectHoLink() {
    var inp = list.querySelector('.fb input');
    if (inp) { try { inp.focus(); inp.select(); } catch (e) {} }
  }
  function mailLink() {
    var b = profileEl.querySelector('.ml');
    if (b.disabled) return;
    b.disabled = true;
    apiT('handoff', { method: 'POST', body: { via: 'email' } }).then(function (r) {
      b.disabled = false;
      if (r.ok) { toast(t.mailSent); profileEl.open = false; }
      else if (r.status === 429) toast(t.later);
      else if (r.status === 400) toast(t.email + '?');
      else toast(t.failed);
    }, function () { b.disabled = false; toast(t.offline); });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  function start() {
    if (started) return; started = true;
    var q = location.search.match(/[?&]fs_chat=([^&]+)/);
    var resume = q ? decodeURIComponent(q[1]) : null;
    var unsub = /[?&]unsubscribe=1(?:&|$)/.test(location.search);
    api('config').then(function (r) {
      if (!r.ok || !r.json.enabled) return;
      cfg = r.json;
      token = readToken(); tokenStored = !!token;
      var mountNow = function (openAfter) {
        mount();
        if (openAfter) setTimeout(open, REDUCED ? 0 : 300);
        touch(); schedulePoll();
      };
      if (!token && !resume) { mountNow(false); return; }
      if (resume && !token) token = rnd(32);
      var body = { visitorToken: token, pageUrl: location.href };
      if (resume) body.resumeToken = resume;
      api('session', { method: 'POST', body: body }).then(function (s) {
        if (s.ok && s.json.enabled !== false) {
          applySession(s.json);
          if (resume && convId) {
            storeToken(token);
            try { var u = new URL(location.href); u.searchParams.delete('fs_chat'); u.searchParams.delete('unsubscribe'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
          }
        } else if (s.status === 404 || (s.json && s.json.enabled === false)) { return; }
        mountNow(!!(resume && convId));
        fillProfile();
        if (unsub && resume && convId) {
          apiT('profile', { method: 'POST', body: { notifyByEmail: false, hp: hp() } }).then(function (p) {
            if (p.ok) { visitor.notifyByEmail = false; fillProfile(); messages.push({ sender: 'system', body: t.unsub, createdAt: new Date().toISOString() }); renderAll(); }
          }, function () {});
        }
      }, function () { mountNow(false); });
    }, function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
