// Traducerile widget-ului și alegerea limbii.
//
// Un singur loc pentru tot ce citește utilizatorul: etichetele panoului,
// rezumatele, vârstele relative și motivele de eșec. Restul codului nu conține
// text vizibil — cere textul de aici, pe cheie.
//
// Limba vine din setarea `language`. „Auto" o ia din locale-ul sistemului
// (Qt.locale().name), ca plugin-ul să vorbească din prima limba desktopului;
// orice altă valoare o fixează. Valoarea se poate scrie în shell.json și ca
// nume („Română"), și ca cod („ro"), fiindcă selectul din setări stochează
// numele afișat, iar cine editează fișierul de mână scrie codul.
//
// Eșecurile nu circulă ca propoziții, ci ca coduri („http|404"), tocmai ca să
// poată fi traduse aici: bin/rss-preia și Model.js scriu codul, panoul îl
// trece prin textEroare().

// Ordinea de aici e ordinea din selectul de setări.
var LIMBI = [
  { cod: "auto",  nume: "Auto",           scurt: "Auto",      locale: "",      aliasuri: ["auto", "system", "sistem", "systeme", "système", "automatic"] },
  { cod: "en",    nume: "English",        scurt: "English",   locale: "en_US", aliasuri: ["en", "eng", "english", "engleza", "engleză"] },
  { cod: "ro",    nume: "Română",         scurt: "Română",    locale: "ro_RO", aliasuri: ["ro", "ron", "rum", "romana", "română", "romanian", "romanesc"] },
  { cod: "de",    nume: "Deutsch",        scurt: "Deutsch",   locale: "de_DE", aliasuri: ["de", "ger", "deu", "deutsch", "german", "germana", "germană"] },
  { cod: "fr",    nume: "Français",       scurt: "Français",  locale: "fr_FR", aliasuri: ["fr", "fra", "francais", "français", "french", "franceza", "franceză"] },
  { cod: "es",    nume: "Español",        scurt: "Español",   locale: "es_ES", aliasuri: ["es", "spa", "espanol", "español", "spanish", "spaniola", "spaniolă"] },
  { cod: "it",    nume: "Italiano",       scurt: "Italiano",  locale: "it_IT", aliasuri: ["it", "ita", "italiano", "italian", "italiana", "italiană"] },
  { cod: "pt-BR", nume: "Português (BR)", scurt: "Português", locale: "pt_BR", aliasuri: ["pt", "pt-br", "pt_br", "por", "portugues", "português", "portuguese", "portugheza", "portugheză", "brasil"] },
  { cod: "pl",    nume: "Polski",         scurt: "Polski",    locale: "pl_PL", aliasuri: ["pl", "pol", "polski", "polish", "poloneza", "poloneză"] },
  { cod: "ru",    nume: "Русский",        scurt: "Русский",   locale: "ru_RU", aliasuri: ["ru", "rus", "russkij", "русский", "russian", "rusa", "rusă"] },
  { cod: "zh-CN", nume: "中文 (简体)",    scurt: "中文",      locale: "zh_CN", aliasuri: ["zh", "zh-cn", "zh_cn", "zh-hans", "chi", "zho", "chinese", "chineza", "chineză", "中文", "简体"] }
]

// Lista pentru selectorul din panou: codul cu care se compară, eticheta scurtă
// care se desenează pe pastilă și numele întreg care se scrie în shell.json.
function limbi() {
  var lista = []
  for (var i = 0; i < LIMBI.length; i++) {
    lista.push({ cod: LIMBI[i].cod, scurt: LIMBI[i].scurt, nume: LIMBI[i].nume })
  }
  return lista
}

// Numele întreg al unei limbi — ce se scrie în setare, ca shell.json să rămână
// citibil și să se potrivească cu opțiunile din manifest.
function numeLimba(cod) {
  for (var i = 0; i < LIMBI.length; i++) {
    if (LIMBI[i].cod === cod) {
      return LIMBI[i].nume
    }
  }
  return "Auto"
}

function numeleLimbilor() {
  var lista = []
  for (var i = 0; i < LIMBI.length; i++) {
    lista.push(LIMBI[i].nume)
  }
  return lista
}

// Codul limbii pentru o valoare scrisă în setări. Recunoaște numele afișat
// („Português (BR)"), codul („pt-BR") și scrierile fără diacritice, fiindcă
// toate trei apar în practică. Necunoscut sau lipsă înseamnă „auto".
function codLimba(valoare) {
  var brut = String(valoare === undefined || valoare === null ? "" : valoare).trim().toLowerCase()
  if (brut === "") {
    return "auto"
  }

  for (var i = 0; i < LIMBI.length; i++) {
    var l = LIMBI[i]
    if (brut === l.cod.toLowerCase() || brut === l.nume.toLowerCase()) {
      return l.cod
    }
    for (var j = 0; j < l.aliasuri.length; j++) {
      if (brut === l.aliasuri[j]) {
        return l.cod
      }
    }
  }

  // „de_AT", „en-GB", „pt_PT" — regiunea nu contează pentru traduceri.
  var baza = brut.replace(/[_.].*$/, "").replace(/-.*$/, "")
  for (var k = 0; k < LIMBI.length; k++) {
    if (LIMBI[k].cod.replace(/-.*$/, "") === baza) {
      return LIMBI[k].cod
    }
  }

  return "auto"
}

// Dacă o valoare cere explicit „auto". codLimba() întoarce „auto" și pentru ce
// nu recunoaște, deci cine validează o intrare scrisă de om (argumentul unei
// comenzi) are nevoie să distingă între cele două.
function esteAuto(valoare) {
  var brut = String(valoare === undefined || valoare === null ? "" : valoare).trim().toLowerCase()
  if (brut === "" || brut === "auto") {
    return true
  }
  for (var i = 0; i < LIMBI[0].aliasuri.length; i++) {
    if (brut === LIMBI[0].aliasuri[i]) {
      return true
    }
  }
  return false
}

// Limba efectivă: „auto" se rezolvă în locale-ul sistemului, iar ce nu avem
// tradus cade pe engleză — nu pe cheia brută.
function limba(valoare) {
  var cod = codLimba(valoare)
  if (cod !== "auto") {
    return cod
  }

  var dinSistem = codLimba(Qt.locale().name)
  return dinSistem === "auto" ? "en" : dinSistem
}

// Locale-ul folosit la formatarea datelor, ca „5 Sep" să iasă în limba aleasă
// chiar dacă sistemul e pe alta.
function localeData(cod) {
  for (var i = 0; i < LIMBI.length; i++) {
    if (LIMBI[i].cod === cod) {
      return LIMBI[i].locale || "en_US"
    }
  }
  return "en_US"
}

// ----------------------------------------------------------------- plural
//
// Câte forme are un substantiv numărat și care se alege pentru n. Engleza și
// romanicele se descurcă cu două, româna cere trei („1 știre / 2 știri / 20 de
// știri"), rusa și poloneza tot trei, dar după alt criteriu, iar chineza una.

function indexPlural(cod, n) {
  var m = Math.abs(Math.floor(n))

  if (cod === "zh-CN") {
    return 0
  }
  if (cod === "fr" || cod === "pt-BR") {
    // Franceza și portugheza brazileiană tratează 0 ca singular.
    return m <= 1 ? 0 : 1
  }
  if (cod === "ro") {
    if (m === 1) {
      return 0
    }
    return (m === 0 || (m % 100 >= 1 && m % 100 <= 19)) ? 1 : 2
  }
  if (cod === "ru" || cod === "pl") {
    if (m % 10 === 1 && m % 100 !== 11) {
      return 0
    }
    if (m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 12 || m % 100 > 14)) {
      return 1
    }
    return 2
  }

  return m === 1 ? 0 : 1
}

// ------------------------------------------------------------------ texte
//
// Engleza e referința: orice cheie lipsă din altă limbă se ia de aici, deci un
// text nou tradus doar pe jumătate nu lasă interfața cu chei brute pe ecran.
// Valorile în listă sunt formele de plural, în ordinea dată de indexPlural.

var TEXTE = {
  "en": {
    summaryError: "Can't read the news",
    summaryNoFeeds: "No feeds configured",
    summaryNoItems: "No items fetched",
    summaryAllRead: "All read",
    summaryUnread: ["{n} unread item", "{n} unread items"],
    feedsDown: ["{n} feed not responding", "{n} feeds not responding"],

    headerNews: "RSS NEWS",
    headerFeeds: "RSS FEEDS",

    tipTop: "First item (Home)",
    tipMarkAll: "Mark all as read (a)",
    tipReader: "Open the reader window (o)",
    tipBackToNews: "Back to news (s)",
    tipManageFeeds: "Manage feeds (s)",
    tipRefresh: "Reload (r)",
    tipAddFeed: "Add feed",
    tipRemoveFeed: "Remove feed",

    emptyNoFeeds: "No feeds configured. Open the gear and add an RSS feed.",
    emptyAllRead: "Every item has been read.",
    emptyNoItems: "Nothing fetched yet.",
    emptyFeedList: "No feeds. Type the address of an RSS or Atom feed below.",

    urlPlaceholder: "https://example.com/feed",
    errEmptyUrl: "Type the feed address.",
    errDuplicate: "That feed is already in the list.",

    footerLoading: "Loading…",
    footerFeeds: "n type an address · x remove the feed under the cursor · s back to news · L language",
    footerNews: "Updated at {time} · click opens the item · x marks it read · g jumps to the top",
    footerNeverUpdated: "Not updated yet · click opens the item · x marks it read · g jumps to the top",

    feedItems: ["{n} item", "{n} items"],
    languageLabel: "Language",
    feedUnchecked: "not checked yet",

    timeNow: "now",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "yesterday",
    timeDays: ["{n} day", "{n} days"],

    tooltipError: "RSS news: {detail}",

    errNoResponse: "No response from the fetch script.",
    errNotJson: "The fetch script did not return JSON.",
    errBadJson: "Invalid JSON from the fetch script.",
    errNoFeedsPath: "Missing the path to the feeds file.",
    errFeedsUnreadable: "Can't read the feed list ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Not responding ({detail})",
    errBadXml: "Invalid XML",
    errNotFeed: "Not RSS or Atom",
    errBlocked: "Refused for safety ({detail})",
    errTooLarge: "Response too large",
    errNetwork: "network"
  },

  "ro": {
    summaryError: "Nu pot citi știrile",
    summaryNoFeeds: "Nicio sursă configurată",
    summaryNoItems: "Nicio știre preluată",
    summaryAllRead: "Toate citite",
    summaryUnread: ["{n} știre necitită", "{n} știri necitite", "{n} de știri necitite"],
    feedsDown: ["{n} sursă nu răspunde", "{n} surse nu răspund", "{n} de surse nu răspund"],

    headerNews: "ȘTIRI RSS",
    headerFeeds: "SURSE RSS",

    tipTop: "Prima știre (Home)",
    tipMarkAll: "Marchează toate ca citite (a)",
    tipReader: "Deschide fereastra de citire (o)",
    tipBackToNews: "Înapoi la știri (s)",
    tipManageFeeds: "Administrează sursele (s)",
    tipRefresh: "Reîncarcă (r)",
    tipAddFeed: "Adaugă sursa",
    tipRemoveFeed: "Șterge sursa",

    emptyNoFeeds: "Nicio sursă configurată. Deschide rotița și adaugă un flux RSS.",
    emptyAllRead: "Toate știrile sunt citite.",
    emptyNoItems: "Nicio știre preluată încă.",
    emptyFeedList: "Nicio sursă. Scrie mai jos adresa unui flux RSS sau Atom.",

    urlPlaceholder: "https://exemplu.ro/feed",
    errEmptyUrl: "Scrie adresa fluxului.",
    errDuplicate: "Sursa e deja în listă.",

    footerLoading: "Se încarcă…",
    footerFeeds: "n scrie o adresă · x șterge sursa de sub cursor · s revine la știri · L limba",
    footerNews: "Actualizat la {time} · click deschide știrea · x marchează citit · g sus",
    footerNeverUpdated: "Neactualizat încă · click deschide știrea · x marchează citit · g sus",

    feedItems: ["{n} știre", "{n} știri", "{n} de știri"],
    languageLabel: "Limba",
    feedUnchecked: "neverificată",

    timeNow: "acum",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "ieri",
    timeDays: ["{n} zi", "{n} zile", "{n} de zile"],

    tooltipError: "Știri RSS: {detail}",

    errNoResponse: "Fără răspuns de la scriptul de preluare.",
    errNotJson: "Scriptul de preluare nu a răspuns cu JSON.",
    errBadJson: "JSON invalid de la scriptul de preluare.",
    errNoFeedsPath: "Lipsește calea fișierului cu surse.",
    errFeedsUnreadable: "Nu pot citi lista de surse ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Nu răspunde ({detail})",
    errBadXml: "XML invalid",
    errNotFeed: "Nu e RSS sau Atom",
    errBlocked: "Refuzat din siguranță ({detail})",
    errTooLarge: "Răspuns prea mare",
    errNetwork: "rețea"
  },

  "de": {
    summaryError: "Nachrichten nicht lesbar",
    summaryNoFeeds: "Keine Feeds eingerichtet",
    summaryNoItems: "Keine Beiträge geladen",
    summaryAllRead: "Alles gelesen",
    summaryUnread: ["{n} ungelesener Beitrag", "{n} ungelesene Beiträge"],
    feedsDown: ["{n} Feed antwortet nicht", "{n} Feeds antworten nicht"],

    headerNews: "RSS-NACHRICHTEN",
    headerFeeds: "RSS-FEEDS",

    tipTop: "Erster Beitrag (Home)",
    tipMarkAll: "Alle als gelesen markieren (a)",
    tipReader: "Das Leserfenster öffnen (o)",
    tipBackToNews: "Zurück zu den Nachrichten (s)",
    tipManageFeeds: "Feeds verwalten (s)",
    tipRefresh: "Neu laden (r)",
    tipAddFeed: "Feed hinzufügen",
    tipRemoveFeed: "Feed entfernen",

    emptyNoFeeds: "Keine Feeds eingerichtet. Öffne das Zahnrad und füge einen RSS-Feed hinzu.",
    emptyAllRead: "Alle Beiträge sind gelesen.",
    emptyNoItems: "Noch nichts geladen.",
    emptyFeedList: "Keine Feeds. Gib unten die Adresse eines RSS- oder Atom-Feeds ein.",

    urlPlaceholder: "https://beispiel.de/feed",
    errEmptyUrl: "Gib die Feed-Adresse ein.",
    errDuplicate: "Dieser Feed steht schon in der Liste.",

    footerLoading: "Wird geladen…",
    footerFeeds: "n Adresse eingeben · x Feed unter dem Cursor löschen · s zurück zu den Nachrichten · L Sprache",
    footerNews: "Aktualisiert um {time} · Klick öffnet den Beitrag · x markiert gelesen · g nach oben",
    footerNeverUpdated: "Noch nicht aktualisiert · Klick öffnet den Beitrag · x markiert gelesen · g nach oben",

    feedItems: ["{n} Beitrag", "{n} Beiträge"],
    languageLabel: "Sprache",
    feedUnchecked: "noch nicht geprüft",

    timeNow: "jetzt",
    timeMinutes: "{n} Min.",
    timeHours: "{n} Std.",
    timeYesterday: "gestern",
    timeDays: ["{n} Tag", "{n} Tage"],

    tooltipError: "RSS-Nachrichten: {detail}",

    errNoResponse: "Keine Antwort vom Abrufskript.",
    errNotJson: "Das Abrufskript hat kein JSON geliefert.",
    errBadJson: "Ungültiges JSON vom Abrufskript.",
    errNoFeedsPath: "Pfad zur Feed-Datei fehlt.",
    errFeedsUnreadable: "Feed-Liste nicht lesbar ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Antwortet nicht ({detail})",
    errBadXml: "Ungültiges XML",
    errNotFeed: "Kein RSS oder Atom",
    errBlocked: "Aus Sicherheitsgründen abgelehnt ({detail})",
    errTooLarge: "Antwort zu groß",
    errNetwork: "Netzwerk"
  },

  "fr": {
    summaryError: "Impossible de lire les actualités",
    summaryNoFeeds: "Aucun flux configuré",
    summaryNoItems: "Aucun article récupéré",
    summaryAllRead: "Tout est lu",
    summaryUnread: ["{n} article non lu", "{n} articles non lus"],
    feedsDown: ["{n} flux ne répond pas", "{n} flux ne répondent pas"],

    headerNews: "ACTUALITÉS RSS",
    headerFeeds: "FLUX RSS",

    tipTop: "Premier article (Home)",
    tipMarkAll: "Tout marquer comme lu (a)",
    tipReader: "Ouvrir la fenêtre de lecture (o)",
    tipBackToNews: "Retour aux actualités (s)",
    tipManageFeeds: "Gérer les flux (s)",
    tipRefresh: "Recharger (r)",
    tipAddFeed: "Ajouter le flux",
    tipRemoveFeed: "Supprimer le flux",

    emptyNoFeeds: "Aucun flux configuré. Ouvre la roue dentée et ajoute un flux RSS.",
    emptyAllRead: "Tous les articles sont lus.",
    emptyNoItems: "Rien de récupéré pour l'instant.",
    emptyFeedList: "Aucun flux. Saisis ci-dessous l'adresse d'un flux RSS ou Atom.",

    urlPlaceholder: "https://exemple.fr/feed",
    errEmptyUrl: "Saisis l'adresse du flux.",
    errDuplicate: "Ce flux est déjà dans la liste.",

    footerLoading: "Chargement…",
    footerFeeds: "n saisir une adresse · x supprimer le flux sous le curseur · s revenir aux actualités · L langue",
    footerNews: "Mis à jour à {time} · un clic ouvre l'article · x marque comme lu · g remonte en haut",
    footerNeverUpdated: "Pas encore mis à jour · un clic ouvre l'article · x marque comme lu · g remonte en haut",

    feedItems: ["{n} article", "{n} articles"],
    languageLabel: "Langue",
    feedUnchecked: "pas encore vérifié",

    timeNow: "à l'instant",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "hier",
    timeDays: ["{n} jour", "{n} jours"],

    tooltipError: "Actualités RSS : {detail}",

    errNoResponse: "Aucune réponse du script de récupération.",
    errNotJson: "Le script de récupération n'a pas renvoyé de JSON.",
    errBadJson: "JSON invalide renvoyé par le script de récupération.",
    errNoFeedsPath: "Chemin du fichier de flux manquant.",
    errFeedsUnreadable: "Impossible de lire la liste des flux ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Ne répond pas ({detail})",
    errBadXml: "XML invalide",
    errNotFeed: "Ni RSS ni Atom",
    errBlocked: "Refusé par sécurité ({detail})",
    errTooLarge: "Réponse trop volumineuse",
    errNetwork: "réseau"
  },

  "es": {
    summaryError: "No se pueden leer las noticias",
    summaryNoFeeds: "Sin fuentes configuradas",
    summaryNoItems: "No se ha descargado nada",
    summaryAllRead: "Todo leído",
    summaryUnread: ["{n} noticia sin leer", "{n} noticias sin leer"],
    feedsDown: ["{n} fuente no responde", "{n} fuentes no responden"],

    headerNews: "NOTICIAS RSS",
    headerFeeds: "FUENTES RSS",

    tipTop: "Primera noticia (Home)",
    tipMarkAll: "Marcar todo como leído (a)",
    tipReader: "Abrir la ventana de lectura (o)",
    tipBackToNews: "Volver a las noticias (s)",
    tipManageFeeds: "Gestionar las fuentes (s)",
    tipRefresh: "Recargar (r)",
    tipAddFeed: "Añadir la fuente",
    tipRemoveFeed: "Eliminar la fuente",

    emptyNoFeeds: "Sin fuentes configuradas. Abre la rueda y añade un feed RSS.",
    emptyAllRead: "Todas las noticias están leídas.",
    emptyNoItems: "Todavía no se ha descargado nada.",
    emptyFeedList: "Sin fuentes. Escribe abajo la dirección de un feed RSS o Atom.",

    urlPlaceholder: "https://ejemplo.es/feed",
    errEmptyUrl: "Escribe la dirección del feed.",
    errDuplicate: "Esa fuente ya está en la lista.",

    footerLoading: "Cargando…",
    footerFeeds: "n escribir una dirección · x eliminar la fuente bajo el cursor · s volver a las noticias · L idioma",
    footerNews: "Actualizado a las {time} · clic abre la noticia · x marca como leída · g sube arriba",
    footerNeverUpdated: "Aún sin actualizar · clic abre la noticia · x marca como leída · g sube arriba",

    feedItems: ["{n} noticia", "{n} noticias"],
    languageLabel: "Idioma",
    feedUnchecked: "sin comprobar",

    timeNow: "ahora",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "ayer",
    timeDays: ["{n} día", "{n} días"],

    tooltipError: "Noticias RSS: {detail}",

    errNoResponse: "Sin respuesta del script de descarga.",
    errNotJson: "El script de descarga no devolvió JSON.",
    errBadJson: "JSON inválido del script de descarga.",
    errNoFeedsPath: "Falta la ruta del archivo de fuentes.",
    errFeedsUnreadable: "No se puede leer la lista de fuentes ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "No responde ({detail})",
    errBadXml: "XML inválido",
    errNotFeed: "No es RSS ni Atom",
    errBlocked: "Rechazado por seguridad ({detail})",
    errTooLarge: "Respuesta demasiado grande",
    errNetwork: "red"
  },

  "it": {
    summaryError: "Impossibile leggere le notizie",
    summaryNoFeeds: "Nessuna fonte configurata",
    summaryNoItems: "Nessuna notizia scaricata",
    summaryAllRead: "Tutto letto",
    summaryUnread: ["{n} notizia da leggere", "{n} notizie da leggere"],
    feedsDown: ["{n} fonte non risponde", "{n} fonti non rispondono"],

    headerNews: "NOTIZIE RSS",
    headerFeeds: "FONTI RSS",

    tipTop: "Prima notizia (Home)",
    tipMarkAll: "Segna tutto come letto (a)",
    tipReader: "Apri la finestra di lettura (o)",
    tipBackToNews: "Torna alle notizie (s)",
    tipManageFeeds: "Gestisci le fonti (s)",
    tipRefresh: "Ricarica (r)",
    tipAddFeed: "Aggiungi la fonte",
    tipRemoveFeed: "Rimuovi la fonte",

    emptyNoFeeds: "Nessuna fonte configurata. Apri la rotella e aggiungi un feed RSS.",
    emptyAllRead: "Tutte le notizie sono lette.",
    emptyNoItems: "Ancora niente di scaricato.",
    emptyFeedList: "Nessuna fonte. Scrivi qui sotto l'indirizzo di un feed RSS o Atom.",

    urlPlaceholder: "https://esempio.it/feed",
    errEmptyUrl: "Scrivi l'indirizzo del feed.",
    errDuplicate: "Quella fonte è già nell'elenco.",

    footerLoading: "Caricamento…",
    footerFeeds: "n scrivi un indirizzo · x elimina la fonte sotto il cursore · s torna alle notizie · L lingua",
    footerNews: "Aggiornato alle {time} · un clic apre la notizia · x la segna letta · g torna in cima",
    footerNeverUpdated: "Non ancora aggiornato · un clic apre la notizia · x la segna letta · g torna in cima",

    feedItems: ["{n} notizia", "{n} notizie"],
    languageLabel: "Lingua",
    feedUnchecked: "non ancora verificata",

    timeNow: "adesso",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "ieri",
    timeDays: ["{n} giorno", "{n} giorni"],

    tooltipError: "Notizie RSS: {detail}",

    errNoResponse: "Nessuna risposta dallo script di scaricamento.",
    errNotJson: "Lo script di scaricamento non ha restituito JSON.",
    errBadJson: "JSON non valido dallo script di scaricamento.",
    errNoFeedsPath: "Manca il percorso del file delle fonti.",
    errFeedsUnreadable: "Impossibile leggere l'elenco delle fonti ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Non risponde ({detail})",
    errBadXml: "XML non valido",
    errNotFeed: "Non è RSS né Atom",
    errBlocked: "Rifiutato per sicurezza ({detail})",
    errTooLarge: "Risposta troppo grande",
    errNetwork: "rete"
  },

  "pt-BR": {
    summaryError: "Não consigo ler as notícias",
    summaryNoFeeds: "Nenhuma fonte configurada",
    summaryNoItems: "Nenhuma notícia baixada",
    summaryAllRead: "Tudo lido",
    summaryUnread: ["{n} notícia não lida", "{n} notícias não lidas"],
    feedsDown: ["{n} fonte não responde", "{n} fontes não respondem"],

    headerNews: "NOTÍCIAS RSS",
    headerFeeds: "FONTES RSS",

    tipTop: "Primeira notícia (Home)",
    tipMarkAll: "Marcar tudo como lido (a)",
    tipReader: "Abrir a janela de leitura (o)",
    tipBackToNews: "Voltar às notícias (s)",
    tipManageFeeds: "Gerenciar as fontes (s)",
    tipRefresh: "Recarregar (r)",
    tipAddFeed: "Adicionar a fonte",
    tipRemoveFeed: "Remover a fonte",

    emptyNoFeeds: "Nenhuma fonte configurada. Abra a engrenagem e adicione um feed RSS.",
    emptyAllRead: "Todas as notícias foram lidas.",
    emptyNoItems: "Nada baixado ainda.",
    emptyFeedList: "Nenhuma fonte. Escreva abaixo o endereço de um feed RSS ou Atom.",

    urlPlaceholder: "https://exemplo.com.br/feed",
    errEmptyUrl: "Escreva o endereço do feed.",
    errDuplicate: "Essa fonte já está na lista.",

    footerLoading: "Carregando…",
    footerFeeds: "n escrever um endereço · x remover a fonte sob o cursor · s voltar às notícias · L idioma",
    footerNews: "Atualizado às {time} · clique abre a notícia · x marca como lida · g volta ao topo",
    footerNeverUpdated: "Ainda não atualizado · clique abre a notícia · x marca como lida · g volta ao topo",

    feedItems: ["{n} notícia", "{n} notícias"],
    languageLabel: "Idioma",
    feedUnchecked: "ainda não verificada",

    timeNow: "agora",
    timeMinutes: "{n} min",
    timeHours: "{n} h",
    timeYesterday: "ontem",
    timeDays: ["{n} dia", "{n} dias"],

    tooltipError: "Notícias RSS: {detail}",

    errNoResponse: "Sem resposta do script de download.",
    errNotJson: "O script de download não devolveu JSON.",
    errBadJson: "JSON inválido do script de download.",
    errNoFeedsPath: "Falta o caminho do arquivo de fontes.",
    errFeedsUnreadable: "Não consigo ler a lista de fontes ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Não responde ({detail})",
    errBadXml: "XML inválido",
    errNotFeed: "Não é RSS nem Atom",
    errBlocked: "Recusado por segurança ({detail})",
    errTooLarge: "Resposta grande demais",
    errNetwork: "rede"
  },

  "pl": {
    summaryError: "Nie mogę odczytać wiadomości",
    summaryNoFeeds: "Brak skonfigurowanych źródeł",
    summaryNoItems: "Nie pobrano żadnych wiadomości",
    summaryAllRead: "Wszystko przeczytane",
    summaryUnread: ["{n} nieprzeczytana wiadomość", "{n} nieprzeczytane wiadomości", "{n} nieprzeczytanych wiadomości"],
    feedsDown: ["{n} źródło nie odpowiada", "{n} źródła nie odpowiadają", "{n} źródeł nie odpowiada"],

    headerNews: "WIADOMOŚCI RSS",
    headerFeeds: "ŹRÓDŁA RSS",

    tipTop: "Pierwsza wiadomość (Home)",
    tipMarkAll: "Oznacz wszystko jako przeczytane (a)",
    tipReader: "Otwórz okno czytania (o)",
    tipBackToNews: "Powrót do wiadomości (s)",
    tipManageFeeds: "Zarządzaj źródłami (s)",
    tipRefresh: "Odśwież (r)",
    tipAddFeed: "Dodaj źródło",
    tipRemoveFeed: "Usuń źródło",

    emptyNoFeeds: "Brak skonfigurowanych źródeł. Otwórz kółko zębate i dodaj kanał RSS.",
    emptyAllRead: "Wszystkie wiadomości są przeczytane.",
    emptyNoItems: "Jeszcze nic nie pobrano.",
    emptyFeedList: "Brak źródeł. Wpisz poniżej adres kanału RSS lub Atom.",

    urlPlaceholder: "https://przyklad.pl/feed",
    errEmptyUrl: "Wpisz adres kanału.",
    errDuplicate: "To źródło jest już na liście.",

    footerLoading: "Wczytywanie…",
    footerFeeds: "n wpisz adres · x usuń źródło pod kursorem · s powrót do wiadomości · L język",
    footerNews: "Zaktualizowano o {time} · klik otwiera wiadomość · x oznacza przeczytaną · g na górę",
    footerNeverUpdated: "Jeszcze nie zaktualizowano · klik otwiera wiadomość · x oznacza przeczytaną · g na górę",

    feedItems: ["{n} wiadomość", "{n} wiadomości", "{n} wiadomości"],
    languageLabel: "Język",
    feedUnchecked: "niesprawdzone",

    timeNow: "teraz",
    timeMinutes: "{n} min",
    timeHours: "{n} godz.",
    timeYesterday: "wczoraj",
    timeDays: ["{n} dzień", "{n} dni", "{n} dni"],

    tooltipError: "Wiadomości RSS: {detail}",

    errNoResponse: "Brak odpowiedzi od skryptu pobierania.",
    errNotJson: "Skrypt pobierania nie zwrócił JSON-a.",
    errBadJson: "Nieprawidłowy JSON ze skryptu pobierania.",
    errNoFeedsPath: "Brak ścieżki do pliku ze źródłami.",
    errFeedsUnreadable: "Nie mogę odczytać listy źródeł ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Nie odpowiada ({detail})",
    errBadXml: "Nieprawidłowy XML",
    errNotFeed: "To nie RSS ani Atom",
    errBlocked: "Odrzucone ze względów bezpieczeństwa ({detail})",
    errTooLarge: "Odpowiedź zbyt duża",
    errNetwork: "sieć"
  },

  "ru": {
    summaryError: "Не удаётся прочитать новости",
    summaryNoFeeds: "Источники не настроены",
    summaryNoItems: "Новости не загружены",
    summaryAllRead: "Всё прочитано",
    summaryUnread: ["{n} непрочитанная новость", "{n} непрочитанные новости", "{n} непрочитанных новостей"],
    feedsDown: ["{n} источник не отвечает", "{n} источника не отвечают", "{n} источников не отвечают"],

    headerNews: "НОВОСТИ RSS",
    headerFeeds: "ИСТОЧНИКИ RSS",

    tipTop: "Первая новость (Home)",
    tipMarkAll: "Отметить всё прочитанным (a)",
    tipReader: "Открыть окно чтения (o)",
    tipBackToNews: "Назад к новостям (s)",
    tipManageFeeds: "Управление источниками (s)",
    tipRefresh: "Обновить (r)",
    tipAddFeed: "Добавить источник",
    tipRemoveFeed: "Удалить источник",

    emptyNoFeeds: "Источники не настроены. Откройте шестерёнку и добавьте RSS-канал.",
    emptyAllRead: "Все новости прочитаны.",
    emptyNoItems: "Пока ничего не загружено.",
    emptyFeedList: "Источников нет. Введите ниже адрес RSS- или Atom-канала.",

    urlPlaceholder: "https://primer.ru/feed",
    errEmptyUrl: "Введите адрес канала.",
    errDuplicate: "Этот источник уже в списке.",

    footerLoading: "Загрузка…",
    footerFeeds: "n ввести адрес · x удалить источник под курсором · s назад к новостям · L язык",
    footerNews: "Обновлено в {time} · клик открывает новость · x отмечает прочитанной · g наверх",
    footerNeverUpdated: "Ещё не обновлялось · клик открывает новость · x отмечает прочитанной · g наверх",

    feedItems: ["{n} новость", "{n} новости", "{n} новостей"],
    languageLabel: "Язык",
    feedUnchecked: "не проверен",

    timeNow: "сейчас",
    timeMinutes: "{n} мин",
    timeHours: "{n} ч",
    timeYesterday: "вчера",
    timeDays: ["{n} день", "{n} дня", "{n} дней"],

    tooltipError: "Новости RSS: {detail}",

    errNoResponse: "Скрипт загрузки не ответил.",
    errNotJson: "Скрипт загрузки вернул не JSON.",
    errBadJson: "Некорректный JSON от скрипта загрузки.",
    errNoFeedsPath: "Не указан путь к файлу источников.",
    errFeedsUnreadable: "Не удаётся прочитать список источников ({detail}).",
    errHttp: "HTTP {detail}",
    errUnreachable: "Не отвечает ({detail})",
    errBadXml: "Некорректный XML",
    errNotFeed: "Это не RSS и не Atom",
    errBlocked: "Отклонено из соображений безопасности ({detail})",
    errTooLarge: "Слишком большой ответ",
    errNetwork: "сеть"
  },

  "zh-CN": {
    summaryError: "无法读取新闻",
    summaryNoFeeds: "未配置订阅源",
    summaryNoItems: "未获取到新闻",
    summaryAllRead: "全部已读",
    summaryUnread: ["{n} 条未读"],
    feedsDown: ["{n} 个订阅源无响应"],

    headerNews: "RSS 新闻",
    headerFeeds: "RSS 订阅源",

    tipTop: "第一条新闻（Home）",
    tipMarkAll: "全部标为已读（a）",
    tipReader: "打开阅读窗口（o）",
    tipBackToNews: "返回新闻（s）",
    tipManageFeeds: "管理订阅源（s）",
    tipRefresh: "重新加载（r）",
    tipAddFeed: "添加订阅源",
    tipRemoveFeed: "删除订阅源",

    emptyNoFeeds: "未配置订阅源。点击齿轮添加一个 RSS 源。",
    emptyAllRead: "所有新闻都已读。",
    emptyNoItems: "尚未获取任何内容。",
    emptyFeedList: "没有订阅源。在下方填写 RSS 或 Atom 源的地址。",

    urlPlaceholder: "https://example.com/feed",
    errEmptyUrl: "请填写订阅源地址。",
    errDuplicate: "该订阅源已在列表中。",

    footerLoading: "加载中…",
    footerFeeds: "n 填写地址 · x 删除光标处的订阅源 · s 返回新闻 · L 语言",
    footerNews: "更新于 {time} · 单击打开新闻 · x 标为已读 · g 回到顶部",
    footerNeverUpdated: "尚未更新 · 单击打开新闻 · x 标为已读 · g 回到顶部",

    feedItems: ["{n} 条"],
    languageLabel: "语言",
    feedUnchecked: "未检查",

    timeNow: "刚刚",
    timeMinutes: "{n} 分钟",
    timeHours: "{n} 小时",
    timeYesterday: "昨天",
    timeDays: ["{n} 天"],

    tooltipError: "RSS 新闻：{detail}",

    errNoResponse: "抓取脚本没有响应。",
    errNotJson: "抓取脚本返回的不是 JSON。",
    errBadJson: "抓取脚本返回的 JSON 无效。",
    errNoFeedsPath: "缺少订阅源文件的路径。",
    errFeedsUnreadable: "无法读取订阅源列表（{detail}）。",
    errHttp: "HTTP {detail}",
    errUnreachable: "无响应（{detail}）",
    errBadXml: "XML 无效",
    errNotFeed: "不是 RSS 或 Atom",
    errBlocked: "出于安全考虑已拒绝（{detail}）",
    errTooLarge: "响应过大",
    errNetwork: "网络"
  }
}

// ------------------------------------------------------------------ acces

function inlocuieste(sablon, params) {
  var text = String(sablon)
  if (!params) {
    return text
  }
  for (var cheie in params) {
    text = text.split("{" + cheie + "}").join(String(params[cheie]))
  }
  return text
}

function brut(cod, cheie) {
  var tabel = TEXTE[cod]
  if (tabel && tabel[cheie] !== undefined) {
    return tabel[cheie]
  }
  return TEXTE["en"][cheie]
}

// Textul unei chei simple.
function t(cod, cheie, params) {
  var valoare = brut(cod, cheie)
  if (valoare === undefined) {
    return cheie
  }
  // O cheie de plural cerută fără număr: ia prima formă, ca să nu iasă „[obj]".
  if (Array.isArray(valoare)) {
    valoare = valoare[0]
  }
  return inlocuieste(valoare, params)
}

// Textul unei chei numărate. Forma se alege după regula limbii, iar {n} e pus
// mereu, deci traducerile nu trebuie să concateneze numărul singure.
function tn(cod, cheie, n, params) {
  var forme = brut(cod, cheie)
  if (forme === undefined) {
    return cheie
  }
  if (!Array.isArray(forme)) {
    forme = [forme]
  }

  var idx = Math.min(indexPlural(cod, n), forme.length - 1)
  var toate = { n: n }
  for (var cheieParam in (params || {})) {
    toate[cheieParam] = params[cheieParam]
  }
  return inlocuieste(forme[idx], toate)
}

// ------------------------------------------------------------------ erori
//
// Un cod are forma „nume" sau „nume|detaliu". Ce nu e cod cunoscut se întoarce
// neschimbat: mesajele venite de la sistem (numele unei excepții, motivul dat
// de socket) nu au ce fi traduse, dar trebuie să ajungă pe ecran.

var ERORI = {
  "no-response": "errNoResponse",
  "not-json": "errNotJson",
  "bad-json": "errBadJson",
  "no-feeds-path": "errNoFeedsPath",
  "feeds-unreadable": "errFeedsUnreadable",
  "http": "errHttp",
  "unreachable": "errUnreachable",
  "bad-xml": "errBadXml",
  "not-feed": "errNotFeed",
  "blocked": "errBlocked",
  "too-large": "errTooLarge"
}

function textEroare(cod, codLimbii) {
  var brutText = String(cod || "")
  if (brutText === "") {
    return ""
  }

  var taietura = brutText.indexOf("|")
  var nume = taietura < 0 ? brutText : brutText.substring(0, taietura)
  var detaliu = taietura < 0 ? "" : brutText.substring(taietura + 1)

  var cheie = ERORI[nume]
  if (!cheie) {
    return brutText
  }

  // „network" e singurul detaliu pe care îl scriem noi, deci singurul
  // traductibil; restul vin de la sistem.
  if (detaliu === "network") {
    detaliu = t(codLimbii, "errNetwork")
  }

  return t(codLimbii, cheie, { detail: detaliu })
}

// --------------------------------------------------------------- etichete
//
// Propozițiile compuse din mai multe bucăți stau aici, nu în Panel.qml: în
// afara englezei ordinea și acordul lor nu se mai potrivesc cu o simplă
// concatenare de chei.

function etichetaBara(raport, necitite) {
  return raport.eroare ? "!" : String(necitite)
}

function rezumat(cod, raport, necitite, numarSurse, surseEsuate) {
  if (raport.eroare) {
    return t(cod, "summaryError")
  }

  if (numarSurse === 0) {
    return t(cod, "summaryNoFeeds")
  }

  var coada = surseEsuate > 0 ? " · " + tn(cod, "feedsDown", surseEsuate) : ""

  if (raport.stiri.length === 0) {
    return t(cod, "summaryNoItems") + coada
  }

  if (necitite === 0) {
    return t(cod, "summaryAllRead") + coada
  }

  return tn(cod, "summaryUnread", necitite) + coada
}

// Starea unei surse în lista de surse: eroarea ultimei preluări, câte știri a
// dat, sau „neverificată" dacă nu a fost preluată niciodată.
function stareaSursei(cod, stare) {
  if (stare && stare.eroare) {
    return textEroare(stare.eroare, cod)
  }
  if (stare) {
    return tn(cod, "feedItems", stare.numar)
  }
  return t(cod, "feedUnchecked")
}

// Vârsta unei știri. Datele vin ca epoch în secunde; 0 înseamnă că fluxul nu a
// dat nicio dată.
function catTimpInUrma(cod, epoch, acum) {
  if (!epoch) {
    return ""
  }

  var minute = Math.floor((acum.getTime() / 1000 - epoch) / 60)

  if (minute < 1) {
    return t(cod, "timeNow")
  }
  if (minute < 60) {
    return t(cod, "timeMinutes", { n: minute })
  }

  var ore = Math.floor(minute / 60)
  if (ore < 24) {
    return t(cod, "timeHours", { n: ore })
  }

  var zile = Math.floor(ore / 24)
  if (zile === 1) {
    return t(cod, "timeYesterday")
  }
  if (zile < 30) {
    return tn(cod, "timeDays", zile)
  }

  // Peste o lună, o dată e mai limpede decât un număr de zile. Luna se scrie
  // în limba aleasă, nu în cea a sistemului.
  return new Date(epoch * 1000).toLocaleDateString(Qt.locale(localeData(cod)), "d MMM")
}

// Piciorul panoului de știri: ora ultimei preluări plus tastele. Fără nicio
// preluare reușită nu avem oră, deci e nevoie de o propoziție separată.
function piciorStiri(cod, momentText) {
  var ora = oraScurta(momentText)
  return ora === "" ? t(cod, "footerNeverUpdated") : t(cod, "footerNews", { time: ora })
}

function oraScurta(momentText) {
  var moment = new Date(String(momentText || ""))
  if (isNaN(moment.getTime())) {
    return ""
  }
  return Qt.formatTime(moment, "HH:mm")
}
