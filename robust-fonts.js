// ─── Robust font emulation ──────────────────────────────────────────────────
// SS14 (RobustToolbox) renders text with FreeType at 96 DPI. With hinting on,
// every glyph advance is rounded to a whole pixel and there is no kerning.
// Browsers use fractional advances, which is why long runs of "_" or "‾" used
// to come out too long. We read the real font files the game ships, then do the
// same maths FreeType does, so every character lands on the same pixel column.

const ROBUST_FONT_FILES = {
  regular:    'fonts/NotoSans-Regular.ttf',
  bold:       'fonts/NotoSans-Bold.ttf',
  italic:     'fonts/NotoSans-Italic.ttf',
  bolditalic: 'fonts/NotoSans-BoldItalic.ttf',
  mono:       'fonts/NotoSansMono-Regular.ttf',      // EngineFonts/NotoSans/NotoSansMono-Regular.ttf
  symbols:    'fonts/NotoSansSymbols-Regular.ttf',   // fallback 1 of the default stack
  symbols2:   'fonts/NotoSansSymbols2-Regular.ttf',  // fallback 2 of the default stack
};

// Faces that only [font="..."] can reach. They're fetched the first time a paper asks for them.
const ROBUST_EXTRA_FONT_FILES = {
  display:           'fonts/NotoSansDisplay/NotoSansDisplay-Regular.ttf',
  displayItalic:     'fonts/NotoSansDisplay/NotoSansDisplay-Italic.ttf',
  displayBold:       'fonts/NotoSansDisplay/NotoSansDisplay-Bold.ttf',
  displayBoldItalic: 'fonts/NotoSansDisplay/NotoSansDisplay-BoldItalic.ttf',
  boxRound:          'fonts/Boxfont-round/Boxfont Round.ttf',
  emoji:             'fonts/NotoEmoji/NotoEmoji.ttf',
  cozette:           'fonts/Cozette/CozetteVector.ttf',
  cozetteBold:       'fonts/Cozette/CozetteVectorBold.ttf',
};

// The font prototypes from Resources/Prototypes/fonts.yml and _RMC14/fonts.yml, which is
// every name [font="..."] accepts. Names are case-sensitive. AnimalSilence's licence is
// "All Rights Reserved", so it isn't shipped here and is drawn with Default instead.
const ROBUST_FONT_PROTOTYPES = {
  Default: 'regular',
  DefaultItalic: 'italic',
  DefaultBold: 'bold',
  DefaultBoldItalic: 'bolditalic',
  NotoSansDisplay: 'display',
  NotoSansDisplayItalic: 'displayItalic',
  NotoSansDisplayBold: 'displayBold',
  NotoSansDisplayBoldItalic: 'displayBoldItalic',
  BoxRound: 'boxRound',
  AnimalSilence: null,
  Monospace: 'mono',
  Emoji: 'emoji',
  Cozette: 'cozette',
  CozetteBold: 'cozetteBold',
};

// Minimal TrueType reader: head, hhea, hmtx and cmap (formats 4 and 12).
function parseTrueType(buffer) {
  const dv = new DataView(buffer);
  const tables = {};
  const numTables = dv.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    tables[tag] = dv.getUint32(o + 8);
  }

  const head = tables['head'], hhea = tables['hhea'], hmtx = tables['hmtx'], cmap = tables['cmap'];
  const upm = dv.getUint16(head + 18);
  const flags = dv.getUint16(head + 16);
  const ascender = dv.getInt16(hhea + 4);
  const descender = dv.getInt16(hhea + 6);
  const lineGap = dv.getInt16(hhea + 8);
  const numHMetrics = dv.getUint16(hhea + 34);

  // Pick the best Unicode cmap subtable: full-repertoire format 12 first, BMP format 4 second.
  let sub12 = -1, sub4 = -1;
  const numSub = dv.getUint16(cmap + 2);
  for (let i = 0; i < numSub; i++) {
    const platform = dv.getUint16(cmap + 4 + i * 8);
    const encoding = dv.getUint16(cmap + 6 + i * 8);
    const off = cmap + dv.getUint32(cmap + 8 + i * 8);
    const format = dv.getUint16(off);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12 && sub12 < 0) sub12 = off;
    if (format === 4 && sub4 < 0) sub4 = off;
  }

  function lookup12(cp) {
    const n = dv.getUint32(sub12 + 12);
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, g = sub12 + 16 + mid * 12;
      const start = dv.getUint32(g), end = dv.getUint32(g + 4);
      if (cp < start) hi = mid - 1;
      else if (cp > end) lo = mid + 1;
      else return dv.getUint32(g + 8) + (cp - start);
    }
    return 0;
  }

  function lookup4(cp) {
    if (cp > 0xFFFF) return 0;
    const segX2 = dv.getUint16(sub4 + 6);
    const ends = sub4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    let lo = 0, hi = segX2 / 2 - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const end = dv.getUint16(ends + mid * 2);
      const start = dv.getUint16(starts + mid * 2);
      if (cp > end) lo = mid + 1;
      else if (cp < start) hi = mid - 1;
      else {
        const delta = dv.getInt16(deltas + mid * 2);
        const rangeAddr = ranges + mid * 2;
        const range = dv.getUint16(rangeAddr);
        if (range === 0) return (cp + delta) & 0xFFFF;
        const gid = dv.getUint16(rangeAddr + range + (cp - start) * 2);
        return gid === 0 ? 0 : (gid + delta) & 0xFFFF;
      }
    }
    return 0;
  }

  const glyphCache = new Map();
  function glyphIndex(cp) {
    let g = glyphCache.get(cp);
    if (g === undefined) {
      g = sub12 >= 0 ? lookup12(cp) : sub4 >= 0 ? lookup4(cp) : 0;
      glyphCache.set(cp, g);
    }
    return g;
  }

  function advanceUnits(gid) {
    const i = gid < numHMetrics ? gid : numHMetrics - 1;
    return dv.getUint16(hmtx + i * 4);
  }

  // Outline bounding box from the glyf table, or null for empty glyphs and non-TrueType fonts.
  const loca = tables['loca'], glyf = tables['glyf'];
  const longLoca = dv.getInt16(head + 50) !== 0;
  function glyphBox(gid) {
    if (loca === undefined || glyf === undefined) return null;
    const off = longLoca ? dv.getUint32(loca + gid * 4) : dv.getUint16(loca + gid * 2) * 2;
    const next = longLoca ? dv.getUint32(loca + gid * 4 + 4) : dv.getUint16(loca + gid * 2 + 2) * 2;
    if (next <= off) return null;
    const g = glyf + off;
    return { xMin: dv.getInt16(g + 2), yMin: dv.getInt16(g + 4), xMax: dv.getInt16(g + 6), yMax: dv.getInt16(g + 8) };
  }

  return { upm, flags, ascender, descender, lineGap, glyphIndex, advanceUnits, glyphBox };
}

// One loaded face (a single .ttf), with FreeType-style sizing.
class RobustFace {
  constructor(key, family, ttf) {
    this.key = key;
    this.family = family;  // CSS font-family registered through the FontFace API
    this.ttf = ttf;
    this._sizes = new Map();
  }

  // Robust passes the point size to FT_Set_Char_Size at 96 DPI.
  // Fonts with the "integer ppem" head flag (bit 3) get their ppem rounded by FreeType.
  size(pt) {
    let s = this._sizes.get(pt);
    if (s) return s;
    const t = this.ttf;
    let ppem = pt * 96 / 72;
    const integerPpem = (t.flags & 8) !== 0;
    if (integerPpem) ppem = Math.round(ppem);
    const scale = ppem / t.upm;
    const height = (t.ascender - t.descender + t.lineGap) * scale;
    let ascent, descent;
    if (integerPpem) {             // tt_size_reset: rounded metrics
      ascent = Math.round(t.ascender * scale);
      descent = -Math.round(t.descender * scale);
    } else {                       // ft_recompute_scaled_metrics: grid-fitted
      ascent = Math.ceil(t.ascender * scale);
      descent = -Math.floor(t.descender * scale);
    }
    s = {
      pt, ppem, scale, ascent, descent,
      height: ascent + descent,
      lineHeight: Math.round(height),
      css: `${ppem}px "${this.family}"`,
      advances: new Map(),
      ink: new Map(),
    };
    this._sizes.set(pt, s);
    return s;
  }

  hasGlyph(cp) { return this.ttf.glyphIndex(cp) !== 0; }

  // Where a glyph's ink sits, in whole pixels: top and bottom relative to the baseline
  // (top is negative) and the width and height of the bitmap FreeType renders for it.
  // Hinting snaps outline edges to the pixel grid, so the edges are rounded rather than
  // pushed outwards, which keeps tiny overshoots (the bottom of "e") on the baseline.
  // Null when the glyph has no outline.
  glyphInk(cp, pt) {
    const s = this.size(pt);
    if (s.ink.has(cp)) return s.ink.get(cp);
    const gid = this.ttf.glyphIndex(cp);
    const box = gid === 0 ? null : this.ttf.glyphBox(gid);
    let ink = null;
    if (box) {
      const top = -Math.round(box.yMax * s.scale), bottom = -Math.round(box.yMin * s.scale);
      ink = { top, bottom, w: Math.round(box.xMax * s.scale) - Math.round(box.xMin * s.scale), h: bottom - top };
    }
    s.ink.set(cp, ink);
    return ink;
  }

  // Hinted advance in whole pixels, or null if the face has no glyph.
  advance(cp, pt) {
    const s = this.size(pt);
    let a = s.advances.get(cp);
    if (a !== undefined) return a;
    const gid = this.ttf.glyphIndex(cp);
    a = gid === 0 ? null : Math.round(this.ttf.advanceUnits(gid) * s.scale);
    s.advances.set(cp, a);
    return a;
  }
}

// .NET Rune.IsWhiteSpace
function isRuneWhiteSpace(cp) {
  return (cp >= 0x09 && cp <= 0x0D) || cp === 0x20 || cp === 0x85 || cp === 0xA0 || cp === 0x1680 ||
         (cp >= 0x2000 && cp <= 0x200A) || cp === 0x2028 || cp === 0x2029 || cp === 0x202F ||
         cp === 0x205F || cp === 0x3000;
}

const REPLACEMENT_CHAR = 0xFFFD;

// A font as Robust sees it: either a single VectorFont or a StackedFont (fallback chain).
// Both expose the same API: metrics(), charMetrics(cp), resolveGlyph(cp).
class RobustFont {
  constructor(faces, pt) {
    this.faces = faces;   // [main, ...fallbacks]
    this.pt = pt;
    this.stacked = faces.length > 1;
  }

  get main() { return this.faces[0]; }
  get size() { return this.pt; }

  // Line metrics always come from the main face (StackedFont forwards to _main).
  metrics() { return this.main.size(this.pt); }

  // Font.GetCharMetrics(rune, fallback: true), used by layout. Returns advance or null.
  // StackedFont takes the first face that has the glyph at all; anything missing
  // that isn't whitespace measures as U+FFFD from the main face.
  charAdvance(cp) {
    for (const face of this.faces) {
      const a = face.advance(cp, this.pt);
      if (a !== null) return a;
    }
    if (isRuneWhiteSpace(cp)) return null;
    return this.main.advance(REPLACEMENT_CHAR, this.pt);
  }

  // Font.DrawChar(...), used when drawing. Returns { face, cp, advance } or null.
  // StackedFont skips faces whose advance is 0, then retries the main face with fallback.
  resolveGlyph(cp) {
    if (this.stacked) {
      for (const face of this.faces) {
        const a = face.advance(cp, this.pt);
        if (a !== null && a !== 0) return { face, cp, advance: a };
      }
    }
    const a = this.main.advance(cp, this.pt);
    if (a !== null) return { face: this.main, cp, advance: a };
    if (isRuneWhiteSpace(cp)) return null;
    const r = this.main.advance(REPLACEMENT_CHAR, this.pt);
    return r === null ? null : { face: this.main, cp: REPLACEMENT_CHAR, advance: r };
  }
}

const RobustFonts = {
  faces: {},
  ready: false,
  _pending: new Map(),   // extra face key → Promise
  failed: new Set(),     // extra faces that couldn't be fetched
  onFaceLoaded: null,    // called after an extra face arrives, so the page can redraw

  async _loadFace(key, url) {
    const res = await fetch(encodeURI(url));
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
    const buf = await res.arrayBuffer();
    const family = `Robust-${key}`;
    const ff = new FontFace(family, buf.slice(0));
    await ff.load();
    document.fonts.add(ff);
    this.faces[key] = new RobustFace(key, family, parseTrueType(buf));
  },

  async load() {
    await Promise.all(Object.entries(ROBUST_FONT_FILES).map(([key, url]) => this._loadFace(key, url)));
    this.ready = true;
  },

  // Starts fetching an extra face. Returns true once it's ready to use.
  ensureFace(key) {
    if (this.faces[key]) return true;
    if (this.failed.has(key) || this._pending.has(key) || !ROBUST_EXTRA_FONT_FILES[key]) return false;
    const p = this._loadFace(key, ROBUST_EXTRA_FONT_FILES[key])
      .catch(err => { console.error(err); this.failed.add(key); })
      .finally(() => {
        this._pending.delete(key);
        if (this.onFaceLoaded) this.onFaceLoaded(key);
      });
    this._pending.set(key, p);
    return false;
  },

  // FontTag.DefaultSize
  DEFAULT_SIZE: 12,

  // The paper's default font: NotoStack("Regular", 12) = Regular + Symbols + Symbols2.
  defaultFont(pt = 12) {
    const f = this.faces;
    return new RobustFont([f.regular, f.symbols, f.symbols2], pt);
  },

  // Single-face fonts created by markup tags (FontTag.CreateFont → new VectorFont).
  tagFont(key, pt) { return new RobustFont([this.faces[key]], pt); },

  isPrototype(id) { return Object.prototype.hasOwnProperty.call(ROBUST_FONT_PROTOTYPES, id); },

  // FontTag.CreateFont: a font prototype by id, or Default when no prototype has that id.
  // status says whether the simulator could use the real face:
  //   'ok', 'unknown' (no such prototype, Default like in game), 'unavailable' (not shipped here),
  //   'loading' (fetching it, Default for now) or 'failed' (couldn't fetch it).
  prototypeFont(id, pt) {
    let status = 'ok';
    let key = this.isPrototype(id) ? ROBUST_FONT_PROTOTYPES[id] : (status = 'unknown', 'regular');
    if (key === null) { status = 'unavailable'; key = 'regular'; }
    if (!this.faces[key]) {
      if (this.failed.has(key)) status = 'failed';
      else { this.ensureFace(key); status = 'loading'; }
      key = 'regular';
    }
    return { font: this.tagFont(key, pt), status };
  },
};
