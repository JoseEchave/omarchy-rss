// Interpretarea răspunsului produs de bin/rss-preia și a celor două fișiere de
// stare ale widget-ului (lista surselor și articolele deja citite). Ținut
// separat de Panel.qml ca tot ce ține de forma datelor să stea într-un loc.
//
// Aici nu există text vizibil: eșecurile ies ca cod („bad-json"), iar propoziția
// pe care o citește utilizatorul o compune I18n.js, în limba aleasă.

function raportGol() {
  return {
    eroare: "",
    actualizatLa: "",
    surse: [],
    stiri: []
  }
}

// Adresa unui articol, dar numai dacă e http(s). Scriptul filtrează deja, iar
// aici se filtrează a doua oară: valoarea asta ajunge argument pentru
// omarchy-launch-browser, iar un „javascript:" sau un „file:" strecurat într-un
// raport vechi de pe disc nu are ce căuta acolo.
function linkWeb(brut) {
  var url = String(brut || "").trim()
  return /^https?:\/\/[^\/?#]/i.test(url) ? url : ""
}

// Ilustrațiile nu mai sunt adrese de rețea, ci fișiere descărcate și verificate
// de bin/rss-preia; din raport se acceptă doar o cale absolută.
function caleLocala(brut) {
  var cale = String(brut || "")
  return cale.charAt(0) === "/" ? cale : ""
}

// Adresa cu care se hrănește un Image din QML. Numele fișierului e o amprentă
// hexazecimală, dar dosarul de acasă poate conține spații sau diacritice.
function urlFisier(cale) {
  if (caleLocala(cale) === "") {
    return ""
  }
  return "file://" + encodeURI(cale).replace(/#/g, "%23").replace(/\?/g, "%3F")
}

// Extrage obiectul JSON din ieșirea scriptului. Un avertisment scris de Python
// pe stdout ar strica JSON.parse pe tot textul, deci luăm doar de la prima
// acoladă până la ultima.
function parseazaRaport(brut) {
  var text = String(brut || "").trim()
  var raport = raportGol()

  if (text === "") {
    raport.eroare = "no-response"
    return raport
  }

  var inceput = text.indexOf("{")
  var sfarsit = text.lastIndexOf("}")

  if (inceput < 0 || sfarsit <= inceput) {
    raport.eroare = "not-json"
    return raport
  }

  var date
  try {
    date = JSON.parse(text.substring(inceput, sfarsit + 1))
  } catch (e) {
    raport.eroare = "bad-json"
    return raport
  }

  raport.actualizatLa = String(date.actualizatLa || "")
  raport.eroare = String(date.eroare || "")

  var surse = Array.isArray(date.surse) ? date.surse : []
  for (var i = 0; i < surse.length; i++) {
    raport.surse.push({
      id: String(surse[i].id || ""),
      nume: String(surse[i].nume || ""),
      url: String(surse[i].url || ""),
      numeDescoperit: String(surse[i].numeDescoperit || ""),
      eroare: String(surse[i].eroare || ""),
      numar: Number(surse[i].numar) || 0
    })
  }

  var stiri = Array.isArray(date.stiri) ? date.stiri : []
  for (var j = 0; j < stiri.length; j++) {
    raport.stiri.push({
      id: String(stiri[j].id || ""),
      titlu: String(stiri[j].titlu || ""),
      link: linkWeb(stiri[j].link),
      rezumat: String(stiri[j].rezumat || ""),
      imagine: caleLocala(stiri[j].imagine),
      data: Number(stiri[j].data) || 0,
      sursaId: String(stiri[j].sursaId || ""),
      sursa: String(stiri[j].sursa || "")
    })
  }

  return raport
}

// ------------------------------------------------------------------ surse

function surseGoale() {
  return []
}

function parseazaSurse(brut) {
  var text = String(brut || "").trim()
  if (text === "") {
    return surseGoale()
  }

  var date
  try {
    date = JSON.parse(text)
  } catch (e) {
    return surseGoale()
  }

  // „feeds" / „name" sunt acceptate ca sinonime pentru „surse" / „nume": cine
  // vine la fișier prin documentația în engleză scrie firesc așa. Scrisul
  // rămâne pe cheile românești, deci nu e nevoie de nicio migrare.
  var brute = date && Array.isArray(date.surse) ? date.surse
    : (date && Array.isArray(date.feeds) ? date.feeds : (Array.isArray(date) ? date : []))
  var surse = []

  for (var i = 0; i < brute.length; i++) {
    var intrare = brute[i]
    if (typeof intrare === "string") {
      intrare = { url: intrare }
    }
    if (!intrare || typeof intrare !== "object") {
      continue
    }

    var url = String(intrare.url || "").trim()
    if (url === "") {
      continue
    }

    surse.push({
      id: String(intrare.id || "") || idPentruUrl(url, surse),
      nume: String(intrare.nume || intrare.name || "").trim(),
      url: url
    })
  }

  return surse
}

function serializeazaSurse(surse) {
  return JSON.stringify({ version: 1, surse: surse }, null, 2) + "\n"
}

// Adresa scrisă de om nu e mereu completă: „biziday.ro/feed" e o intenție
// limpede, doar fără schemă.
function normalizeazaUrl(brut) {
  var url = String(brut || "").trim()
  if (url === "") {
    return ""
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = "https://" + url.replace(/^\/+/, "")
  }
  return url
}

// Id-ul unei surse: gazda, fără „www", plus un sufix numeric dacă gazda e deja
// folosită (două fluxuri de pe același site).
function idPentruUrl(url, existente) {
  var gazda = String(url).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0]
  var baza = gazda.replace(/^www\./i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()
  if (baza === "") {
    baza = "sursa"
  }

  var luate = {}
  for (var i = 0; i < (existente || []).length; i++) {
    luate[existente[i].id] = true
  }

  if (!luate[baza]) {
    return baza
  }

  var n = 2
  while (luate[baza + "-" + n]) {
    n++
  }
  return baza + "-" + n
}

function areUrl(surse, url) {
  for (var i = 0; i < surse.length; i++) {
    if (surse[i].url.toLowerCase() === String(url).toLowerCase()) {
      return true
    }
  }
  return false
}

// Numele afișat pentru o sursă: cel scris de utilizator, altfel cel din flux,
// altfel gazda.
function numeSursa(sursa, raport) {
  if (sursa.nume) {
    return sursa.nume
  }

  for (var i = 0; i < (raport ? raport.surse : []).length; i++) {
    if (raport.surse[i].id === sursa.id && raport.surse[i].numeDescoperit) {
      return raport.surse[i].numeDescoperit
    }
  }

  return String(sursa.url).replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0].replace(/^www\./i, "")
}

function stareSursa(sursa, raport) {
  for (var i = 0; i < (raport ? raport.surse : []).length; i++) {
    if (raport.surse[i].id === sursa.id) {
      return raport.surse[i]
    }
  }
  return null
}

// ------------------------------------------------------------------ citite
//
// Articolele citite se țin ca hartă id → momentul marcării, ca să le putem
// curăța după vechime. Un id rămas fără articol corespondent nu deranjează:
// costă câteva zeci de octeți și acoperă cazul în care o știre reapare în flux.

function parseazaCitite(brut) {
  var text = String(brut || "").trim()
  if (text === "") {
    return {}
  }

  var date
  try {
    date = JSON.parse(text)
  } catch (e) {
    return {}
  }

  var citite = date && typeof date.citite === "object" && date.citite !== null ? date.citite : {}
  var curatat = {}

  // Formatul vechi (listă de id-uri) e acceptat la citire, ca o versiune
  // anterioară a fișierului să nu marcheze totul necitit dintr-odată.
  if (Array.isArray(date && date.citite)) {
    var acum = Math.floor(Date.now() / 1000)
    for (var i = 0; i < date.citite.length; i++) {
      curatat[String(date.citite[i])] = acum
    }
    return curatat
  }

  for (var cheie in citite) {
    var moment = Number(citite[cheie])
    if (isFinite(moment) && moment > 0) {
      curatat[cheie] = moment
    }
  }

  return curatat
}

// Curăță intrările mai vechi de „zileDePastrat" și taie ce depășește „limita",
// cele mai vechi primele. Fără asta fișierul crește la nesfârșit.
function curataCitite(citite, zileDePastrat, limita) {
  var prag = Math.floor(Date.now() / 1000) - zileDePastrat * 86400
  var intrari = []

  for (var cheie in citite) {
    if (citite[cheie] >= prag) {
      intrari.push([cheie, citite[cheie]])
    }
  }

  if (intrari.length > limita) {
    intrari.sort(function (a, b) { return b[1] - a[1] })
    intrari = intrari.slice(0, limita)
  }

  var rezultat = {}
  for (var i = 0; i < intrari.length; i++) {
    rezultat[intrari[i][0]] = intrari[i][1]
  }
  return rezultat
}

function serializeazaCitite(citite) {
  return JSON.stringify({ version: 1, citite: citite }, null, 2) + "\n"
}

function numaraNecitite(stiri, citite) {
  var n = 0
  for (var i = 0; i < stiri.length; i++) {
    if (!citite[stiri[i].id]) {
      n++
    }
  }
  return n
}

// Câte surse au eșuat la ultima preluare. Numărul e dată, nu text: propoziția
// din jurul lui o face I18n.rezumat().
function surseEsuate(raport) {
  var n = 0
  for (var i = 0; i < raport.surse.length; i++) {
    if (raport.surse[i].eroare) {
      n++
    }
  }
  return n
}
