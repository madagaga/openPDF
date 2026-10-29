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
};
const jsPages = new Map();  // cache des pages pdf.js, clé "doc:idx"
let els = [];               // par page affichée : { el, ov, vp }

// ---------- chargement ----------

async function addDoc(bytes) {
  const js = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  S.docs.push({ bytes, js });
  return S.docs.length - 1;
}

async function openFile(file, merge) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!merge) {
    S.docs = []; S.pages = []; S.undo = []; S.redo = []; S.sel = null;
    jsPages.clear();
    S.name = file.name;
  } else pushUndo();
  const d = await addDoc(bytes);
  for (let i = 0; i < S.docs[d].js.numPages; i++) S.pages.push({ doc: d, idx: i, rot: 0, annots: [] });
  await refresh(true);
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
    acts.innerHTML = '<button data-act="l" title="Pivoter à gauche">↺</button><button data-act="r" title="Pivoter à droite">↻</button><button data-act="x" title="Supprimer">🗑</button>';
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i + 1;
    t.append(c, acts, num);
    thumbsEl.append(t);

    acts.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      e.stopPropagation();
      pushUndo();
      if (act === 'x') { S.pages.splice(i, 1); S.sel = null; }
      else p.rot = (p.rot + (act === 'r' ? 90 : 270)) % 360;
      refresh();
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
  if (S.pages[i].annots[ai].type !== 'text') return;
  pushUndo();
  S.editing = { pi: i, ai };
  S.sel = { pi: i, ai };
  drawOverlay(i);
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
  updateCursor();
}

function updateCursor() {
  els.forEach(({ ov }) => {
    ov.classList.toggle('draw', ['text', 'rect', 'highlight', 'whiteout', 'ink'].includes(S.tool));
    ov.classList.toggle('place', S.tool === 'place');
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
    const map = { v: 'select', t: 'text', h: 'highlight', r: 'rect', w: 'whiteout', d: 'ink' };
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
  const di = await addDoc(await d.save());
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
  btn.disabled = true; btn.textContent = 'Export…';
  try {
    const bytes = await exportPdf();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = S.name.replace(/\.pdf$/i, '') + '-modifie.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    console.error(err);
    alert('Échec de l’export : ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Télécharger';
  }
};

setTool('select');
