#!/usr/bin/env python3
# rss-reader server — local backend for the RSS reader window.
#
# Fino-style: the reader is a tiny HTTP server on 127.0.0.1 plus a single-page
# app opened as a Chromium app window. The page never touches the network
# itself; everything comes from here:
#
#   GET  /reader.html          the reader page
#   GET  /api/state            theme + item queue (feeds fetched by bin/rss-preia,
#                              full article HTML included, sanitized here)
#   POST /api/read             mark an item read/unread (the widget's own
#                              ~/.local/state/omarchy/rss.json, so the bar
#                              count follows along)
#   GET  /api/highlights?id=   highlights saved for one item
#   POST /api/highlight        {id, text, prefix, suffix} -> saved + written to
#                              a markdown file in the highlights folder
#   POST /api/unhighlight      {id, hid} -> removed, markdown rewritten
#   POST /api/refresh          drop the feed cache, refetch now
#   GET  /thumb/<name>         one of rss-preia's verified local thumbnails
#
# Everything binds to loopback only. Article HTML is sanitized here, before it
# can reach a page — the same rule the widget follows: an address written by a
# feed never becomes a request or a script in the user's session.

import fcntl
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse
from datetime import datetime
from html import escape
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READER_DIR = os.path.join(BASE, "reader")
SCRIPT = os.path.join(BASE, "bin", "rss-preia")

HOME = os.path.expanduser("~")
CALE_SURSE = os.environ.get(
    "RSS_FEEDS", os.path.join(HOME, ".config", "omarchy", "rss", "surse.json"))
CALE_CITITE = os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.join(HOME, ".local", "state"),
    "omarchy", "rss.json")
DOSAR_CITITE = os.path.dirname(CALE_CITITE)
CALE_EVIDENTA = os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.join(HOME, ".local", "state"),
    "omarchy", "rss-highlights.json")
DOSAR_MINIATURI = os.path.join(
    os.environ.get("XDG_CACHE_HOME") or os.path.join(HOME, ".cache"),
    "omarchy", "rss-miniaturi")
DOSAR_EVIDENTA = os.environ.get(
    "RSS_HIGHLIGHTS_DIR", os.path.join(HOME, "Documents", "RSS Highlights"))
FISIER_TEMA = os.path.join(
    os.environ.get("XDG_STATE_HOME") or os.path.join(HOME, ".local", "state"),
    "omarchy", "current", "theme", "colors.toml")

PORTA = int(os.environ.get("RSS_READER_PORT", "7788"))
MAXIM_PER_SURSA = 25
TIMEOUT = 12
TTL_CACHE_SEC = 300        # feeds are refetched at most this often
MAX_CONTINUT = 400_000     # per-article HTML ceiling after sanitization

# --------------------------------------------------------------- theme

IMPLICIT = {
    "accent": "#7aa2f7", "bg": "#1a1b26", "bg2": "#24283b", "fg": "#a9b1d6",
    "bright": "#c0caf5", "muted": "#414868", "sel": "#292e42",
    "dark": "#13141c",
}


def tema():
    """Colors from the current omarchy theme, re-read on every request so a
    theme change is picked up without restarting anything."""
    iesire = dict(IMPLICIT)
    try:
        with open(FISIER_TEMA, "r", encoding="utf-8") as f:
            for linie in f:
                potrivire = re.match(
                    r'^\s*([a-z_]+)\s*=\s*"([^"]*)"\s*$', linie)
                if potrivire:
                    iesire[potrivire.group(1)] = potrivire.group(2)
    except OSError:
        pass
    return {
        "accent": iesire.get("accent"),
        "bg": iesire.get("background"),
        "bg2": iesire.get("lighter_background"),
        "fg": iesire.get("foreground"),
        "bright": iesire.get("bright_foreground"),
        "muted": iesire.get("muted"),
        "sel": iesire.get("selection"),
        "dark": iesire.get("dark_background"),
        "font": os.environ.get("RSS_FONT", "JetBrainsMono NF"),
    }


# ----------------------------------------------------------- sanitizing
#
# Whitelist-based rebuild of the article HTML. Text nodes are re-escaped, so
# nothing smuggled inside a comment, a PI or a malformed tag survives. Iframes
# pass only for YouTube embeds; every src/href must be http(s) after being
# resolved against the article's own address.

PERMISE = {
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption",
    "strong", "b", "em", "i", "u", "s", "del", "ins", "code", "pre",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "sup", "sub", "small", "span", "div", "mark", "abbr", "cite", "q",
    "video", "audio", "source", "iframe", "details", "summary", "caption",
}
FARA_CONTINUT = {"script", "style", "iframe", "template", "noscript"}
ATRIBUTE = {"alt", "title", "colspan", "rowspan", "allowfullscreen"}
GOALE = {"br", "hr", "img", "source"}
YOUTUBE = re.compile(
    r"^https?://((www|[a-z-]{2,5})\.)?(youtube(-nocookie)?\.com)/embed/", re.I)


class Curatator(HTMLParser):
    """Rebuilds an HTML fragment keeping only the whitelist above."""

    def __init__(self, baza):
        super().__init__(convert_charrefs=True)
        self.baza = baza        # article link, for resolving relative URLs
        self.iesire = []
        self.evita = 0          # depth inside a dropped subtree

    def adresa(self, brut):
        if not brut:
            return ""
        brut = brut.strip()
        if brut.startswith("data:image/"):
            return brut
        absolut = urllib.parse.urljoin(self.baza or "", brut)
        if re.match(r"^https?://", absolut, re.I):
            return absolut
        return ""

    def randabil(self, eticheta, attrs):
        curat = []
        for nume, valoare in attrs:
            nume = (nume or "").lower()
            if nume in ATRIBUTE and valoare is not None:
                curat.append((nume, valoare))
            elif nume == "href" and eticheta == "a":
                adresa = self.adresa(valoare)
                if adresa:
                    curat.append(("href", adresa))
                    curat.append(("target", "_blank"))
                    curat.append(("rel", "noopener noreferrer"))
            elif nume == "src":
                adresa = self.adresa(valoare)
                if eticheta == "iframe":
                    if YOUTUBE.match(adresa):
                        curat.append(("src", adresa))
                elif adresa:
                    curat.append(("src", adresa))
            elif nume == "srcset":
                continue  # one address per image is plenty
        return curat

    def handle_starttag(self, eticheta, attrs):
        eticheta = eticheta.lower()
        if eticheta in FARA_CONTINUT:
            self.evita += 1
            return
        if self.evita or eticheta not in PERMISE:
            return
        if eticheta == "img":
            self.iesire.append("<img loading=\"lazy\"")
        else:
            self.iesire.append("<" + eticheta)
        for nume, valoare in self.randabil(eticheta, attrs):
            self.iesire.append(" %s=\"%s\"" % (nume, escape(valoare, quote=True)))
        if eticheta in GOALE:
            self.iesire.append(">")
        else:
            self.iesire.append(">")

    def handle_startendtag(self, eticheta, attrs):
        eticheta = eticheta.lower()
        if eticheta in GOALE:
            self.handle_starttag(eticheta, attrs)

    def handle_endtag(self, eticheta):
        eticheta = eticheta.lower()
        if eticheta in FARA_CONTINUT:
            self.evita = max(0, self.evita - 1)
            return
        if self.evita or eticheta not in PERMISE or eticheta in GOALE:
            return
        self.iesire.append("</%s>" % eticheta)

    def handle_data(self, date):
        if not self.evita:
            self.iesire.append(escape(date))

    def rezultat(self):
        return "".join(self.iesire)[:MAX_CONTINUT]


def curata_continut(brut, link):
    if not brut:
        return ""
    curatator = Curatator(link)
    try:
        curatator.feed(brut)
        curatator.close()
    except Exception:
        return escape(brut)[:2000]
    return curatator.rezultat()


# ------------------------------------------------------------- read state

_blocaje = {}


def blocaje(cale):
    if cale not in _blocaje:
        _blocaje[cale] = open(cale + ".lock", "a+")
    return _blocaje[cale]


def citeste_json(cale, implicit):
    try:
        with open(cale, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return implicit


def scrie_json(cale, date):
    os.makedirs(os.path.dirname(cale), exist_ok=True)
    temporar = "%s.%d.tmp" % (cale, os.getpid())
    with open(temporar, "w", encoding="utf-8") as f:
        json.dump(date, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(temporar, cale)


def citeste_citite():
    """The widget's read map: {"version": 1, "citite": {id: timestamp}}."""
    date = citeste_json(CALE_CITITE, {})
    citite = date.get("citite") if isinstance(date, dict) else None
    return citite if isinstance(citite, dict) else {}


def marcheaza_citit(id_stire, citit=True):
    fisier = blocaje(CALE_CITITE)
    fcntl.flock(fisier, fcntl.LOCK_EX)
    try:
        citite = citeste_citite()
        if citit:
            citite[id_stire] = int(time.time())
        else:
            citite.pop(id_stire, None)
        # same cleanup rules as the widget: 90 days, 5000 entries
        prag = int(time.time()) - 90 * 86400
        citite = {k: v for k, v in citite.items()
                  if isinstance(v, (int, float)) and v >= prag}
        if len(citite) > 5000:
            pastrate = sorted(citite.items(), key=lambda x: x[1], reverse=True)[:5000]
            citite = dict(pastrate)
        scrie_json(CALE_CITITE, {"version": 1, "citite": citite})
    finally:
        fcntl.flock(fisier, fcntl.LOCK_UN)


# --------------------------------------------------------------- the queue

_raport = None
_incercare = threading.Lock()


def _raport_proaspat():
    """Runs bin/rss-preia with full content and thumbnails — the same fetcher
    the widget uses, so security rules and feed handling stay in one place."""
    rezultat = subprocess.run(
        ["python3", SCRIPT, CALE_SURSE, str(MAXIM_PER_SURSA),
         str(TIMEOUT), "1", "1"],
        capture_output=True, timeout=120)
    text = rezultat.stdout.decode("utf-8", "replace")
    inceput, sfarsit = text.find("{"), text.rfind("}")
    if inceput < 0 or sfarsit <= inceput:
        raise ValueError("rss-preia did not return JSON")
    return json.loads(text[inceput:sfarsit + 1])


def stiri(force=False):
    """The report, cached briefly so j/k through the queue never refetches."""
    global _raport
    with _incercare:
        acum = time.time()
        if not force and _raport and acum - _raport[0] < TTL_CACHE_SEC:
            return _raport[1]
        raport = _raport_proaspat()
        _raport = (acum, raport)
        return raport


def coada(include_read=False):
    raport = stiri()
    citite = citeste_citite()
    elemente = []
    for s in raport.get("stiri", []):
        citit = bool(citite.get(s["id"]))
        if citit and not include_read:
            continue
        miniatura = s.get("imagine") or ""
        nume = os.path.basename(miniatura) if miniatura.startswith("/") else ""
        elemente.append({
            "id": s["id"],
            "titlu": s["titlu"],
            "link": s["link"],
            "rezumat": s["rezumat"],
            "continut": curata_continut(s.get("continut") or "", s["link"]),
            "data": s.get("data") or 0,
            "sursa": s.get("sursa") or "",
            "imagine": "/thumb/" + nume if nume else "",
            "citit": citit,
        })
    return {
        "tema": tema(),
        "actualizatLa": raport.get("actualizatLa", ""),
        "eroare": raport.get("eroare", ""),
        "surseEsuate": sum(1 for x in raport.get("surse", []) if x.get("eroare")),
        "elemente": elemente,
    }


# -------------------------------------------------------------- highlights
#
# Two files:
#   ~/.local/state/omarchy/rss-highlights.json — the regenerable-source-of-
#       truth store, keyed by item id, each highlight keeping the selected text
#       plus 40 characters of context on each side, so the page can find and
#       re-wrap the same passage after a re-render;
#   <highlights folder>/<date>-<title>.md — the human-facing export, rewritten
#       on every change: YAML front matter + the highlights as blockquotes.

CONTEXT = 40


def evidenta_start():
    date = citeste_json(CALE_EVIDENTA, {})
    if not isinstance(date, dict) or not isinstance(date.get("articole"), dict):
        return {"version": 1, "articole": {}}
    return date


def slug(text, limita=60):
    text = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return (text[:limita].rstrip("-")) or "article"


def fisier_evidenta(articol):
    """Markdown file name, stable per article: stored after the first write,
    so later renames of the feed title never split an article's highlights."""
    if articol.get("fisier"):
        return articol["fisier"]
    baza = datetime.now().strftime("%Y-%m-%d") + "-" + slug(articol.get("titlu"))
    nume, n = baza + ".md", 1
    luate = {a.get("fisier") for a in evidenta_start()["articole"].values()}
    while nume in luate:
        n += 1
        nume = "%s-%d.md" % (baza, n)
    return nume


def ziua(timestamp):
    if not timestamp:
        return ""
    try:
        return datetime.fromtimestamp(int(timestamp)).strftime("%Y-%m-%d")
    except (ValueError, OverflowError, OSError):
        return ""


def scrie_markdown(id_articol, articol):
    os.makedirs(DOSAR_EVIDENTA, exist_ok=True)
    cale = os.path.join(DOSAR_EVIDENTA, articol["fisier"])
    evidente = articol["evidenta"]

    front = {
        "title": articol.get("titlu") or "",
        "feed": articol.get("sursa") or "",
        "link": articol.get("link") or "",
    }
    publicat = ziua(articol.get("data"))
    if publicat:
        front["published"] = publicat
    if evidente:
        front["highlighted"] = datetime.fromtimestamp(
            max(e.get("at", 0) for e in evidente)).strftime("%Y-%m-%d %H:%M")

    randuri = ["---"]
    for cheie, valoare in front.items():
        randuri.append("%s: %s" % (cheie, json.dumps(valoare, ensure_ascii=False)))
    randuri += ["---", "", "# " + (articol.get("titlu") or "Untitled"), ""]
    if evidente:
        randuri.append("## Highlights")
        randuri.append("")
        for e in evidente:
            text = " ".join((e.get("text") or "").split())
            randuri.append("> " + text)
            randuri.append("")
    with open(cale, "w", encoding="utf-8") as f:
        f.write("\n".join(randuri).rstrip() + "\n")
    return cale


def scrie_index():
    """One-page table of contents for the highlights folder."""
    if not os.path.isdir(DOSAR_EVIDENTA):
        return
    articole = evidenta_start()["articole"]
    randuri = ["# RSS highlights", ""]
    vii = [a for a in articole.values() if a.get("evidenta")]
    vii.sort(key=lambda a: max((e.get("at", 0) for e in a["evidenta"]), default=0),
             reverse=True)
    for a in vii:
        randuri.append("- [%s](%s) — %s — %d highlight%s" % (
            (a.get("titlu") or "Untitled").replace("[", "(").replace("]", ")"),
            urllib.parse.quote(a.get("fisier") or ""),
            a.get("sursa") or "", len(a["evidenta"]),
            "" if len(a["evidenta"]) == 1 else "s"))
    if not vii:
        randuri.append("Nothing highlighted yet.")
    with open(os.path.join(DOSAR_EVIDENTA, "index.md"), "w",
              encoding="utf-8") as f:
        f.write("\n".join(randuri).rstrip() + "\n")


def adauga_evidenta(id_stire, text, prefix, suffix, meta):
    text = " ".join((text or "").split())[:2000]
    if not text:
        return None
    fisier = blocaje(CALE_EVIDENTA)
    fcntl.flock(fisier, fcntl.LOCK_EX)
    try:
        date = evidenta_start()
        articol = date["articole"].get(id_stire) or {
            "titlu": meta.get("titlu") or "",
            "sursa": meta.get("sursa") or "",
            "link": meta.get("link") or "",
            "data": meta.get("data") or 0,
            "evidenta": [],
        }
        for e in articol["evidenta"]:  # identical passage twice -> one entry
            if e.get("text") == text:
                return articol["evidenta"]
        articol["evidenta"].append({
            "id": hashlib.sha1((text + str(time.time())).encode()).hexdigest()[:12],
            "text": text,
            "prefix": (prefix or "")[-CONTEXT:],
            "suffix": (suffix or "")[:CONTEXT],
            "at": int(time.time()),
        })
        articol["fisier"] = fisier_evidenta(articol)
        date["articole"][id_stire] = articol
        scrie_json(CALE_EVIDENTA, date)
        scrie_markdown(id_stire, articol)
    finally:
        fcntl.flock(fisier, fcntl.LOCK_UN)
    scrie_index()
    return articol["evidenta"]


def scoate_evidenta(id_stire, id_evidenta):
    fisier = blocaje(CALE_EVIDENTA)
    fcntl.flock(fisier, fcntl.LOCK_EX)
    try:
        date = evidenta_start()
        articol = date["articole"].get(id_stire)
        if not articol:
            return []
        articol["evidenta"] = [
            e for e in articol["evidenta"] if e.get("id") != id_evidenta]
        if articol["evidenta"]:
            scrie_json(CALE_EVIDENTA, date)
            scrie_markdown(id_stire, articol)
        else:
            # last highlight gone: no empty files left behind
            date["articole"].pop(id_stire, None)
            scrie_json(CALE_EVIDENTA, date)
            try:
                os.unlink(os.path.join(DOSAR_EVIDENTA, articol.get("fisier") or "\0"))
            except OSError:
                pass
    finally:
        fcntl.flock(fisier, fcntl.LOCK_UN)
    scrie_index()
    return articol["evidenta"]


# ----------------------------------------------------------------- server

MINIATURA_OK = re.compile(r"^[0-9a-f]{32}\.(jpg|png|gif|webp)$")


class Serviciu(BaseHTTPRequestHandler):
    server_version = "rss-reader/1.0"

    def log_message(self, format, *args):  # quiet by default
        if os.environ.get("RSS_READER_VERBOSE"):
            super().log_message(format, *args)

    def trimite(self, corp, tip="application/json", cod=200):
        octeti = corp if isinstance(corp, bytes) else corp.encode("utf-8")
        self.send_response(cod)
        self.send_header("Content-Type", tip + "; charset=utf-8")
        self.send_header("Content-Length", str(len(octeti)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(octeti)

    def trimite_json(self, date, cod=200):
        self.trimite(json.dumps(date, ensure_ascii=False), cod=cod)

    def corp_json(self, limita=1_000_000):
        lungime = int(self.headers.get("Content-Length") or 0)
        if lungime <= 0 or lungime > limita:
            return {}
        try:
            date = json.loads(
                self.rfile.read(lungime).decode("utf-8", "replace"))
            return date if isinstance(date, dict) else {}
        except ValueError:
            return {}

    def do_GET(self):
        cale = urllib.parse.urlparse(self.path).path
        if cale in ("/", "/reader.html"):
            try:
                with open(os.path.join(READER_DIR, "reader.html"), "rb") as f:
                    self.trimite(f.read(), tip="text/html")
            except OSError:
                self.trimite_json({"eroare": "reader-missing"}, cod=500)
        elif cale == "/ping":
            self.trimite("rss-reader", tip="text/plain")
        elif cale == "/api/state":
            parametri = urllib.parse.parse_qs(
                urllib.parse.urlparse(self.path).query)
            include = parametri.get("read", ["0"])[0] in ("1", "true")
            try:
                self.trimite_json(coada(include_read=include))
            except Exception as e:
                self.trimite_json({"eroare": type(e).__name__}, cod=502)
        elif cale == "/api/highlights":
            parametri = urllib.parse.parse_qs(
                urllib.parse.urlparse(self.path).query)
            id_stire = (parametri.get("id") or [""])[0]
            articol = evidenta_start()["articole"].get(id_stire) or {}
            self.trimite_json({"evidenta": articol.get("evidenta") or []})
        elif cale.startswith("/thumb/"):
            nume = cale[len("/thumb/"):]
            if MINIATURA_OK.match(nume):
                fisier = os.path.join(DOSAR_MINIATURI, nume)
                tip = "image/" + nume.rsplit(".", 1)[1].replace("jpg", "jpeg")
                try:
                    with open(fisier, "rb") as f:
                        self.trimite(f.read(), tip=tip)
                    return
                except OSError:
                    pass
            self.send_error(404)
        else:
            self.send_error(404)

    def do_POST(self):
        cale = urllib.parse.urlparse(self.path).path
        date = self.corp_json()
        if cale == "/api/read":
            id_stire = str(date.get("id") or "")
            if re.match(r"^[0-9a-f]{16}$", id_stire):
                marcheaza_citit(id_stire, bool(date.get("citit", True)))
                self.trimite_json({"ok": True})
            else:
                self.trimite_json({"eroare": "bad-id"}, cod=400)
        elif cale == "/api/highlight":
            id_stire = str(date.get("id") or "")
            if not re.match(r"^[0-9a-f]{16}$", id_stire):
                self.trimite_json({"eroare": "bad-id"}, cod=400)
                return
            evidente = adauga_evidenta(
                id_stire, str(date.get("text") or ""),
                str(date.get("prefix") or ""), str(date.get("suffix") or ""),
                {"titlu": date.get("titlu"), "sursa": date.get("sursa"),
                 "link": date.get("link"), "data": date.get("data")})
            self.trimite_json({"evidenta": evidente or []})
        elif cale == "/api/unhighlight":
            id_stire = str(date.get("id") or "")
            if not re.match(r"^[0-9a-f]{16}$", id_stire):
                self.trimite_json({"eroare": "bad-id"}, cod=400)
                return
            self.trimite_json({"evidenta": scoate_evidenta(
                id_stire, str(date.get("hid") or ""))})
        elif cale == "/api/refresh":
            try:
                stiri(force=True)
                self.trimite_json({"ok": True})
            except Exception as e:
                self.trimite_json({"eroare": type(e).__name__}, cod=502)
        else:
            self.send_error(404)


def main():
    os.makedirs(DOSAR_CITITE, exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORTA), Serviciu)
    runtime = os.environ.get("XDG_RUNTIME_DIR") or "/run/user/%d" % os.getuid()
    try:
        with open(os.path.join(runtime, "rss-reader.port"), "w") as f:
            f.write(str(PORTA))
    except OSError:
        pass
    with open(os.path.join(READER_DIR, ".port"), "w") as f:
        f.write(str(PORTA))
    httpd.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        # port already taken: another instance is serving, that is fine
        print("rss-reader: %s" % e, file=sys.stderr)
        sys.exit(0)
