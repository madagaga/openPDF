// openPDF – éditeur PDF côté navigateur (pdf.js pour l'affichage, pdf-lib pour l'export).
// Les annotations sont stockées en coordonnées PDF (espace utilisateur), ce qui les rend
// indépendantes du zoom et de la rotation d'affichage.

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument, StandardFonts, BlendMode, rgb, degrees } = PDFLib;

const $ = (id) => document.getElementById(id);
const view = $('view'), thumbsEl = $('thumbs');

const S = {
  docs: [],        // { bytes, js } – un par fichier source
  pages: [],       // { doc, idx, rot, annots[] } – ordre affiché/exporté
  scale: 1.25,
  tool: 'select',
  sel: null,       // { pi, ai }
  editing: null,   // { pi, ai } – texte en cours d'édition
  pending: null,   // image à placer { src, w, h }
  undo: [], redo: [],
  name: 'document.pdf',
  current: 0,
  dirty: false,    // modifications non exportées (garde contre F5 / fermeture)
  saveId: null,    // sauvegarde (localStorage) à laquelle Ctrl+S se réfère
};
const jsPages = new Map();  // cache des pages pdf.js, clé "doc:idx"
let els = [];               // par page affichée : { el, ov, vp }

// ---------- chargement ----------

// meta : { name, size, fp, blank? } – décrit le document sans ses octets (sert à la sauvegarde).
const fingerprintOf = (js) => (js.fingerprints && js.fingerprints[0]) || js.fingerprint;

async function addDoc(bytes, extra) {
  const js = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  S.docs.push({ bytes, js, meta: { size: bytes.length, fp: fingerprintOf(js), ...extra } });
  return S.docs.length - 1;
}

async function openFile(file, merge) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!merge) {
    S.docs = []; S.pages = []; S.undo = []; S.redo = []; S.sel = null; S.dirty = false; S.saveId = null;
    jsPages.clear();
    S.name = file.name;
    offerSave(null);
  } else pushUndo();
  const d = await addDoc(bytes, { name: file.name });
  for (let i = 0; i < S.docs[d].js.numPages; i++) S.pages.push({ doc: d, idx: i, rot: 0, annots: [] });
  await refresh(true);
  if (!merge) offerSave(latestSaveFor(S.docs[d].meta.fp));
}

async function getJsPage(p) {
  const key = p.doc + ':' + p.idx;
  if (!jsPages.has(key)) jsPages.set(key, await S.docs[p.doc].js.getPage(p.idx + 1));
  return jsPages.get(key);
}

const totalRot = (jp, p) => (jp.rotate + p.rot) % 360;

// ---------- rendu ----------

let renderGen = 0;
let layoutSig = '';
const sig = () => S.pages.map(p => `${p.doc}:${p.idx}:${p.rot}`).join('|') + '@' + S.scale;

async function refresh(force) {
  if (force || sig() !== layoutSig) { await render(); renderThumbs(); }
  else els.forEach((_, i) => drawOverlay(i));
  $('zoomLabel').textContent = Math.round(S.scale * 100) + '%';
}

async function render() {
  const gen = ++renderGen;
  layoutSig = sig();
  const scrollRatio = view.scrollTop / (view.scrollHeight || 1);
  view.innerHTML = '';
  els = [];
  const dpr = window.devicePixelRatio || 1;
  for (let i = 0; i < S.pages.length; i++) {
    const p = S.pages[i];
    const jp = await getJsPage(p);
    if (gen !== renderGen) return;
    const vp = jp.getViewport({ scale: S.scale, rotation: totalRot(jp, p) });
    const el = document.createElement('div');
    el.className = 'page';
    el.style.width = vp.width + 'px';
    el.style.height = vp.height + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * dpr);
    canvas.height = Math.floor(vp.height * dpr);
    canvas.style.width = vp.width + 'px';
    canvas.style.height = vp.height + 'px';
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.addEventListener('pointerdown', (e) => onDown(e, i));
    ov.addEventListener('dblclick', (e) => onDblClick(e, i));
    ov.addEventListener('pointermove', (e) => onHover(e, i));
    ov.addEventListener('pointerleave', () => els[i] && els[i].hot && els[i].hot.remove());
    el.append(canvas, ov);
    view.append(el);
    els[i] = { el, ov, vp };
    jp.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
    drawOverlay(i);
  }
  view.scrollTop = scrollRatio * view.scrollHeight;
  updateCursor();
}

function boxOf(a, vp) {
  const [x1, y1] = vp.convertToViewportPoint(...a.p1);
  const [x2, y2] = vp.convertToViewportPoint(...a.p2);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

const FONT_CSS = { Helvetica: 'Helvetica, Arial, sans-serif', Times: '"Times New Roman", Times, serif', Courier: '"Courier New", Courier, monospace' };

function drawOverlay(i) {
  const { ov, vp } = els[i];
  const p = S.pages[i];
  ov.innerHTML = '';
  let svg = null;
  p.annots.forEach((a, ai) => {
    const selected = S.sel && S.sel.pi === i && S.sel.ai === ai;
    if (a.type === 'ink') {
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ink');
        ov.append(svg);
      }
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', a.pts.map(pt => vp.convertToViewportPoint(...pt).join(',')).join(' '));
      pl.setAttribute('stroke', a.color);
      pl.setAttribute('stroke-width', a.width * S.scale);
      pl.dataset.a = ai;
      if (selected) pl.classList.add('sel');
      svg.append(pl);
      return;
    }
    const d = document.createElement('div');
    d.dataset.a = ai;
    d.className = 'a' + (selected ? ' sel' : '');
    if (a.type === 'text') {
      const [x, y] = vp.convertToViewportPoint(...a.p1);
      d.classList.add('a-text');
      Object.assign(d.style, {
        left: x + 'px', top: y + 'px', color: a.color,
        fontSize: a.size * S.scale + 'px', fontFamily: FONT_CSS[a.font],
      });
      d.textContent = a.text;
      const editing = S.editing && S.editing.pi === i && S.editing.ai === ai;
      if (editing) {
        d.contentEditable = 'true';
        d.addEventListener('input', () => { a.text = d.innerText; });
        d.addEventListener('blur', () => stopEditing());
        requestAnimationFrame(() => { d.focus(); placeCaretEnd(d); });
      }
    } else {
      const b = boxOf(a, vp);
      d.classList.add('a-box');
      Object.assign(d.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
      if (a.type === 'image') {
        const img = document.createElement('img');
        img.src = a.src;
        d.append(img);
      } else if (a.type === 'highlight') {
        d.style.background = a.color; d.style.opacity = 0.35; d.style.mixBlendMode = 'multiply';
      } else if (a.type === 'whiteout') {
        d.style.background = '#fff';
      } else if (a.type === 'rect') {
        d.style.border = `${a.width * S.scale}px solid ${a.color}`;
      }
      if (selected) {
        const h = document.createElement('div');
        h.className = 'handle';
        d.append(h);
      }
    }
    ov.append(d);
  });
}

function placeCaretEnd(el) {
  const r = document.createRange();
  r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}

function stopEditing() {
  if (!S.editing) return;
  const { pi, ai } = S.editing;
  S.editing = null;
  const a = S.pages[pi] && S.pages[pi].annots[ai];
  if (a && !a.text.trim()) { S.pages[pi].annots.splice(ai, 1); S.sel = null; }
  if (els[pi]) drawOverlay(pi);
}

// ---------- miniatures ----------

let thumbGen = 0;
async function renderThumbs() {
  const gen = ++thumbGen;
  thumbsEl.innerHTML = '';
  for (let i = 0; i < S.pages.length; i++) {
    const p = S.pages[i];
    const jp = await getJsPage(p);
    if (gen !== thumbGen) return;
    const t = document.createElement('div');
    t.className = 'thumb' + (i === S.current ? ' current' : '');
    t.draggable = true;
    t.dataset.i = i;
    const c = document.createElement('canvas');
    const acts = document.createElement('div');
    acts.className = 'acts';
    acts.innerHTML = `<button data-act="l" title="${tr('page.rotL')}">↺</button><button data-act="r" title="${tr('page.rotR')}">↻</button><button data-act="x" title="${tr('page.delete')}">🗑</button>`;
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i + 1;
    t.append(c, acts, num);
    thumbsEl.append(t);

    acts.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      e.stopPropagation();
      pageAction(act, i);
    });
    t.addEventListener('click', () => els[i] && els[i].el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    t.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/page', i));
    t.addEventListener('dragover', (e) => { e.preventDefault(); t.classList.add('over'); });
    t.addEventListener('dragleave', () => t.classList.remove('over'));
    t.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = +e.dataTransfer.getData('text/page');
      if (Number.isNaN(from) || from === i) return;
      pushUndo();
      const [moved] = S.pages.splice(from, 1);
      S.pages.splice(i, 0, moved);
      S.sel = null;
      refresh();
    });

    const vp = jp.getViewport({ scale: 0.2, rotation: totalRot(jp, p) });
    c.width = vp.width; c.height = vp.height;
    await jp.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}

// act : 'l' / 'r' (pivoter) ou 'x' (supprimer) ; utilisé par les miniatures et l'onglet Page.
function pageAction(act, i) {
  if (!S.pages[i]) return;
  pushUndo();
  if (act === 'x') {
    S.pages.splice(i, 1); S.sel = null;
    S.current = Math.max(0, Math.min(S.current, S.pages.length - 1));
  } else S.pages[i].rot = (S.pages[i].rot + (act === 'r' ? 90 : 270)) % 360;
  refresh();
}
$('pgL').onclick = () => pageAction('l', S.current);
$('pgR').onclick = () => pageAction('r', S.current);
$('pgX').onclick = () => pageAction('x', S.current);

view.addEventListener('scroll', () => {
  const mid = view.getBoundingClientRect().top + view.clientHeight / 3;
  let cur = 0;
  els.forEach((e, i) => { if (e.el.getBoundingClientRect().top <= mid) cur = i; });
  if (cur !== S.current) {
    S.current = cur;
    thumbsEl.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('current', i === cur));
  }
});

// ---------- interactions ----------

function local(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onDown(e, i) {
  if (e.button !== 0) return;
  const { ov, vp } = els[i];
  const p = S.pages[i];
  const pt = local(e, ov);
  const toPdf = (x, y) => vp.convertToPdfPoint(x, y);
  const color = $('color').value;

  switch (S.tool) {
    case 'select': {
      const t = e.target.closest('[data-a]');
      if (t && t.isContentEditable) return; // laisser le curseur texte fonctionner
      stopEditing();
      if (!t) { select(null); return; }
      e.preventDefault();
      select({ pi: i, ai: +t.dataset.a });
      dragAnnot(e, i, +t.dataset.a, e.target.classList.contains('handle'));
      return;
    }
    case 'text': {
      e.preventDefault();
      stopEditing();
      pushUndo();
      p.annots.push({ type: 'text', p1: toPdf(pt.x, pt.y), text: '', size: +$('size').value, font: $('font').value, color });
      const ai = p.annots.length - 1;
      S.sel = { pi: i, ai };
      S.editing = { pi: i, ai };
      setTool('select');
      drawOverlay(i);
      return;
    }
    case 'edit': {
      const t = e.target.closest('[data-a]');
      if (t && t.isContentEditable) return;
      e.preventDefault();
      stopEditing();
      if (t && p.annots[+t.dataset.a].type === 'text') { startEdit(i, +t.dataset.a); return; }
      getBoxes(i).then((boxes) => editTextAt(i, pt, boxes));
      return;
    }
    case 'rect': case 'highlight': case 'whiteout': {
      e.preventDefault();
      const tmp = document.createElement('div');
      tmp.className = 'a';
      tmp.style.outline = '1px dashed ' + (S.tool === 'whiteout' ? '#888' : color);
      ov.append(tmp);
      let box = null;
      track(e, (q) => {
        const c = local(q, ov);
        box = { x: Math.min(pt.x, c.x), y: Math.min(pt.y, c.y), w: Math.abs(c.x - pt.x), h: Math.abs(c.y - pt.y) };
        Object.assign(tmp.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
      }, () => {
        tmp.remove();
        if (!box || box.w < 4 || box.h < 4) return;
        pushUndo();
        p.annots.push({
          type: S.tool, color, width: +$('width').value,
          p1: toPdf(box.x, box.y), p2: toPdf(box.x + box.w, box.y + box.h),
        });
        drawOverlay(i);
      });
      return;
    }
    case 'ink': {
      e.preventDefault();
      const pts = [[pt.x, pt.y]];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ink');
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('stroke', color);
      pl.setAttribute('stroke-width', $('width').value * S.scale);
      svg.append(pl);
      ov.append(svg);
      track(e, (q) => {
        const c = local(q, ov);
        pts.push([c.x, c.y]);
        pl.setAttribute('points', pts.map(v => v.join(',')).join(' '));
      }, () => {
        if (pts.length < 2) { svg.remove(); return; }
        pushUndo();
        p.annots.push({ type: 'ink', color, width: +$('width').value, pts: pts.map(v => toPdf(...v)) });
        drawOverlay(i);
      });
      return;
    }
    case 'place': {
      if (!S.pending) return;
      e.preventDefault();
      const { src, w, h } = S.pending;
      const k = Math.min(1, 220 / w) * S.scale;
      const bw = w * k, bh = h * k;
      const x = pt.x - bw / 2, y = pt.y - bh / 2;
      pushUndo();
      p.annots.push({ type: 'image', src, p1: toPdf(x, y), p2: toPdf(x + bw, y + bh) });
      S.pending = null;
      S.sel = { pi: i, ai: p.annots.length - 1 };
      setTool('select');
      drawOverlay(i);
      return;
    }
  }
}

function onDblClick(e, i) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const ai = +t.dataset.a;
  if (t.isContentEditable || S.pages[i].annots[ai].type !== 'text') return;
  startEdit(i, ai);
}

function startEdit(i, ai) {
  pushUndo();
  S.editing = { pi: i, ai };
  S.sel = { pi: i, ai };
  drawOverlay(i);
}

// ---------- édition du texte existant ----------
// Le texte d'origine est masqué par un cache blanc, puis remplacé par une annotation texte
// éditable de même taille/position. Les lignes sont reconstituées en fusionnant les fragments
// pdf.js contigus (même ligne, même police).

const BASELINE = 0.92; // position de la ligne de base sous le haut d'un texte (cf. export)

function getBoxes(i) {
  const e = els[i];
  if (!e.boxesP) e.boxesP = computeBoxes(i);
  return e.boxesP;
}

async function computeBoxes(i) {
  const { vp } = els[i];
  const jp = await getJsPage(S.pages[i]);
  const tc = await jp.getTextContent();
  const boxes = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.str.trim()) boxes.push(cur);
    cur = null;
  };
  for (const it of tc.items) {
    if (typeof it.str !== 'string') continue;
    const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
    const h = Math.hypot(tx[2], tx[3]);
    if (!h || Math.abs(tx[1]) > 0.05 * h || Math.abs(tx[2]) > 0.05 * h) { flush(); continue; } // texte tourné : ignoré
    const w = it.width * vp.scale;
    const fam = (tc.styles[it.fontName] || {}).fontFamily || '';
    const font = /mono|courier/i.test(fam) ? 'Courier' : /serif|times|georgia/i.test(fam) && !/sans/i.test(fam) ? 'Times' : 'Helvetica';
    if (cur && cur.fontName === it.fontName && Math.abs(tx[5] - cur.base) < 0.2 * h && tx[4] - (cur.left + cur.width) < 0.6 * h && tx[4] >= cur.left) {
      cur.str += it.str;
      cur.width = tx[4] + w - cur.left;
      continue;
    }
    flush();
    cur = { str: it.str, left: tx[4], base: tx[5], width: w, h, fontName: it.fontName, font };
  }
  flush();
  return boxes.map((b) => ({
    str: b.str.replace(/\s+$/, ''), font: b.font, size: Math.round(b.h / vp.scale * 10) / 10,
    left: b.left, top: b.base - BASELINE * b.h,
    x: b.left - 1, y: b.base - 0.95 * b.h, w: b.width + 2, h: 1.2 * b.h,
  }));
}

const inBox = (b, pt, m = 0) => pt.x >= b.x - m && pt.x <= b.x + b.w + m && pt.y >= b.y - m && pt.y <= b.y + b.h + m;

function hitBox(boxes, pt) {
  return boxes.find((b) => inBox(b, pt, 2));
}

function editTextAt(i, pt, boxes) {
  const p = S.pages[i];
  const { vp } = els[i];
  const toPdf = (x, y) => vp.convertToPdfPoint(x, y);
  // Texte déjà édité : on rouvre l'annotation au lieu d'empiler un second cache.
  for (const w of p.annots) {
    if (!w.edit) continue;
    const b = boxOf(w, vp);
    if (!inBox(b, pt)) continue;
    const ai = p.annots.findIndex((a) => {
      if (a.type !== 'text') return false;
      const [x, y] = vp.convertToViewportPoint(...a.p1);
      return inBox(b, { x, y }, 3);
    });
    if (ai >= 0) startEdit(i, ai);
    return;
  }
  const b = hitBox(boxes, pt);
  if (!b) return;
  pushUndo();
  p.annots.push({ type: 'whiteout', edit: true, color: '#000000', width: 2, p1: toPdf(b.x, b.y), p2: toPdf(b.x + b.w, b.y + b.h) });
  p.annots.push({ type: 'text', p1: toPdf(b.left, b.top), text: b.str, size: b.size, font: b.font, color: '#000000' });
  const ai = p.annots.length - 1;
  S.sel = { pi: i, ai };
  S.editing = { pi: i, ai };
  drawOverlay(i);
}

function onHover(e, i) {
  const el = els[i];
  if (!el) return;
  if (S.tool !== 'edit' || S.editing) { if (el.hot) el.hot.remove(); return; }
  if (!el.boxes) { getBoxes(i).then((b) => { el.boxes = b; }); return; }
  const b = hitBox(el.boxes, local(e, el.ov));
  if (!b) { if (el.hot) el.hot.remove(); return; }
  if (!el.hot) { el.hot = document.createElement('div'); el.hot.className = 'hot'; }
  Object.assign(el.hot.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
  if (!el.hot.isConnected) el.ov.append(el.hot);
}

function track(e, move, up) {
  const onMove = (q) => move(q);
  const onUp = (q) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    up(q);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function dragAnnot(e, i, ai, resize) {
  const { vp } = els[i];
  const a = S.pages[i].annots[ai];
  const orig = JSON.parse(JSON.stringify(a));
  const sx = e.clientX, sy = e.clientY;
  const shift = (pt, dx, dy) => {
    const [x, y] = vp.convertToViewportPoint(...pt);
    return vp.convertToPdfPoint(x + dx, y + dy);
  };
  let moved = false;
  track(e, (q) => {
    const dx = q.clientX - sx, dy = q.clientY - sy;
    if (!moved) {
      if (Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      pushUndo(orig, i, ai);
    }
    if (resize && orig.p2) {
      const b = boxOf(orig, vp);
      let w = Math.max(6, b.w + dx), h = Math.max(6, b.h + dy);
      if (a.type === 'image') h = w * b.h / b.w;
      a.p1 = vp.convertToPdfPoint(b.x, b.y);
      a.p2 = vp.convertToPdfPoint(b.x + w, b.y + h);
    } else {
      if (orig.p1) a.p1 = shift(orig.p1, dx, dy);
      if (orig.p2) a.p2 = shift(orig.p2, dx, dy);
      if (orig.pts) a.pts = orig.pts.map(pt => shift(pt, dx, dy));
    }
    drawOverlay(i);
    if (!resize) els[i].el.classList.add('dragging');
  }, (q) => {
    els[i].el.classList.remove('dragging');
    if (!moved || resize) return;
    const j = els.findIndex(({ ov }) => {
      const r = ov.getBoundingClientRect();
      return q.clientX >= r.left && q.clientX <= r.right && q.clientY >= r.top && q.clientY <= r.bottom;
    });
    if (j < 0 || j === i) return;
    // Transfert vers une autre page : on passe par les coordonnées écran.
    const src = els[i].ov.getBoundingClientRect(), dst = els[j].ov.getBoundingClientRect();
    const transfer = (pt) => {
      const [x, y] = vp.convertToViewportPoint(...pt);
      return els[j].vp.convertToPdfPoint(x + src.left - dst.left, y + src.top - dst.top);
    };
    if (a.p1) a.p1 = transfer(a.p1);
    if (a.p2) a.p2 = transfer(a.p2);
    if (a.pts) a.pts = a.pts.map(transfer);
    S.pages[i].annots.splice(ai, 1);
    S.pages[j].annots.push(a);
    S.sel = { pi: j, ai: S.pages[j].annots.length - 1 };
    drawOverlay(i);
    drawOverlay(j);
  });
}

function select(sel) {
  const prev = S.sel;
  S.sel = sel;
  if (sel) {
    const a = S.pages[sel.pi].annots[sel.ai];
    if (a.color) $('color').value = a.color;
    if (a.size) $('size').value = a.size;
    if (a.font) $('font').value = a.font;
    if (a.width) $('width').value = a.width;
  }
  if (prev && els[prev.pi] && (!sel || prev.pi !== sel.pi)) drawOverlay(prev.pi);
  if (sel) drawOverlay(sel.pi);
}

function selected() {
  return S.sel && S.pages[S.sel.pi] && S.pages[S.sel.pi].annots[S.sel.ai];
}

function deleteSelected() {
  if (!selected()) return;
  pushUndo();
  const { pi, ai } = S.sel;
  S.pages[pi].annots.splice(ai, 1);
  S.sel = null;
  drawOverlay(pi);
}

// Collage sur la page de l'élément sélectionné (sinon la page courante), décalé
// de 15 px à chaque collage successif pour qu'il ne masque pas l'original.
let clipboard = null, pasteCount = 0;
function paste() {
  if (!clipboard || !S.pages.length) return;
  const pi = S.sel ? S.sel.pi : S.current;
  const { vp } = els[pi];
  const a = JSON.parse(clipboard);
  const d = 15 * ++pasteCount;
  const shift = (pt) => {
    const [x, y] = vp.convertToViewportPoint(...pt);
    return vp.convertToPdfPoint(x + d, y + d);
  };
  if (a.p1) a.p1 = shift(a.p1);
  if (a.p2) a.p2 = shift(a.p2);
  if (a.pts) a.pts = a.pts.map(shift);
  pushUndo();
  S.pages[pi].annots.push(a);
  select({ pi, ai: S.pages[pi].annots.length - 1 });
}

// ---------- outils & propriétés ----------

let inkColor = '#000000';
function setTool(tool) {
  if (S.tool === 'highlight' && tool !== 'highlight') $('color').value = inkColor;
  else if (tool === 'highlight' && S.tool !== 'highlight') { inkColor = $('color').value; $('color').value = '#ffe600'; }
  S.tool = tool;
  if (tool !== 'place') S.pending = null;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  if (TOOL_TAB[tool]) showTab(TOOL_TAB[tool]);
  updateCursor();
}

// ---------- ruban ----------

const TOOL_TAB = { select: 'edit', edit: 'edit', text: 'insert', rect: 'insert', highlight: 'insert', whiteout: 'insert', ink: 'insert' };

function showTab(name) {
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  $('props').hidden = name !== 'edit' && name !== 'insert';
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

function updateCursor() {
  els.forEach(({ ov }) => {
    ov.classList.toggle('draw', ['text', 'rect', 'highlight', 'whiteout', 'ink'].includes(S.tool));
    ov.classList.toggle('place', S.tool === 'place');
    ov.classList.toggle('edit', S.tool === 'edit');
  });
}

document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

function applyProp(key, value) {
  const a = selected();
  if (!a || !(key in a)) return;
  pushUndo();
  a[key] = value;
  drawOverlay(S.sel.pi);
}
$('color').addEventListener('change', (e) => applyProp('color', e.target.value));
$('size').addEventListener('change', (e) => applyProp('size', +e.target.value));
$('font').addEventListener('change', (e) => applyProp('font', e.target.value));
$('width').addEventListener('change', (e) => applyProp('width', +e.target.value));

// ---------- annuler / rétablir ----------

// `orig` permet d'enregistrer l'état d'une annotation avant un déplacement déjà commencé.
function pushUndo(orig, pi, ai) {
  let snap = JSON.stringify(S.pages);
  if (orig) {
    const pages = JSON.parse(snap);
    pages[pi].annots[ai] = orig;
    snap = JSON.stringify(pages);
  }
  S.undo.push(snap);
  if (S.undo.length > 100) S.undo.shift();
  S.redo = [];
  S.dirty = true;
}

function restore(from, to) {
  if (!from.length) return;
  stopEditing();
  to.push(JSON.stringify(S.pages));
  S.pages = JSON.parse(from.pop());
  S.sel = null;
  refresh();
}
$('undo').onclick = () => restore(S.undo, S.redo);
$('redo').onclick = () => restore(S.redo, S.undo);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
  if (S.editing || e.target.matches('input, select, textarea')) {
    if (e.key === 'Escape' && S.editing) { document.activeElement.blur(); }
    return;
  }
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? $('redo').click() : $('undo').click(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); $('redo').click(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'c') { if (selected()) { clipboard = JSON.stringify(selected()); pasteCount = 0; } }
  else if ((e.ctrlKey || e.metaKey) && k === 'v') { e.preventDefault(); paste(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.key === 'Escape') { select(null); setTool('select'); }
  else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const map = { v: 'select', t: 'text', e: 'edit', h: 'highlight', r: 'rect', w: 'whiteout', d: 'ink' };
    if (map[k] && S.pages.length) setTool(map[k]);
  }
});

// ---------- fichiers ----------

const pickPdf = (merge) => (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) openFile(f, merge && S.pages.length > 0);
};
$('open').onchange = pickPdf(false);
$('open2').onchange = pickPdf(false);
$('merge').onchange = pickPdf(true);

view.addEventListener('dragover', (e) => { e.preventDefault(); $('drop')?.classList.add('over'); });
view.addEventListener('dragleave', () => $('drop')?.classList.remove('over'));
view.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = [...e.dataTransfer.files].find(f => f.type === 'application/pdf');
  if (f) openFile(f, S.pages.length > 0);
});

$('blank').onclick = async () => {
  const d = await PDFDocument.create();
  const ref = S.pages[S.current];
  let size = [595.28, 841.89]; // A4
  if (ref) { const jp = await getJsPage(ref); size = [jp.view[2] - jp.view[0], jp.view[3] - jp.view[1]]; }
  d.addPage(size);
  if (S.pages.length) pushUndo();
  const di = await addDoc(await d.save(), { name: 'Page blanche', blank: size });
  S.pages.splice(S.pages.length ? S.current + 1 : 0, 0, { doc: di, idx: 0, rot: 0, annots: [] });
  await refresh();
};

function readImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ src, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = rej;
    img.src = src;
  });
}

$('image').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !S.pages.length) return;
  const src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  S.pending = await readImage(src);
  setTool('place');
};

// ---------- signature ----------

const pad = $('pad'), pctx = pad.getContext('2d');
function clearPad() { pctx.clearRect(0, 0, pad.width, pad.height); }
pad.addEventListener('pointerdown', (e) => {
  const r = pad.getBoundingClientRect(), k = pad.width / r.width;
  pctx.lineWidth = 2.5; pctx.lineCap = pctx.lineJoin = 'round'; pctx.strokeStyle = $('color').value;
  pctx.beginPath();
  pctx.moveTo((e.clientX - r.left) * k, (e.clientY - r.top) * k);
  track(e, (q) => { pctx.lineTo((q.clientX - r.left) * k, (q.clientY - r.top) * k); pctx.stroke(); }, () => {});
});
$('sign').onclick = () => { if (S.pages.length) { clearPad(); $('signDlg').showModal(); } };
$('padClear').onclick = clearPad;
$('padCancel').onclick = () => $('signDlg').close();
$('padOk').onclick = async () => {
  // recadre la signature sur sa zone dessinée
  const { data, width, height } = pctx.getImageData(0, 0, pad.width, pad.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  $('signDlg').close();
  if (x1 < 0) return;
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 7; c.height = y1 - y0 + 7;
  c.getContext('2d').drawImage(pad, x0 - 3, y0 - 3, c.width, c.height, 0, 0, c.width, c.height);
  S.pending = await readImage(c.toDataURL('image/png'));
  setTool('place');
};

// ---------- zoom ----------

function zoom(f) {
  S.scale = Math.min(4, Math.max(0.25, Math.round(S.scale * f * 100) / 100));
  if (S.pages.length) refresh(); else $('zoomLabel').textContent = Math.round(S.scale * 100) + '%';
}
$('zoomIn').onclick = () => zoom(1.2);
$('zoomOut').onclick = () => zoom(1 / 1.2);

// ---------- export ----------

const hexToRgb = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const dataUrlBytes = (u) => Uint8Array.from(atob(u.split(',')[1]), c => c.charCodeAt(0));

// Les polices standard ne couvrent que WinAnsi : on remplace les caractères non encodables.
function safeText(font, s) {
  return [...s].map(ch => { try { font.encodeText(ch); return ch; } catch { return '?'; } }).join('');
}

async function exportPdf() {
  stopEditing();
  const out = await PDFDocument.create();
  const srcs = await Promise.all(S.docs.map(d => PDFDocument.load(d.bytes, { ignoreEncryption: true })));
  // Aplatissement : les champs de formulaire sources deviennent du contenu fixe.
  // Nos ajouts sont déjà dessinés dans le flux de contenu de la page, pas en annotations.
  for (const src of srcs) {
    try { src.getForm().flatten(); } catch (err) { console.warn('Aplatissement du formulaire impossible', err); }
  }
  const fonts = {
    Helvetica: await out.embedFont(StandardFonts.Helvetica),
    Times: await out.embedFont(StandardFonts.TimesRoman),
    Courier: await out.embedFont(StandardFonts.Courier),
  };
  const images = new Map();
  const embedImage = async (src) => {
    if (!images.has(src)) {
      const b = dataUrlBytes(src);
      images.set(src, src.startsWith('data:image/png') ? await out.embedPng(b) : await out.embedJpg(b));
    }
    return images.get(src);
  };

  for (const p of S.pages) {
    const [page] = await out.copyPages(srcs[p.doc], [p.idx]);
    out.addPage(page);
    const jp = await getJsPage(p);
    const R = totalRot(jp, p);
    page.setRotation(degrees(R));
    // Viewport à l'échelle 1 avec la rotation finale : un objet tourné de R degrés
    // (sens trigo, en espace PDF) apparaît droit une fois la page affichée.
    const vp = jp.getViewport({ scale: 1, rotation: R });
    const rot = degrees(R);

    for (const a of p.annots) {
      if (a.type === 'text') {
        const font = fonts[a.font] || fonts.Helvetica;
        const [x, y] = vp.convertToViewportPoint(...a.p1);
        a.text.split('\n').forEach((line, k) => {
          const [px, py] = vp.convertToPdfPoint(x, y + a.size * (0.92 + 1.2 * k));
          page.drawText(safeText(font, line), { x: px, y: py, size: a.size, font, color: hexToRgb(a.color), rotate: rot });
        });
      } else if (a.type === 'ink') {
        const d = a.pts.map((pt, k) => `${k ? 'L' : 'M'}${pt[0]},${-pt[1]}`).join(' ');
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: hexToRgb(a.color), borderWidth: a.width, borderLineCap: 1 });
      } else {
        const b = boxOf(a, vp);
        const [x, y] = vp.convertToPdfPoint(b.x, b.y + b.h);
        const geo = { x, y, width: b.w, height: b.h, rotate: rot };
        if (a.type === 'image') page.drawImage(await embedImage(a.src), geo);
        else if (a.type === 'whiteout') page.drawRectangle({ ...geo, color: rgb(1, 1, 1) });
        else if (a.type === 'highlight') page.drawRectangle({ ...geo, color: hexToRgb(a.color), opacity: 0.35, blendMode: BlendMode.Multiply });
        else if (a.type === 'rect') page.drawRectangle({ ...geo, borderColor: hexToRgb(a.color), borderWidth: a.width });
      }
    }
  }
  return out.save();
}

$('download').onclick = async () => {
  if (!S.pages.length) return;
  const btn = $('download');
  btn.disabled = true; btn.textContent = tr('export.busy');
  try {
    const bytes = await exportPdf();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = S.name.replace(/\.pdf$/i, '') + '-modifie.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    S.dirty = false;
  } catch (err) {
    console.error(err);
    alert(tr('export.fail', err.message));
  } finally {
    btn.disabled = false; btn.textContent = tr('btn.download');
  }
};

// ---------- sauvegardes du projet ----------
// Une sauvegarde = métadonnées seules (pages, annotations, nom + empreinte de chaque PDF), en JSON
// dans le localStorage ; plusieurs sauvegardes coexistent. Les PDF ne sont pas stockés : à la
// restauration l'utilisateur resélectionne les mêmes fichiers, reconnus par l'empreinte pdf.js
// (calculée à l'ouverture, donc sans surcoût). Ouvrir un PDF qui a une sauvegarde propose de la
// restaurer, sans jamais l'appliquer d'office. Les pages blanches sont recréées.
// Écriture explicite uniquement (bouton / Ctrl+S).

const SAVES_KEY = 'openpdf-saves';
const SAVE_VERSION = 2;

function loadSaves() {
  try {
    const all = JSON.parse(localStorage.getItem(SAVES_KEY)) || {};
    return Object.fromEntries(Object.entries(all).filter(([, s]) => s && s.v === SAVE_VERSION));
  } catch { return {}; }
}

function storeSaves(all) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(all));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

const sortedSaves = () => Object.values(loadSaves()).sort((a, b) => b.savedAt - a.savedAt);
const fmtDate = (ts) => new Date(ts).toLocaleString(lang);
const countAnnots = (pages) => pages.reduce((n, p) => n + p.annots.length, 0);

function latestSaveFor(fp) {
  return sortedSaves().find(s => s.docs.some(m => !m.blank && m.fp === fp)) || null;
}

function saveProject() {
  if (!S.pages.length) return;
  stopEditing();
  const all = loadSaves();
  const id = S.saveId && all[S.saveId] ? S.saveId : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  all[id] = { v: SAVE_VERSION, id, name: S.name, savedAt: Date.now(), docs: S.docs.map(d => d.meta), pages: S.pages };
  if (!storeSaves(all)) { alert(tr('save.fail')); return; }
  S.saveId = id;
  S.dirty = false;
  if (offered && offered.id === id) offerSave(null);
  const label = $('save').querySelector('[data-i18n]');
  label.textContent = tr('save.ok');
  setTimeout(() => { label.textContent = tr('btn.save'); }, 1500);
}

// Bandeau « une sauvegarde existe pour ce PDF ».
let offered = null;
function offerSave(save) {
  offered = save;
  $('restoreBar').hidden = !save;
  if (save) $('restoreMsg').textContent = tr('bar.found', fmtDate(save.savedAt));
}
$('restoreYes').onclick = () => {
  const save = offered;
  offerSave(null);
  startRestore(save, S.docs.filter(d => !d.meta.blank).map(d => d.bytes));
};
$('restoreNo').onclick = () => offerSave(null);

// `pre` : octets de PDF déjà en mémoire. S'ils couvrent tous les PDF requis on restaure tout de
// suite ; sinon on ouvre le sélecteur (sans await avant, pour rester dans le geste utilisateur).
let pendingRestore = null;
function startRestore(save, pre) {
  if (S.dirty && !confirm(tr('restore.confirm'))) return;
  const needed = save.docs.filter(m => !m.blank).length;
  if (pre.length >= needed) { applySave(save, pre); return; }
  pendingRestore = { save, pre };
  $('restoreFiles').click();
}

$('restoreFiles').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!pendingRestore || !files.length) return;
  const { save, pre } = pendingRestore;
  pendingRestore = null;
  const chosen = await Promise.all(files.map(async f => new Uint8Array(await f.arrayBuffer())));
  applySave(save, [...pre, ...chosen]);
};

async function applySave(save, list) {
  try {
    const slots = new Array(save.docs.length).fill(null);
    for (const bytes of list) {
      const js = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      const fp = fingerprintOf(js);
      const k = save.docs.findIndex((m, j) => !m.blank && !slots[j] && m.fp === fp);
      if (k >= 0) slots[k] = { bytes, js, meta: save.docs[k] };
    }
    for (let k = 0; k < slots.length; k++) {
      const m = save.docs[k];
      if (slots[k] || !m.blank) continue;
      const d = await PDFDocument.create();
      d.addPage(m.blank);
      const bytes = await d.save();
      slots[k] = { bytes, js: await pdfjsLib.getDocument({ data: bytes.slice() }).promise, meta: m };
    }
    const missing = save.docs.filter((_, k) => !slots[k]).map(m => m.name);
    if (missing.length) { alert(tr('restore.missing', missing.join('\n• '))); return; }
    stopEditing();
    S.docs = slots; S.undo = []; S.redo = []; S.sel = null;
    jsPages.clear();
    S.pages = save.pages;
    S.name = save.name;
    S.saveId = save.id;
    S.current = 0;
    S.dirty = false;
    offerSave(null);
    await refresh(true);
  } catch (err) {
    console.error(err);
    alert(tr('restore.fail', err.message));
  }
}

// Écran de gestion des sauvegardes.
function renderSaves() {
  const list = $('savesList');
  list.innerHTML = '';
  const saves = sortedSaves();
  $('savesClear').disabled = !saves.length;
  if (!saves.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = tr('saves.empty');
    list.append(p);
    return;
  }
  for (const s of saves) {
    const pdfs = [...new Set(s.docs.filter(m => !m.blank).map(m => m.name))];
    const row = document.createElement('div');
    row.className = 'save';
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div'); name.className = 'name'; name.textContent = s.name;
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = tr('saves.meta', fmtDate(s.savedAt), s.pages.length, countAnnots(s.pages));
    const need = document.createElement('div'); need.className = 'meta';
    need.textContent = pdfs.length ? tr('saves.pdfs', pdfs.join(', ')) : tr('saves.noPdfs');
    info.append(name, meta, need);
    const btns = document.createElement('div');
    btns.className = 'btns';
    const restore = document.createElement('button');
    restore.className = 'btn primary'; restore.textContent = tr('saves.restore');
    restore.onclick = () => { $('savesDlg').close(); startRestore(s, []); };
    const del = document.createElement('button');
    del.className = 'btn'; del.textContent = tr('saves.delete');
    del.onclick = () => {
      const all = loadSaves();
      delete all[s.id];
      storeSaves(all);
      if (S.saveId === s.id) S.saveId = null;
      renderSaves();
    };
    btns.append(restore, del);
    row.append(info, btns);
    list.append(row);
  }
}

$('save').onclick = saveProject;
$('saves').onclick = () => { renderSaves(); $('savesDlg').showModal(); };
$('savesClose').onclick = () => $('savesDlg').close();
$('savesClear').onclick = () => {
  if (!confirm(tr('saves.confirmDeleteAll'))) return;
  storeSaves({});
  S.saveId = null;
  renderSaves();
};

// ---------- langue ----------

for (const l of Object.keys(I18N)) {
  const o = document.createElement('option');
  o.value = l; o.textContent = I18N[l]['lang.name'];
  $('lang').append(o);
}
function applyLang() {
  applyI18n();
  if (S.pages.length) renderThumbs();
  if ($('savesDlg').open) renderSaves();
  if (offered) $('restoreMsg').textContent = tr('bar.found', fmtDate(offered.savedAt));
}
$('lang').value = lang;
$('lang').onchange = (e) => { setLang(e.target.value); applyLang(); };
applyI18n();

// Garde contre F5 / Ctrl+R / fermeture de l'onglet : rien n'est sauvegardé, tout serait perdu.
window.addEventListener('beforeunload', (e) => {
  if (!S.dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

setTool('select');
