# RSS news

An RSS reader for the Omarchy bar. The bar carries an icon with the number of
unread items; the panel lists them — full titles, and the article's illustration
when the feed offers one — and, on a second view, feed management.

<img src="docs/bar.png" alt="The widget in the bar: the RSS glyph and the unread count" width="104">

<img src="docs/panel.png" alt="The panel listing unread items from three feeds, each with title, source and age" width="550">

The interface speaks 10 languages and follows your system locale by default.

## What it does

- counts the unread items across every configured feed;
- lists items from all feeds in one stream, ordered by date;
- opens an item in your default browser and marks it read;
- marks everything read from a single button;
- adds and removes feeds from the panel, without editing files.

> **This is a fork** ([JoseEchave/omarchy-rss](https://github.com/JoseEchave/omarchy-rss))
> with two additions on top of the original widget: a **full-article reader
> window** (so reading no longer means bouncing to the browser) and **text
> highlighting that saves as markdown**. The original widget below is otherwise
> unchanged.

## The reader window (fork)

Reading the queue happens in a proper reading window, in the style of the Fino
reader: one unread item at a time, full article text from the feed (sanitized
on a local server before the page ever sees it), theme colors synced from your
current omarchy theme. The bar count drops as you advance — the window writes
the same read-state file the widget uses.

| Action | How |
|---|---|
| Open / focus the reader | `SUPER + ALT + R`, or `rss`, or Omarchy menu → *RSS reader* |
| Open the item under the cursor | panel: `o`, or the 󰗚 button in the panel header |
| Next / previous | `j` / `k` (or arrows; `space` scrolls, next at the end) |
| Highlight the selected text | select with the mouse, then `h` or the floating **Highlight** button |
| Remove a highlight | right-click it |
| Open the original in the browser | `o` |
| Toggle read / unread | `x` |
| Show read items too | `u` |
| Refresh feeds | `r` |
| Keys overview | `?` |
| IPC | `omarchy-shell rss reader` |

Advancing past an item marks it read (in the widget's own
`~/.local/state/omarchy/rss.json`, so the count in the bar follows along).

### Highlights as markdown

Select any passage and press `h`: it is wrapped in the page and saved to
`~/Documents/RSS Highlights` (override with `RSS_HIGHLIGHTS_DIR`). One markdown
file per article — YAML front matter plus the highlights as blockquotes — and
an `index.md` linking every article you have highlighted:

```md
---
title: "Evals for Everyone"
feed: "Every"
link: "https://every.to/ai-evals"
published: "2026-09-10"
highlighted: "2026-09-13 17:01"
---

# Evals for Everyone

## Highlights

> evals are the compass, not the map
```

Removing the last highlight of an article removes its file; the store of
highlights lives in `~/.local/state/omarchy/rss-highlights.json`.

### How the window works

- `reader/server.py` serves the page on `127.0.0.1:7788` (`RSS_READER_PORT` to
  change) and is the only piece that touches the network: it runs the widget's
  own `bin/rss-preia` (with a new opt-in full-content flag), sanitizes the
  article HTML against a whitelist (YouTube embeds are the only iframes let
  through), serves the local thumbnails, owns the read-state and highlight
  writes, and re-reads the omarchy theme on every request — a theme change is
  picked up on the next load, no restart.
- `reader/reader.html` is the single-page reader itself; `bin/rss-reader` is
  the launcher (`open` / `stop` / `serve`), also on `PATH` as `rss` via
  `~/.local/bin/rss`. The window reuses your running browser as an app window,
  like Fino does.
- `rss stop` stops the server; closing the window leaves it running so the
  next open is instant.

## Install

```bash
omarchy plugin add https://github.com/MariusGhizdavet/omarchy-rss.git
omarchy plugin enable mghizdavet.rss
```

`omarchy plugin add` clones the repo into `~/.config/omarchy/plugins/mghizdavet.rss/`
and leaves it disabled so you can read the code first; `enable` drops the widget
into the bar's right section. `omarchy bar move mghizdavet.rss <section>` puts it
somewhere else.

Updating is a fast-forward pull of that checkout, with a diff to review first:

```bash
omarchy plugin update mghizdavet.rss
```

## Remove

```bash
omarchy plugin remove mghizdavet.rss
```

That removes the widget from the bar and deletes the checkout. The plugin writes
in exactly two places outside its own folder, and neither is touched by removal,
so uninstalling never loses your feed list:

```bash
rm -rf ~/.config/omarchy/rss        # your feed list
rm -f  ~/.local/state/omarchy/rss.json   # which items you have read
rm -rf ~/Documents/"RSS Highlights"      # the exported markdown (the fork's)
rm -f  ~/.local/state/omarchy/rss-highlights.json  # the highlights store (the fork's)
```

Nothing else in your configuration is written. The one line the plugin adds to
`~/.config/omarchy/shell.json` is its own bar entry, put there by
`omarchy plugin enable` and taken out by `remove`; the language picker rewrites
only that entry's `language` key, through the shell's own `setBarWidget` call.

## Interactions

| Where | Gesture | Effect |
|---|---|---|
| bar | left click | open / close the panel |
| bar | right click | reload now |
| bar | middle click | mark everything read |
| panel | click an item | open it in the browser and mark it read |
| panel | right click an item | toggle read / unread |
| panel | `j` / `k`, arrows | move the cursor through the list |
| panel | `Enter` / `Space` | open the item under the cursor |
| panel | `o` | open the item under the cursor in the reader window |
| panel | `x` | mark read (in the feed view: remove the feed) |
| panel | `g` or `Home` | jump to the first item |
| panel | `a` | mark everything read |
| panel | `r` | reload |
| panel | `s` | switch between items and feeds |
| panel | `L` | switch to the next language |
| feeds | `n` | move the cursor into the add field |
| feeds | `Enter` in the field | add the feed; `Esc` hands the keys back to the list |

## Settings

Edited in the widget's entry in `~/.config/omarchy/shell.json`.

| Key | Default | What it does |
|---|---|---|
| `language` | `Auto` | interface language — see below |
| `refreshIntervalSec` | `120` | how often feeds are fetched on mains power |
| `refreshIntervalOnBatterySec` | `600` | the same cadence, while running on battery |
| `maxItemsPerFeed` | `25` | how many items are taken from each feed |
| `maxItemsShown` | `40` | how many items go into the panel |
| `timeoutSec` | `12` | how long to wait on one feed |
| `showCount` | `true` | the number next to the bar icon |
| `showThumbnails` | `true` | the article thumbnail |
| `unreadOnly` | `false` | hide items already read |
| `markAllReadOnClose` | `false` | mark everything read when the panel closes |

The cadence follows the power source (`UPower.onBattery`): on mains power feeds
are fetched often, on battery more rarely, and the moment you plug the charger
in a fetch happens immediately rather than waiting for the tick. A desktop,
having no battery, stays on the mains cadence forever.

## Languages

`language` accepts `Auto` — which follows the system locale and falls back to
English when that locale is not translated — or one of:

| | | |
|---|---|---|
| `English` | `Română` | `Deutsch` |
| `Français` | `Español` | `Italiano` |
| `Português (BR)` | `Polski` | `Русский` |
| `中文 (简体)` | | |

The language is picked from the panel itself — press `s` for the feed view, or
click the gear — and `L` cycles to the next one without the mouse:

<img src="docs/feeds.png" alt="The feed view: the configured feeds, the add field, and the language picker" width="550">

The plain language code works too, so `"language": "de"` is the same as
`"language": "Deutsch"`. Dates and plural forms follow the chosen language, not
the system one — Romanian gets `1 știre / 2 știri / 20 de știri`, Russian and
Polish get their three forms, and the month names in older items are written in
the selected language.

Output from the IPC commands below stays in English whatever the interface
language is, so scripts that parse it do not depend on a setting.

### Adding a language

Every string lives in `I18n.js`, in one table per language. Copy the `"en"`
block, translate the values, and add an entry to `LIMBI` at the top of the file
(code, display name, locale for date formatting, and the spellings that should
resolve to it) plus the display name to the `language` options in
`manifest.json`. If a plural needs more or fewer than two forms, `indexPlural`
is where the rule goes. Missing keys fall back to English, so a partial
translation never shows raw keys on screen.

## Feeds

On the very first run — when that file does not exist yet — the widget seeds one
international feed, **BBC News World**, so the panel has something to show
instead of asking for an address first. It is written once, on the file's
absence: once the file exists, an empty list stays empty, so removing every feed
sticks.

Feeds live in `~/.config/omarchy/rss/surse.json` and can also be edited by
hand — the file is watched, so changes apply without restarting the shell. A
missing name is filled in from the feed's own title on the first successful
fetch.

```json
{
  "version": 1,
  "surse": [
    { "id": "biziday-ro", "nume": "Biziday", "url": "https://www.biziday.ro/feed/" }
  ]
}
```

`feeds` and `name` are accepted as synonyms for `surse` and `nume` when reading,
so either spelling works in a hand-written file.

Items already read are kept separately, in `~/.local/state/omarchy/rss.json`, as
regenerable state: entries older than 90 days clean themselves up.

## From the command line

```bash
omarchy-shell rss toggle
omarchy-shell rss reader
omarchy-shell rss unread
omarchy-shell rss status
omarchy-shell rss refresh
omarchy-shell rss markAllRead
omarchy-shell rss top
omarchy-shell rss listFeeds
omarchy-shell rss addFeed https://example.com/feed
omarchy-shell rss removeFeed example-com
omarchy-shell rss language
omarchy-shell rss setLanguage Deutsch
omarchy-shell rss cycleLanguage
```

## How it is built

- `Panel.qml` — the bar widget and the panel (the two views, navigation, state).
  Contains no visible text; every label comes from `I18n.js`, by key.
- `I18n.js` — the translations, the language resolution, the plural rules, and
  the sentences assembled from more than one piece.
- `Model.js` — the shape of the data: the fetch report, the feed list, the read
  items. Failures travel as codes (`http|404`), never as sentences, so they can
  be translated at the point of display.
- `bin/rss-preia` — downloads every feed *and every thumbnail* in parallel and
  writes a single JSON document to stdout. Understands RSS 2.0 and Atom; the
  illustration comes from `media:thumbnail`, `media:content`, `enclosure` or,
  failing those, the first image in the article's HTML body. A feed's failure
  lands in the report, not in the exit code.

## Network

The widget itself never opens a connection: everything that touches the network
goes through `bin/rss-preia`, which applies the same checks to every request and
to every redirect along the way.

A feed's address is written by you, so the first hop may point at a private
network — a feed on the NAS in the hall is a legitimate choice. Everything after
that is chosen by a server rather than by you, and is held to the public
internet only:

- the scheme must be `http` or `https`, with no credentials in the URL, and for
  thumbnails the port must be 80 or 443;
- the host is resolved once, every address it returns is checked, and the
  connection is then made to that verified address — so a name that answers
  differently the second time around (DNS rebinding) gains nothing. Loopback,
  link-local (including `169.254.169.254`), private, CGNAT, multicast and
  reserved ranges are refused; over TLS, SNI and certificate validation still
  use the host name;
- at most four redirects, a byte ceiling (8 MB for a feed, 2 MB for a
  thumbnail), and one time budget for the whole chain.

Thumbnails are downloaded here rather than by QML's `Image`, because their
addresses come from the feed: the reply has to be declared an image, *and* start
with the signature of a JPEG, PNG, GIF or WebP, before it is written to
`~/.cache/omarchy/rss-miniaturi` under the fingerprint of its address. What
reaches the widget is the path of that local file — never an address the feed
wrote. Failures are remembered for six hours so a deleted image is not asked for
again on every tick, and the cache is pruned at a week or 500 files.

Article links are checked against the same accepted schemes before
`omarchy-launch-browser` is given one, in the script and again in `Model.js`.

## Requirements

`python3` (standard library only) and `omarchy-launch-browser`.

## Compatibility

The setting keys were English-ified in 1.1.0. The earlier Romanian names
(`intervalPeReteaSec`, `arataNumarul`, and the rest) are still read, so a
`shell.json` written against 1.0.0 keeps its configuration.

## License

MIT.
