// Baut die neue Schmuckkultur-Website (breite V2) aus dem Spiegel der alten Seite.
// Quelle: _mirror-alt/  →  Ziel: v2/
// Aufruf: node _build/build.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '_mirror-alt');
const OUT = path.join(ROOT, 'v2');
const ASSETS = path.join(ROOT, '_assets'); // eigene Overrides (z. B. KI-hochskalierte Bilder), werden nach dem Spiegel kopiert

function load(f) {
  const b = fs.readFileSync(path.join(SRC, f));
  try { return b.toString('utf8').includes('�') ? b.toString('latin1') : b.toString('utf8'); }
  catch { return b.toString('latin1'); }
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function decodeEntities(s) {
  const map = { '&auml;': 'ä', '&ouml;': 'ö', '&uuml;': 'ü', '&Auml;': 'Ä', '&Ouml;': 'Ö', '&Uuml;': 'Ü', '&szlig;': 'ß', '&amp;': '&', '&quot;': '"', '&reg;': '®', '&copy;': '©', '&euro;': '€', '&nbsp;': ' ', '&#8211;': '–', '&#8220;': '“', '&#8221;': '”' };
  return String(s).replace(/&[a-zA-Z#0-9]+;/g, (m) => map[m] ?? m);
}
function img2x(rel) { // liefert srcset wenn eine @2x-Variante existiert (Spiegel oder _assets-Overrides)
  const two = rel.replace(/\.(jpe?g|png|gif)$/i, '@2x.$1');
  return (fs.existsSync(path.join(SRC, two)) || fs.existsSync(path.join(ASSETS, two))) ? ` srcset="${rel} 1x, ${two} 2x"` : '';
}

/* ================= Daten aus dem Spiegel extrahieren ================= */

const CATS = [
  { slug: 'ringe', label: 'ringe' },
  { slug: 'trauringe', label: 'trauringe' },
  { slug: 'ohrschmuck', label: 'ohrschmuck' },
  { slug: 'halsschmuck', label: 'halsschmuck' },
  { slug: 'perlen', label: 'perlen' },
  { slug: 'armschmuck', label: 'armschmuck' },
  { slug: 'ansteckschmuck', label: 'ansteckschmuck' },
  { slug: 'maennersache', label: 'männersache' },
  { slug: 'uhren', label: 'uhren' },
  { slug: 'bluetooth', label: 'bluetooth headsets' },
  { slug: 'cliq', label: 'cliq® system' },
];

function parseProducts(file, cat) {
  const html = load(file);
  const items = [];
  const chunks = html.split('<div class="rsContent">').slice(1);
  for (const raw of chunks) {
    // Chunk endet spätestens vor dem Seiten-Footer; Caption (figure) ist optional
    const block = raw.split('<div id="footer"')[0];
    const full = (block.match(/href="\.?\/?(images\/[^"]+?\.jpg)"/i) || [])[1];
    if (!full) continue;
    const id = (full.match(/\/(\d+)\.jpg$/) || [, path.basename(full, '.jpg')])[1];
    const thumb = (block.match(/src="\.?\/?(images\/[^"]+?_thumb\/[^"]+?\.jpg)"/i) || [])[1] || full;
    const dm = block.match(/Designer:\s*<a href="designer\.php\?view=([a-z0-9_-]+)">([^<]+)<\/a>/i);
    const bm = block.match(/Beschreibung:\s*([^<]+)</i);
    const pm = block.match(/Preis:\s*([^<]+)</i);
    items.push({
      id, cat, img: full, thumb,
      designerSlug: dm ? dm[1] : null,
      designerName: dm ? decodeEntities(dm[2].trim()) : null,
      beschreibung: bm ? decodeEntities(bm[1].trim()) : null,
      preis: pm ? decodeEntities(pm[1].trim()).replace(/\s*$/, '') : null,
    });
  }
  return items;
}

const products = {};
for (const c of CATS) {
  const file = c.slug === 'cliq' ? 'schmuckviewer_cliq.html' : `schmuckviewer_${c.slug}.html`;
  products[c.slug] = parseProducts(file, c.slug);
}

// Designer-Reihenfolge aus der Matrix der Original-Designerseite
const designerHtml = load('designer.html');
const order = [];
for (const mm of designerHtml.matchAll(/designer\.php\?view=([a-z0-9_-]+)"><img src="images\/designer\//g)) {
  if (!order.includes(mm[1])) order.push(mm[1]);
}

const designers = order.map((slug) => {
  const d = load(`designer_${slug}.html`);
  const big = (d.match(/class="pictureright">\s*(?:<a href="([^"]+)"[^>]*>)?\s*<img src="(images\/designer\/[^"]+)"/) || []);
  const nm = d.match(/<h1>Schmuck von ([^<]+)<\/h1>/);
  const alt = d.match(/images\/designer\/[^"]+_big[^"]*"\s+alt="Designer:\s*([^"]+)"/);
  const name = decodeEntities((nm && nm[1]) || (alt && alt[1]) || slug).trim();
  const groups = [];
  const detail = d.split('designerpictures')[1] || '';
  const gre = /<h2>([^<]+)<\/h2><ul>([\s\S]*?)<\/ul>/g;
  let g;
  while ((g = gre.exec(detail))) {
    const items = [];
    for (const it of g[2].matchAll(/category=([a-z0-9_-]+)&(?:amp;)?item=(\d+)[^>]*><img src="\.?\/?(images\/[^"]+?)"/g)) {
      items.push({ cat: it[1], id: it[2], thumb: it[3] });
    }
    if (items.length) groups.push({ label: decodeEntities(g[1].trim()), items });
  }
  return { slug, name, website: big[1] || null, big: big[2] || `images/designer/${slug}_big.jpg`, logo: `images/designer/${slug}_logo.jpg`, groups };
});

const KOOPS = ['pemanu', 'augartenhotel', 'maierhofer', 'rognerbad'].map((v) => {
  const k = load(`kooperationen_${v}.html`);
  const big = k.match(/<a href="([^"]+)"[^>]*>\s*<img src="(images\/kooperationen\/[^"]+_big[^"]*)"/) || [];
  return { slug: v, url: big[1] || null, big: big[2] || `images/kooperationen/${v}_big.jpg`, logo: `images/kooperationen/${v}_logo.jpg` };
});

// Startseiten-Bild: nur noch das erste Slider-Motiv, KI-hochskaliert in _assets (900px + 1800px @2x)

/* ============== Impressum: Original-Text, tote Technik-Abschnitte raus ============== */

function buildImpressum() {
  const t = load('impressum.html');
  let c = t.match(/<div id\s*=?\s*"content"[^>]*>([\s\S]*?)<div id="footer"/)[1];
  c = c.replace(/<script[\s\S]*?<\/script>/g, '');
  c = c.replace(/<div class="pictureleft"[\s\S]*?<\/div>/g, '');
  c = c.replace(/<img[^>]*facebook\.com\/tr[^>]*>/g, '');
  // Datenschutz-Unterabschnitte entfernen, deren Technik es nicht mehr gibt.
  // Abschnitte sind mit <strong>Titel</strong> markiert — Block = ab diesem <strong> bis zum nächsten <strong>.
  // 'Cookies' und 'Facebook Datenschutzerklärung' bleiben DRIN (Original-Texte),
  // weil die Startseite Facebook-/Instagram-Inhalte automatisch einbettet.
  const DROP = ['Google Maps Datenschutzerkl', 'Google Analytics Datenschutzerkl', 'Pseudonymisierung', 'Deaktivierung der Datenerfassung durch Google Analytics', 'Konversionsmessung mit dem Besucheraktions-Pixel von Facebook'];
  const parts = c.split(/(?=<p><strong>|<strong>)/g);
  c = parts.filter((p) => {
    const sm = p.match(/<strong>([^<]+)<\/strong>/);
    if (!sm) return true;
    return !DROP.some((d) => sm[1].includes(d));
  }).join('');
  // Struktur-Divs des Originals entfernen (Inhalt steht in unserem eigenen Container);
  // verhindert offene Divs, wenn der letzte Original-Abschnitt entfernt wurde.
  c = c.replace(/<\/?div[^>]*>/g, '');
  c = c.replace(/<p>\s*<\/p>/g, '');
  c = c.replace(/(?:<p>\s*){2,}/g, '<p>');
  c = c.replace(/(?:<p>\s*)+$/g, '');
  // Anker für den Datenschutz-Link sicherstellen
  if (!/id="datenschutz"/.test(c)) {
    c = c.replace(/<h2([^>]*)>(\s*Datenschutz\s*)<\/h2>/, '<h2$1 id="datenschutz">$2</h2>');
  }
  c = c.replace(/Konzept und Umsetzung: Benjamin Nussbaum &copy; 2012/, 'Konzept und Umsetzung: WebArs e.U. – <a href="https://webars.at" target="_blank" rel="noopener">webars.at</a>');
  return c;
}

/* ================= Templates ================= */

const NAV = [
  ['firma.html', 'Firma', 'firma'],
  ['schmuck.html', 'Schmuck', 'schmuck'],
  ['designer.html', 'Designer', 'designer'],
  ['kooperationen.html', 'Kooperationen', 'kooperationen'],
  ['links.html', 'Links', 'links'],
  ['kontakt.html', 'Kontakt', 'kontakt'],
];

const IG_URL = 'https://www.instagram.com/schmuckkultur.weiss';
const FB_URL = 'https://www.facebook.com/schmuckkulturweiss';


function page({ file, title, desc, active, content, extraHead = '', bodyClass = '', preHeader = '' }) {
  const navItems = NAV.map(([href, label, key]) => `<a href="${href}"${key === active ? ' class="active"' : ''}>${label}</a>`).join('\n        ');
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="icon" href="favicon.png" type="image/png">
<link rel="stylesheet" href="style.css?v=20261103">
${extraHead}</head>
<body class="${bodyClass}">
<div class="frame">
${preHeader}  <header>
    <h1 class="brand">
      <a href="index.html" aria-label="Schmuckkultur Renate Weiss – Startseite"><img src="images/logo.jpg"${img2x('images/logo.jpg')} width="330" height="90" alt="Schmuckkultur Renate Weiss – Designschmuck Perlen"></a>
    </h1>
    <input type="checkbox" id="nav-t" class="nav-t" aria-hidden="true">
    <label for="nav-t" class="burger" aria-label="Menü öffnen"><span></span><span></span><span></span></label>
    <nav aria-label="Hauptnavigation">
        ${navItems}
    </nav>
  </header>
${content}
  <footer>
    <p class="foot-info">Schmuckkultur RENATE WEISS · Hauptstraße 71, 2340 Mödling · Di–Fr 9:30–12:30 &amp; 15:00–18:00 Uhr, Sa 9:30–12:30 Uhr</p>
    <p class="foot-links"><a href="impressum.html">Impressum</a> · <a href="impressum.html#datenschutz">Datenschutz</a></p>
  </footer>
</div>
</body>
</html>`;
}

function schmuckRail(activeSlug) {
  return `<aside class="rail" aria-label="Schmuck-Kategorien">
    <ul>
${CATS.map((c) => `      <li><a href="schmuck-${c.slug}.html"${c.slug === activeSlug ? ' class="active"' : ''}>${esc(c.label)}</a></li>`).join('\n')}
    </ul>
  </aside>`;
}

function designerRail(activeSlug) {
  return `<aside class="rail rail-logos rail-designer" aria-label="Designer-Auswahl">
    <div class="logo-grid">
${designers.map((d) => `      <a href="designer-${d.slug}.html"${d.slug === activeSlug ? ' class="active"' : ''}><img src="${d.logo}"${img2x(d.logo)} width="85" height="83" alt="${esc(d.name)}" loading="lazy"></a>`).join('\n')}
    </div>
  </aside>`;
}

/* ================= Seiten ================= */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// --- Startseite ---
// Bewährte likebox-Variante wie auf der alten Live-Seite — page.php/timeline wird
// von Meta für ausgeloggte Besucher oft nicht gerendert (grauer Fehler), likebox schon.
const FB_FEED_SRC = 'https://www.facebook.com/plugins/likebox.php?href=https%3A%2F%2Fwww.facebook.com%2Fschmuckkulturweiss&width=300&height=560&colorscheme=light&show_faces=false&header=false&stream=true&show_border=false';
const IG_FEED_SRC = 'https://www.instagram.com/schmuckkultur.weiss/embed';

const cookieBar = `  <div id="cookie-bar" class="cookie-bar">
    <span>Diese Webseite verwendet Cookies durch eingebettete Facebook- und Instagram-Inhalte. Mit der Nutzung dieser Website erklären Sie sich einverstanden. <a href="impressum.html#datenschutz">Weitere Informationen</a></span>
    <button type="button" class="cb-x" aria-label="Hinweis schließen">×</button>
  </div>
`;

const homeContent = `  <div class="layout home-grid">
    <aside class="side-feeds">
      <div class="feed-card">
        <div class="tab-row" role="tablist" aria-label="Soziale Netzwerke">
          <button type="button" class="tab-btn on" data-feed="fb" role="tab" aria-selected="true">Facebook</button>
          <button type="button" class="tab-btn" data-feed="ig" role="tab" aria-selected="false">Instagram</button>
        </div>
        <div class="feed-slot" id="feed-fb">
          <iframe src="${esc(FB_FEED_SRC)}" height="560" style="height:560px" title="Facebook-Beiträge von Schmuckkultur Weiss" loading="lazy" allow="encrypted-media"></iframe>
        </div>
        <div class="feed-slot" id="feed-ig" hidden data-src="${esc(IG_FEED_SRC)}" data-h="560" data-title="Instagram-Profil von Schmuckkultur Weiss"></div>
      </div>
    </aside>
    <div class="home-main">
      <div class="hero-still"><img src="images/intro1.jpg"${img2x('images/intro1.jpg')} width="900" height="575" alt="Blick in unser Juweliergeschäft in Mödling"></div>
      <p class="hero-note"><a href="cliq.html">Wenn sich Hände verändern – mehr erfahren</a></p>
      <div class="home-text">
        <p>Ihr Juweliergeschäft in Mödling<br>
        Schmuckkultur RENATE WEISS Inh. Gabriele Golzar<br>
        Hauptstraße 71, 2340 Mödling</p>
        <p>Wir präsentieren einen Streifzug durch die vielgestaltige Schmuckkultur, die Ihre außergewöhnliche Persönlichkeit auf die beste Art widerspiegelt.</p>
        <h2>Unsere Designer</h2>
        <ul class="plain-list">
          <li><a href="designer-niessing.html">Niessing</a></li>
          <li><a href="designer-huebel.html">Angela Hübel</a></li>
          <li><a href="designer-qlocktwo.html">Qlocktwo</a></li>
          <li><a href="designer.html">…und viele mehr</a></li>
        </ul>
      </div>
    </div>
  </div>
  <script>(function () {
    var b = document.getElementById('cookie-bar');
    try { if (localStorage.getItem('sk-cookiehinweis') === '1') { b.hidden = true; } } catch (e) {}
    if (!b.hidden) b.querySelector('.cb-x').addEventListener('click', function () {
      b.hidden = true;
      try { localStorage.setItem('sk-cookiehinweis', '1'); } catch (e) {}
    });

    // Social-Reiter: Facebook standardmäßig, Instagram lädt beim ersten Wechsel
    var tabs = document.querySelectorAll('.tab-btn');
    var fb = document.getElementById('feed-fb');
    var ig = document.getElementById('feed-ig');

    // Desktop: Feed-Höhe an die rechte Spalte angleichen (wie Original — füllt bis unten).
    // Läuft beim Laden und (entprellt) bei Fenstergrößen-Änderung, z. B. schmal geladen → maximiert.
    var fitFeeds = function () {
      if (!window.matchMedia('(min-width: 901px)').matches) return;
      var card = document.querySelector('.feed-card');
      var main = document.querySelector('.home-main');
      var fbFrame = fb.querySelector('iframe');
      if (!card || !main || !fbFrame) return;
      var slot = fb.hidden ? ig : fb;
      var extra = card.offsetHeight - slot.offsetHeight; // Reiter + Linkzeile
      var h = Math.max(560, main.offsetHeight - extra - 2); // 2px Rahmen
      if (Math.abs(h - (parseInt(fbFrame.getAttribute('height'), 10) || 0)) < 24) return; // Mini-Änderungen: kein Feed-Reload
      fbFrame.height = h;
      fbFrame.style.height = h + 'px';
      fbFrame.src = fbFrame.src.replace(/height=\\d+/, 'height=' + h);
      ig.setAttribute('data-h', h);
      var igFrame = ig.querySelector('iframe');
      if (igFrame) { igFrame.height = h; igFrame.style.height = h + 'px'; }
    };
    fitFeeds();
    var fitTimer;
    window.addEventListener('resize', function () {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitFeeds, 250);
    });
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var showIg = btn.getAttribute('data-feed') === 'ig';
        tabs.forEach(function (x) {
          var on = x === btn;
          x.classList.toggle('on', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        fb.hidden = showIg;
        ig.hidden = !showIg;
        if (showIg && !ig.querySelector('iframe')) {
          var f = document.createElement('iframe');
          f.src = ig.getAttribute('data-src');
          f.height = ig.getAttribute('data-h');
          f.style.height = f.height + 'px';
          f.title = ig.getAttribute('data-title');
          f.setAttribute('allow', 'encrypted-media');
          ig.appendChild(f);
        }
      });
    });
  })();</script>`;

fs.writeFileSync(path.join(OUT, 'index.html'), page({
  file: 'index.html',
  title: 'Schmuckkultur Renate Weiss – Designschmuck Perlen Juwelier Mödling',
  desc: 'Kontinuierliche, authentische Schmucklinien mit handgefertigtem Schmuck von internationalen Designern – in unserem Juweliergeschäft in der Hauptstraße Mödling.',
  active: null, content: homeContent, bodyClass: 'home', preHeader: cookieBar,
}));

// --- Firma ---
fs.writeFileSync(path.join(OUT, 'firma.html'), page({
  file: 'firma.html', title: 'Firma | Schmuckkultur Renate Weiss',
  desc: 'Schmuckkultur Renate Weiss in Mödling – Manufakturen, Ateliers und Gestalter mit kontinuierlichen, authentischen Schmucklinien.',
  active: 'firma',
  content: `  <div class="layout">
    <aside class="side-img"><img src="images/portrait.jpg"${img2x('images/portrait.jpg')} alt="Gabriele Golzar – Schmuckkultur Renate Weiss"></aside>
    <div class="content-text">
      <p>Vorgestellt werden ausschließlich Manufakturen, Ateliers und Gestalter, die kontinuierliche authentische Schmucklinien entwickeln.</p>
      <p>Wir präsentieren einen Streifzug durch die vielgestaltige Schmuckkultur, die Ihre außergewöhnliche Persönlichkeit auf die beste Art widerspiegelt.</p>
      <p>Denn:</p>
      <p class="quote">Die angenehmste Art sich zu unterscheiden ist ein erlesener Geschmack.</p>
    </div>
  </div>`,
}));

// --- Schmuck-Übersicht: eine Bildkachel pro Kategorie (jeweils erstes Produktbild) ---
const catTiles = CATS.map((c) => {
  const first = products[c.slug][0];
  if (!first) return '';
  return `      <a class="cat-tile" href="schmuck-${c.slug}.html">
        <span class="cat-tile-img"><img src="${first.img}"${img2x(first.img)} alt="${esc(c.label)} – Schmuckkultur" loading="lazy"></span>
        <span class="cat-tile-label">${esc(c.label)}</span>
      </a>`;
}).join('\n');
fs.writeFileSync(path.join(OUT, 'schmuck.html'), page({
  file: 'schmuck.html', title: 'Schmuck | Schmuckkultur Renate Weiss',
  desc: 'Ringe, Trauringe, Ohrschmuck, Halsschmuck, Perlen und mehr – Designschmuck bei Schmuckkultur Renate Weiss in Mödling.',
  active: 'schmuck',
  content: `  <div class="layout layout-full">
    <div class="cat-grid">
${catTiles}
    </div>
  </div>`,
}));

// --- Schmuckviewer je Kategorie ---
for (const c of CATS) {
  const items = products[c.slug];
  const data = items.map((p) => ({ id: p.id, img: p.img, img2x: fs.existsSync(path.join(SRC, p.img.replace(/\.jpg$/i, '@2x.jpg'))) ? p.img.replace(/\.jpg$/i, '@2x.jpg') : null, thumb: p.thumb, d: p.designerName, ds: p.designerSlug, b: p.beschreibung })); // Preise bewusst nicht ausgeben (Stand 2012, Entscheidung Teodor 10.08.2026)
  const thumbs = items.map((p, i) => `        <button data-i="${i}" aria-label="Bild ${i + 1}"><img src="${p.thumb}" width="85" height="83" alt="" loading="lazy"></button>`).join('\n');
  const content = `  <div class="layout">
    ${schmuckRail(c.slug)}
    <div class="viewer" id="viewer">
      <div class="v-main">
        <button class="v-arrow v-prev" aria-label="Vorheriges Schmuckstück">‹</button>
        <img id="v-img" src="${items[0] ? items[0].img : ''}" alt="Schmuckstück – ${esc(c.label)}" title="Zum Vergrößern klicken">
        <button class="v-arrow v-next" aria-label="Nächstes Schmuckstück">›</button>
      </div>
      <div class="lightbox" id="v-lightbox" hidden>
        <button class="lb-close" aria-label="Vergrößerung schließen">×</button>
        <img id="lb-img" src="" alt="Schmuckstück in Großansicht">
      </div>
      <p class="v-caption" id="v-caption"></p>
      <div class="v-thumbs" id="v-thumbs">
${thumbs}
      </div>
    </div>
  </div>
  <script type="application/json" id="v-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  <script src="viewer.js" defer></script>`;
  fs.writeFileSync(path.join(OUT, `schmuck-${c.slug}.html`), page({
    file: `schmuck-${c.slug}.html`,
    title: `${c.label.charAt(0).toUpperCase() + c.label.slice(1)} | Schmuckkultur Renate Weiss`,
    desc: `${c.label.charAt(0).toUpperCase() + c.label.slice(1)} von internationalen Designern – Schmuckkultur Renate Weiss, Mödling.`,
    active: 'schmuck', content,
  }));
}

// --- Designer-Seiten ---
function designerPage(d) {
  const groups = d.groups.map((g) => `        <h3>${esc(g.label)}</h3>
        <ul class="thumb-list">
${g.items.map((it) => `          <li><a href="schmuck-${it.cat}.html#p${it.id}"><img src="${it.thumb}" width="85" height="83" alt="${esc(d.name)} – ${esc(g.label)}" loading="lazy"></a></li>`).join('\n')}
        </ul>`).join('\n');
  const bigImg = `<img src="${d.big}"${img2x(d.big)} alt="Designer: ${esc(d.name)}">`;
  return `  <div class="layout">
    ${designerRail(d.slug)}
    <div class="designer-detail">
      <div class="designer-big">${d.website ? `<a href="${d.website}" target="_blank" rel="noopener">${bigImg}</a>` : bigImg}</div>
      ${d.website ? `<p class="designer-site"><a href="${d.website}" target="_blank" rel="noopener">${esc(d.website.replace(/^https?:\/\//, ''))}</a></p>` : ''}
      ${d.groups.length ? `<h2>Schmuck von ${esc(d.name)}</h2>\n${groups}` : ''}
    </div>
  </div>`;
}
for (const d of designers) {
  fs.writeFileSync(path.join(OUT, `designer-${d.slug}.html`), page({
    file: `designer-${d.slug}.html`, title: `${d.name} | Designer | Schmuckkultur Renate Weiss`,
    desc: `Schmuck von ${d.name} bei Schmuckkultur Renate Weiss in Mödling.`,
    active: 'designer', content: designerPage(d),
  }));
}
fs.writeFileSync(path.join(OUT, 'designer.html'), page({
  file: 'designer.html', title: 'Designer | Schmuckkultur Renate Weiss',
  desc: 'Internationale Schmuckdesigner bei Schmuckkultur Renate Weiss in Mödling – Niessing, Angela Hübel, Gellner und viele mehr.',
  active: 'designer', content: designerPage(designers[0]),
}));

// --- Kooperationen ---
function koopPage(active) {
  const tiles = KOOPS.map((k) => `      <a href="kooperationen-${k.slug}.html"${k.slug === active.slug ? ' class="active"' : ''}><img src="${k.logo}"${img2x(k.logo)} width="85" height="83" alt="Kooperationspartner ${esc(k.slug)}" loading="lazy"></a>`).join('\n');
  const bigImg = `<img src="${active.big}"${img2x(active.big)} alt="Kooperationspartner ${esc(active.slug)}">`;
  return `  <div class="layout">
    <aside class="rail rail-logos" aria-label="Kooperationen">
      <div class="logo-grid">
${tiles}
      </div>
    </aside>
    <div class="designer-detail">
      <div class="designer-big">${active.url ? `<a href="${active.url}" target="_blank" rel="noopener">${bigImg}</a>` : bigImg}</div>
      ${active.url ? `<p class="designer-site"><a href="${active.url}" target="_blank" rel="noopener">${esc(active.url.replace(/^https?:\/\//, ''))}</a></p>` : ''}
    </div>
  </div>`;
}
for (const k of KOOPS) {
  fs.writeFileSync(path.join(OUT, `kooperationen-${k.slug}.html`), page({
    file: `kooperationen-${k.slug}.html`, title: 'Kooperationen | Schmuckkultur Renate Weiss',
    desc: 'Kooperationen der Schmuckkultur Renate Weiss in Mödling.',
    active: 'kooperationen', content: koopPage(k),
  }));
}
fs.writeFileSync(path.join(OUT, 'kooperationen.html'), page({
  file: 'kooperationen.html', title: 'Kooperationen | Schmuckkultur Renate Weiss',
  desc: 'Kooperationen der Schmuckkultur Renate Weiss in Mödling.',
  active: 'kooperationen', content: koopPage(KOOPS[0]),
}));

// --- Cliq ---
fs.writeFileSync(path.join(OUT, 'cliq.html'), page({
  file: 'cliq.html', title: 'cliQ® Superfit System | Schmuckkultur Renate Weiss',
  desc: 'Das cliQ® Superfit System – Ringe tragen trotz Arthritis und Rheuma. Schmuckkultur Renate Weiss, Mödling.',
  active: 'schmuck',
  content: `  <div class="layout">
    <aside class="side-img"><img src="images/cliq-system.jpg"${img2x('images/cliq-system.jpg')} alt="Das cliQ® Superfit System"></aside>
    <div class="content-text">
      <h2>Wenn sich Hände verändern – Das cliQ® Superfit System</h2>
      <p>Diese Technologie wurde in Zusammenarbeit mit der amerikanischen Rheuma-Gesellschaft erarbeitet. Es macht keinen Unterschied, ob Ihr Lieblingsring ganz rund, mit oder ohne Steinen, oder ein Cocktailring ist.</p>
      <p>Dieses neue, hochwertige „CliQ“-System können wir mit jedem Ring verbinden. Auch wenn sich Ihre Hände verändern, werden Ihre Ringe Sie wieder mit komfortabler Passform begleiten!</p>
      <p><a href="schmuck-cliq.html">Beispiel ansehen</a><br>
      <a href="http://www.meinbezirk.at/moedling/magazin/ringe-tragen-trotz-arthritis-und-rheuma-d522087.html" target="_blank" rel="noopener">Artikel im Mödlinger Bezirksblatt ansehen</a></p>
    </div>
  </div>`,
}));

// --- Links ---
const LINKS = [
  ['PEMANU – Modedesign für Individualisten', 'http://www.pemanu.at'],
  ['apm ARCHITEKTEN PODIVIN & MARGINTER', 'http://www.apm.co.at'],
  ['Bioresonanzpraxis – Mag. Gabriele Plötzeneder', 'http://www.bioresonanzpraxis.com'],
  ['Ihr Wellnesshotel in der Steiermark Rogner Bad Blumau', 'http://www.blumau.com'],
];
fs.writeFileSync(path.join(OUT, 'links.html'), page({
  file: 'links.html', title: 'Links | Schmuckkultur Renate Weiss',
  desc: 'Empfehlungen und Partner der Schmuckkultur Renate Weiss in Mödling.',
  active: 'links',
  content: `  <div class="layout">
    <aside class="side-img"><img src="images/linksimg.jpg"${img2x('images/linksimg.jpg')} alt="Schmuckkultur – Links"></aside>
    <div class="content-text">
${LINKS.map(([label, url]) => `      <p>${esc(label)}<br><a href="${url}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a></p>`).join('\n')}
    </div>
  </div>`,
}));

// --- Kontakt ---
fs.writeFileSync(path.join(OUT, 'kontakt.html'), page({
  file: 'kontakt.html', title: 'Kontakt | Schmuckkultur Renate Weiss',
  desc: 'Schmuckkultur Renate Weiss, Hauptstraße 71, 2340 Mödling. Di–Fr 9:30–12:30 und 15:00–18:00 Uhr, Sa 9:30–12:30 Uhr.',
  active: 'kontakt',
  content: `  <div class="layout">
    <aside class="side-img"><img src="images/portrait.jpg"${img2x('images/portrait.jpg')} alt="Gabriele Golzar – Schmuckkultur Renate Weiss"></aside>
    <div class="content-text">
      <h2>Adresse</h2>
      <p>RENATE WEISS Inhaberin Gabriele Golzar<br>
      Hauptstraße 71<br>
      2340 Mödling<br>
      <a href="https://www.google.com/maps/search/?api=1&amp;query=Schmuckkultur%20Renate%20Weiss%2C%20Hauptstra%C3%9Fe%2071%2C%202340%20M%C3%B6dling" target="_blank" rel="noopener">Karte anzeigen</a></p>
      <h2>Öffnungszeiten</h2>
      <p>Di – Fr: 9:30 – 12:30 Uhr und 15:00 – 18:00 Uhr<br>
      Sa: 9:30 – 12:30 Uhr</p>
      <h2>Kontakt</h2>
      <p>tel: <a href="tel:+43223622790">+43 (2236) 2 27 90</a><br>
      <a href="mailto:info@schmuckkultur.at">info@schmuckkultur.at</a><br>
      <a href="${IG_URL}" target="_blank" rel="noopener">Instagram</a> · <a href="${FB_URL}" target="_blank" rel="noopener">Facebook</a></p>
      <h2>vCard</h2>
      <details class="vcard">
        <summary>QR-Code mit dem Mobiltelefon scannen</summary>
        <p><img src="images/schmuckkultur_vcard.jpg"${img2x('images/schmuckkultur_vcard.jpg')} width="400" height="400" alt="Schmuckkultur vCard QR-Code" loading="lazy"><br>
        <span class="hint">QR-Code mit der Handykamera scannen und Kontakt direkt speichern.</span></p>
      </details>
    </div>
  </div>`,
}));

// --- Impressum ---
fs.writeFileSync(path.join(OUT, 'impressum.html'), page({
  file: 'impressum.html', title: 'Impressum | Schmuckkultur Renate Weiss',
  desc: 'Impressum und Datenschutz – Schmuckkultur Renate Weiss, Mödling.',
  active: null,
  content: `  <div class="layout layout-single">
    <div class="content-text legal">
${buildImpressum()}
    </div>
  </div>`,
}));

/* ================= CSS ================= */

fs.writeFileSync(path.join(OUT, 'style.css'), `/* Schmuckkultur Renate Weiss — breite V2 (2026) */
:root {
  --text: #333333;
  --muted: #6e6e6e;
  --line: #d8d6d2;
  --link: #0033cc;
  --bg-out: #f6f5f3;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg-out);
  color: var(--text);
  font-family: Verdana, Arial, Helvetica, sans-serif;
  font-size: 15px;
  line-height: 1.65;
}
img { max-width: 100%; height: auto; display: block; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3 { color: #111; font-weight: bold; line-height: 1.3; }
h2 { font-size: 17px; margin: 26px 0 8px; }
h2:first-child { margin-top: 0; }
h3 { font-size: 15px; margin: 22px 0 8px; }

.frame {
  max-width: 1240px;
  margin: 28px auto;
  background: #fff;
  border: 1px solid var(--line);
  padding: 0 44px 8px;
}
@media (max-width: 1330px) { .frame { margin: 16px; } }

/* Header */
header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 40px 0 0; border-bottom: 1px solid var(--line); position: relative; }
.brand { padding-bottom: 22px; margin: 0; font-size: 0; line-height: 0; }
.brand img { width: 330px; height: auto; }
nav { display: flex; gap: 30px; padding-bottom: 16px; flex-wrap: wrap; }
nav a { color: #000; font-size: 14px; text-transform: lowercase; letter-spacing: 0.02em; padding: 4px 0; border-bottom: 2px solid transparent; }
nav a:hover { text-decoration: none; border-bottom-color: #bbb; }
nav a.active { border-bottom-color: #000; }
.nav-t, .burger { display: none; }

/* Grund-Layout */
.layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 56px;
  padding: 36px 0 56px;
  min-height: 460px;
}
.layout-single { grid-template-columns: minmax(0, 1fr); max-width: 860px; }
.layout-full { grid-template-columns: minmax(0, 1fr); }

/* Linke Spalte */
.rail ul { list-style: none; margin: 0; padding: 0; text-align: right; }
.rail li { margin: 0 0 10px; }
.rail a { color: var(--muted); font-size: 15px; }
.rail a:hover { color: #000; text-decoration: none; }
.rail a.active { color: #000; }
.logo-grid { display: grid; grid-template-columns: repeat(auto-fill, 87px); gap: 10px; justify-content: end; }
.logo-grid a { border: 1px solid #000; display: block; line-height: 0; }
.logo-grid a:hover, .logo-grid a.active { outline: 2px solid #000; outline-offset: -1px; }
.side-img img { width: 100%; max-width: 340px; margin-left: auto; }
.side-card { font-size: 14px; color: var(--muted); }
.side-card h2 { font-size: 14px; margin: 24px 0 6px; }
.side-card h2:first-child { margin-top: 0; }
.side-card p { margin: 0 0 4px; }

/* Inhalt */
.content-text { max-width: 640px; min-width: 0; overflow-wrap: break-word; }
.content-text p { margin: 0 0 14px; }
.content-img img { max-width: 560px; }
.quote { font-style: italic; color: #111; font-size: 16px; }
.plain-list { list-style: disc; padding-left: 20px; margin: 6px 0 0; }
.plain-list a { color: #000; }
.hint { font-size: 12px; color: var(--muted); }

/* Startseite */
.home-grid { grid-template-columns: 300px minmax(0, 1fr); }
.home-main { min-width: 0; }
.home-text { max-width: 640px; margin-top: 26px; }

/* Social-Feeds links: EIN Kasten mit Facebook/Instagram-Reitern */
.side-feeds { display: flex; flex-direction: column; }
.tab-row { display: flex; gap: 24px; margin: 0 0 10px; }
.tab-btn { border: 0; background: none; font-family: inherit; font-size: 14px; color: var(--muted); padding: 4px 0; border-bottom: 2px solid transparent; cursor: pointer; text-transform: lowercase; letter-spacing: 0.02em; }
.tab-btn:hover { color: #000; }
.tab-btn.on { color: #000; border-bottom-color: #000; }
.feed-slot { border: 1px solid var(--line); background: #fff; }
.feed-slot[hidden] { display: none; }
.feed-slot iframe { display: block; width: 100%; border: 0; }

/* Cookie-Hinweis (nur Startseite, wegen Meta-Einbettungen) */
.cookie-bar { display: flex; align-items: center; gap: 14px; justify-content: center; background: #f3f2ef; border-bottom: 1px solid var(--line); margin: 0 -44px; padding: 9px 20px; font-size: 12px; color: var(--muted); }
.cookie-bar a { color: var(--link); }
.cookie-bar[hidden] { display: none; }
.cb-x { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: var(--muted); padding: 2px 6px; }
.cb-x:hover { color: #000; }

/* Startseiten-Bild (statisch, ehemals Slider) */
.hero-still { background: #fff; }
.hero-still img { display: block; width: 100%; height: auto; -webkit-user-drag: none; user-select: none; }
.hero-note { margin: 8px 0 0; font-size: 12px; color: var(--muted); text-align: right; }
.hero-note a { color: inherit; }

/* Schmuck-Viewer */
.viewer { min-width: 0; }
.v-main { position: relative; display: flex; align-items: center; justify-content: center; min-height: 320px; }
.v-main img { max-height: 62vh; width: auto; max-width: 100%; margin: 0 auto; -webkit-user-drag: none; user-select: none; }
.v-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  border: 1px solid var(--line); background: rgba(255,255,255,0.9); color: #111;
  width: 44px; height: 44px; font-size: 26px; cursor: pointer; line-height: 1; z-index: 2;
}
.v-arrow:hover { border-color: #000; }
.v-prev { left: 0; } .v-next { right: 0; }
.v-caption { color: var(--muted); font-size: 13px; margin: 14px 0 10px; min-height: 1.4em; }
.v-caption a { color: var(--link); }
.v-thumbs { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 10px; scrollbar-width: thin; }
.v-thumbs button { flex: 0 0 auto; border: 1px solid var(--line); background: #fff; padding: 0; cursor: pointer; line-height: 0; }
.v-thumbs button:hover { border-color: #888; }
.v-thumbs button.on { border-color: #000; outline: 1px solid #000; }

/* Designer */
.designer-detail { min-width: 0; }
.designer-big img { max-width: 480px; margin: 8px 0 4px; }
.designer-site { font-size: 13px; color: var(--muted); margin: 6px 0 10px; }
.thumb-list { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 0; padding: 0; }
.thumb-list a { display: block; border: 1px solid var(--line); line-height: 0; }
.thumb-list a:hover { border-color: #000; }

/* Kategorie-Kacheln (Schmuck-Übersicht) */
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 22px; align-content: start; }
.cat-tile { display: block; color: #000; }
.cat-tile:hover { text-decoration: none; }
.cat-tile-img { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; border: 1px solid var(--line); background: #fff; padding: 12px; }
.cat-tile:hover .cat-tile-img { border-color: #000; }
.cat-tile-img img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
.cat-tile-label { display: block; text-align: center; font-size: 13px; margin-top: 8px; text-transform: lowercase; color: var(--muted); }
.cat-tile:hover .cat-tile-label { color: #000; }

/* Lightbox (Zoom) */
.lightbox { position: fixed; inset: 0; background: rgba(255,255,255,0.97); z-index: 60; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.lightbox[hidden] { display: none; }
.lightbox img { max-width: 94vw; max-height: 94vh; width: auto; height: auto; }
.lb-close { position: absolute; top: 14px; right: 18px; border: 1px solid var(--line); background: #fff; font-size: 26px; line-height: 1; width: 44px; height: 44px; cursor: pointer; }
.lb-close:hover { border-color: #000; }

/* Rechtstexte */
.legal { font-size: 14px; }
.legal h2 { margin-top: 30px; }

/* vCard */
.vcard summary { cursor: pointer; color: var(--link); }
.vcard img { margin-top: 12px; width: 400px; max-width: 100%; }

/* Footer */
footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); padding: 16px 0; }
.foot-info { margin: 0; font-size: 12px; color: var(--muted); text-align: center; flex: 1; padding: 0 16px; }
.foot-links { margin: 0; font-size: 12px; white-space: nowrap; }
.foot-links a { color: var(--muted); }

/* ============ Mobil / Tablet ============ */
@media (max-width: 900px) {
  body { font-size: 15px; }
  .frame { margin: 0; border-left: 0; border-right: 0; padding: 0 20px 8px; }
  header { align-items: center; padding-top: 18px; flex-wrap: wrap; }
  .brand { padding-bottom: 14px; }
  .brand img { width: 240px; }
  .brand img { width: clamp(180px, 55vw, 240px); }
  .burger { display: flex; flex-direction: column; gap: 5px; padding: 10px; cursor: pointer; position: absolute; top: 26px; right: 0; }
  .burger span { display: block; width: 24px; height: 2px; background: #111; }
  .nav-t { display: block; position: absolute; top: 26px; right: 0; width: 44px; height: 40px; opacity: 0; margin: 0; z-index: 3; cursor: pointer; }
  .nav-t:focus-visible ~ .burger { outline: 2px solid #000; outline-offset: 2px; }
  nav { display: none; width: 100%; flex-direction: column; gap: 0; border-top: 1px solid var(--line); padding: 6px 0 12px; }
  nav a { padding: 10px 2px; font-size: 15px; border-bottom: 0; }
  nav a.active { font-weight: bold; }
  .nav-t:checked ~ nav { display: flex; }
  .layout, .home-grid { grid-template-columns: 1fr; gap: 30px; padding: 24px 0 40px; }
  .rail ul { text-align: left; column-count: 2; column-gap: 24px; }
  .logo-grid { justify-content: start; grid-template-columns: repeat(auto-fill, 72px); }
  .logo-grid img { width: 70px; height: 68px; }
  .side-img img { margin-left: 0; max-width: 300px; }
  .cat-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .home-grid .side-feeds { order: 2; max-width: 340px; width: 100%; }
  .home-grid .home-main { order: 1; }
  .rail-designer { order: 2; }
  .cookie-bar { margin: 0 -20px; text-align: left; }
  .v-main img { max-height: 52vh; }
  .v-arrow { width: 40px; height: 40px; }
  .content-img img { max-width: 100%; }
  .designer-big img { max-width: 100%; }
  footer { flex-direction: column; gap: 10px; padding: 18px 0; }
}
`);

/* ================= JS ================= */

fs.writeFileSync(path.join(OUT, 'viewer.js'), `// Schmuck-Viewer (ohne Fremdbibliotheken). Deep-Link: #p<ID>
(function () {
  var dataEl = document.getElementById('v-data');
  if (!dataEl) return;
  var items = JSON.parse(dataEl.textContent);
  if (!items.length) return;
  var img = document.getElementById('v-img');
  var cap = document.getElementById('v-caption');
  var thumbs = document.getElementById('v-thumbs').querySelectorAll('button');
  var idx = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function captionHtml(p) {
    var parts = [];
    if (p.d) parts.push('Designer: ' + (p.ds ? '<a href="designer-' + esc(p.ds) + '.html">' + esc(p.d) + '</a>' : esc(p.d)));
    if (p.b) parts.push('Beschreibung: ' + esc(p.b));
    parts.push((idx + 1) + ' / ' + items.length);
    return parts.join(' &nbsp;·&nbsp; ');
  }
  function show(i, setHash) {
    idx = (i + items.length) % items.length;
    var p = items[idx];
    img.src = p.img;
    if (p.img2x) img.srcset = p.img + ' 1x, ' + p.img2x + ' 2x'; else img.removeAttribute('srcset');
    cap.innerHTML = captionHtml(p);
    thumbs.forEach(function (t, j) { t.classList.toggle('on', j === idx); });
    if (thumbs[idx] && thumbs[idx].scrollIntoView) thumbs[idx].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    if (setHash !== false) history.replaceState(null, '', '#p' + p.id);
    [1, -1].forEach(function (o) {
      var n = items[(idx + o + items.length) % items.length];
      var pre = new Image(); pre.src = n.img;
    });
  }
  thumbs.forEach(function (t) {
    t.addEventListener('click', function () { show(parseInt(t.getAttribute('data-i'), 10)); });
  });
  document.querySelector('.v-prev').addEventListener('click', function () { show(idx - 1); });
  document.querySelector('.v-next').addEventListener('click', function () { show(idx + 1); });
  document.addEventListener('keydown', function (e) {
    var lbEl = document.getElementById('v-lightbox');
    if (lbEl && !lbEl.hidden) return; // Lightbox offen → deren eigener Handler übernimmt
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
  var x0 = null;
  var main = document.querySelector('.v-main');
  main.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
  main.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
  });
  // Zoom: Klick aufs Bild öffnet die Großansicht (beste verfügbare Auflösung)
  var lb = document.getElementById('v-lightbox');
  var lbImg = document.getElementById('lb-img');
  function openLb() {
    var p = items[idx];
    lbImg.src = p.img2x || p.img;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLb() { lb.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; }
  img.addEventListener('click', openLb);
  img.style.cursor = 'zoom-in';
  lb.addEventListener('click', closeLb);
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') { show(idx - 1); lbImg.src = items[idx].img2x || items[idx].img; }
    if (e.key === 'ArrowRight') { show(idx + 1); lbImg.src = items[idx].img2x || items[idx].img; }
  });

  var start = 0;
  var hm = location.hash.match(/^#p(\\w+)$/);
  if (hm) {
    var f = items.findIndex(function (p) { return String(p.id) === hm[1]; });
    if (f >= 0) start = f;
  }
  show(start, false);
})();
`);

/* ================= Statisches ================= */

fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(OUT, 'LIVEGANG-HINWEIS.md'), `# Vor dem Livegang auf schmuckkultur.at
1. In allen HTML-Dateien die Zeile \`<meta name="robots" content="noindex, nofollow, noarchive">\` entfernen.
2. \`robots.txt\` ersetzen durch: \`User-agent: *\` + \`Allow: /\` (oder Datei löschen).
3. Datenschutz/Impressum nochmals prüfen (Analytics-/Facebook-Abschnitte wurden entfernt, weil die neue Seite kein Tracking nutzt).
`);

// Bilder kopieren (kompletter images-Ordner des Spiegels)
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
copyDir(path.join(SRC, 'images'), path.join(OUT, 'images'));
// _assets-Overrides zuletzt: eigene (z. B. KI-hochskalierte) Bilder ersetzen die Spiegel-Versionen
if (fs.existsSync(path.join(ASSETS, 'images'))) copyDir(path.join(ASSETS, 'images'), path.join(OUT, 'images'));

/* ================= Report ================= */
const nProducts = Object.values(products).reduce((a, b) => a + b.length, 0);
const pages = fs.readdirSync(OUT).filter((f) => f.endsWith('.html'));
console.log('Seiten erzeugt:', pages.length);
console.log('Produkte gesamt:', nProducts, Object.fromEntries(Object.entries(products).map(([k, v]) => [k, v.length])));
console.log('Designer:', designers.length, '| mit Produktgruppen:', designers.filter((d) => d.groups.length).length);
console.log('Kooperationen:', KOOPS.length);
const noDesigner = Object.values(products).flat().filter((p) => !p.designerName).length;
console.log('Produkte ohne Designer-Angabe:', noDesigner);

// Keep the approved preview repairs in every future generated build.
require('./repair-preview')(OUT);
