// ─── Paper renderer ─────────────────────────────────────────────────────────
// Port of RobustToolbox RichTextEntry (Update + Draw) and WordWrap, plus the
// paper window geometry from Content.Client/Paper/UI/PaperWindow.xaml.
// Layout runs exactly like the game: whole-pixel advances, word wrap rules,
// per-line heights taken from the font active at each line break, and
// Fill / Sign / check buttons placed inline like the game's controls.

const PAPER = {
  windowWidth: 520,          // PaperWindow SetSize="520 660"
  border: 20,                // PaperContent StyleBoxFlat BorderThickness="20"
  // Height of the scrollable paper area inside the 660px window, once the
  // close-button row above it is taken out. Approximate: used only to decide
  // when the game would show a scrollbar.
  viewportHeight: 606,
  scrollbarWidth: 10,        // StyleBase.DefaultGrabberSize
  background: '#ffffff',     // PaperComponent.Color = White
  textColor: { r: 25, g: 25, b: 25, a: 255 },   // PaperComponent.TextColor
  colorTagDefault: { r: 200, g: 200, b: 200, a: 255 }, // ColorTag.DefaultColor
  extraMarginPerTag: 3,      // PaperWindow.Populate: 3px per [form]/[signature]/[check]
  button: { bg: '#464966', hover: '#575b7f', pressed: '#3e6c45', text: '#ffffff' },
  blankMessage: 'This page intentionally left blank',
};

const PaperRenderer = (() => {
  const FONT_TAGS = { bold: 'bold', italic: 'italic', bolditalic: 'bolditalic', mono: 'mono' };
  const CONTROL_TAGS = new Set(['form', 'signature', 'check']);
  // Tags whitelisted by PaperWindow._allowedTags. Names are case-sensitive.
  const ALLOWED = new Set(['bolditalic', 'bold', 'bullet', 'color', 'head', 'italic', 'mono', 'form', 'signature', 'check']);

  // ── WordWrap.cs ──
  class WordWrap {
    constructor(maxSizeX) {
      this.maxSizeX = maxSizeX;
      this.maxUsedWidth = 0;
      this.breakIndexCounter = 0;
      this.nextBreakIndexCounter = 0;
      this.wordStartBreakIndex = null; // {index, lineSize}
      this.wordSizePixels = 0;
      this.posX = 0;
      this.lastRune = 0x41; // 'A'
      this.forceSplitData = null;   // {breakIndex, wordSizePixels}
    }
    static isWordBoundary(a, b) {
      return a === 0x20 || b === 0x20 || a === 0x2D || b === 0x2D;
    }
    nextRune(rune) {
      const out = { breakLine: null, breakNewLine: null, skip: false };
      this.breakIndexCounter = this.nextBreakIndexCounter;
      this.nextBreakIndexCounter += rune > 0xFFFF ? 2 : 1;
      if (WordWrap.isWordBoundary(this.lastRune, rune) || rune === 0x0A) {
        if (this.posX > this.maxSizeX && this.lastRune !== 0x20) {
          if (!this.wordStartBreakIndex) return out;
          out.breakLine = this.wordStartBreakIndex.index;
          this.maxUsedWidth = Math.max(this.maxUsedWidth, this.wordStartBreakIndex.lineSize);
          this.posX = this.wordSizePixels;
        }
        this.wordSizePixels = 0;
        this.wordStartBreakIndex = { index: this.breakIndexCounter, lineSize: this.posX };
        this.forceSplitData = null;
        if (rune === 0x0A) {
          this.maxUsedWidth = Math.max(this.maxUsedWidth, this.posX);
          this.posX = 0;
          this.wordStartBreakIndex = null;
          out.skip = true;
          out.breakNewLine = this.breakIndexCounter;
        }
      }
      this.lastRune = rune;
      return out;
    }
    nextMetrics(advance) {
      const out = { breakLine: null, abort: false };
      const oldWordSizePixels = this.wordSizePixels;
      this.wordSizePixels += advance;
      this.posX += advance;
      if (this.posX <= this.maxSizeX) return out;
      if (!this.forceSplitData) this.forceSplitData = { breakIndex: this.breakIndexCounter, wordSizePixels: oldWordSizePixels };
      if (this.wordSizePixels > this.maxSizeX) {
        const { breakIndex, wordSizePixels: splitWordSize } = this.forceSplitData;
        if (splitWordSize === 0) { out.abort = true; return out; }
        this.forceSplitData = null;
        out.breakLine = breakIndex;
        this.wordSizePixels -= splitWordSize;
        this.wordStartBreakIndex = null;
        this.maxUsedWidth = Math.max(this.maxUsedWidth, this.maxSizeX);
        this.posX = this.wordSizePixels;
      }
      return out;
    }
    finalizeText() {
      let breakLine = null;
      if (this.posX > this.maxSizeX && this.wordStartBreakIndex) {
        breakLine = this.wordStartBreakIndex.index;
        this.maxUsedWidth = Math.max(this.maxUsedWidth, this.wordStartBreakIndex.lineSize);
      } else {
        this.maxUsedWidth = Math.max(this.maxUsedWidth, this.posX);
      }
      return { width: Math.floor(this.maxUsedWidth), breakLine };
    }
  }

  // ── Drawing context + tag handlers ──
  function makeContext(defaultFont) {
    return { font: [{ font: defaultFont, tag: null }], color: [{ color: PAPER.textColor, tag: null }] };
  }
  const peek = st => st.length ? st[st.length - 1] : null;

  // FontTag.CreateFont: inherit size from the font on top of the stack, allow size= attribute.
  function createFont(ctx, node, key) {
    let size = RobustFonts.DEFAULT_SIZE;
    const top = peek(ctx.font);
    if (top) size = top.font.size;
    const sp = node.attrs && node.attrs.size;
    if (sp && sp.type === 'long') size = sp.value;
    return RobustFonts.tagFont(key, Math.max(1, size));
  }

  // Returns the text this node contributes (TextBefore/TextAfter or literal text).
  function processNode(node, ctx, diag) {
    if (node.name === null) return node.text;
    if (!ALLOWED.has(node.name)) {
      if (diag && !node.closing) diag.unknownTag(node);
      return '';
    }
    const name = node.name;
    if (!node.closing) {
      if (FONT_TAGS[name]) {
        if (diag) diag.checkNesting(node, ctx);
        ctx.font.push({ font: createFont(ctx, node, FONT_TAGS[name]), tag: name });
      } else if (name === 'head') {
        const v = node.value;
        if (v && v.type === 'long') {
          const level = Math.min(Math.max(v.value, 1), 3);
          const size = Math.ceil(RobustFonts.DEFAULT_SIZE * 2 / Math.sqrt(level));
          const f = RobustFonts.tagFont('bold', size);
          ctx.font.push({ font: f, tag: 'head' });
        } else if (diag) {
          diag.add(node, 'warn', '[head] needs a number (1, 2 or 3). Without one it does nothing, but its closing tag still removes a style.');
        }
      } else if (name === 'color') {
        const v = node.value;
        const color = v && v.type === 'color' ? v.value : PAPER.colorTagDefault;
        if (diag && v && v.type === 'color' && !ROBUST_NAMED_COLORS[v.raw.toLowerCase()] && !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.raw)) {
          diag.add(node, 'warn', `"${v.raw}" isn't a colour the game knows, so it renders black.`);
        }
        ctx.color.push({ color, tag: 'color' });
      }
      return name === 'bullet' ? ' · ' : '';
    }
    // Closing tag: the handler pops whatever is on top of its stack.
    if (FONT_TAGS[name] || name === 'head') {
      if (diag) diag.checkPop(node, ctx.font, 'font');
      ctx.font.pop();
    } else if (name === 'color') {
      if (diag) diag.checkPop(node, ctx.color, 'colour');
      ctx.color.pop();
    }
    return '';
  }

  function controlSpec(kind, lh) {
    switch (kind) {
      case 'form':      return { w: 32, h: lh + 2, m: [1, 0, 1, 0], label: 'Fill' };
      case 'signature': return { w: 48, h: lh + 4, m: [1, 2, 1, 2], label: 'Sign' };
      case 'check':     return { w: lh + 2, h: lh + 2, m: [1, 0, 1, 0], label: '☐' };
    }
  }

  // Diagnostics help authors spot spots where the game does something surprising.
  function makeDiagnostics(source) {
    const lineStarts = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
    const lineOf = pos => {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
    const items = [];
    const seen = new Set();
    const d = {
      items,
      add(node, level, msg) {
        const line = node ? lineOf(node.start) : null;
        const key = line + msg;
        if (seen.has(key) || items.length > 40) return;
        seen.add(key);
        items.push({ line, level, msg });
      },
      unknownTag(node) {
        d.add(node, 'info', `[${node.name}] isn't a paper tag, so the game hides it.`);
      },
      checkNesting(node, ctx) {
        const tags = ctx.font.map(f => f.tag);
        if ((node.name === 'bold' && tags.includes('italic')) || (node.name === 'italic' && tags.includes('bold'))) {
          d.add(node, 'warn', `[${node.name}] inside [${node.name === 'bold' ? 'italic' : 'bold'}] shows only ${node.name} in game. Use [bolditalic] for both.`);
        }
      },
      checkPop(node, stack, what) {
        const top = peek(stack);
        if (!top) {
          d.add(node, 'error', `[/${node.name}] has nothing left to close. The game throws an error here and the paper may not display.`);
        } else if (top.tag === null) {
          d.add(node, 'warn', `[/${node.name}] has no matching opening tag.`);
        } else if (top.tag !== node.name) {
          d.add(node, 'warn', `[/${node.name}] closes the [${top.tag}] ${what} first, because the game closes tags in stack order.`);
        }
      },
    };
    d.lineOf = lineOf;
    return d;
  }

  // ── RichTextEntry.Update ──
  function update(nodes, maxSizeX, defaultFont, diag) {
    const dm = defaultFont.metrics();
    let height = dm.height;
    const lineBreaks = [];
    const ww = new WordWrap(maxSizeX);
    const ctx = makeContext(defaultFont);
    const lh = dm.lineHeight;

    const currentFont = () => { const t = peek(ctx.font); return t ? t.font : defaultFont; };
    const checkLineBreak = line => {
      if (line === null || line === undefined) return;
      lineBreaks.push(line);
      height += currentFont().metrics().lineHeight;
    };

    outer:
    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      const text = processNode(node, ctx, diag);
      const font = currentFont();
      for (const ch of text) {
        const rune = ch.codePointAt(0);
        const r = ww.nextRune(rune);
        checkLineBreak(r.breakLine);
        checkLineBreak(r.breakNewLine);
        if (r.skip) continue;
        const adv = font.charAdvance(rune);
        if (adv === null) continue;
        const m = ww.nextMetrics(adv);
        checkLineBreak(m.breakLine);
        if (m.abort) break outer;
      }
      if (node.name !== null && CONTROL_TAGS.has(node.name)) {
        const spec = controlSpec(node.name, lh);
        const m = ww.nextMetrics(spec.w + spec.m[0] + spec.m[2]);
        checkLineBreak(m.breakLine);
        if (m.abort) break outer;
      }
    }
    const fin = ww.finalizeText();
    checkLineBreak(fin.breakLine);
    return { lineBreaks, height, width: fin.width };
  }

  // ── RichTextEntry.Draw ──
  function draw(nodes, lineBreaks, defaultFont) {
    const dm = defaultFont.metrics();
    const lh = dm.lineHeight;
    const ctx = makeContext(defaultFont);
    const glyphs = [];
    const controls = [];
    const counters = { form: 0, signature: 0, check: 0 };
    let globalBreakCounter = 0, lineBreakIndex = 0;
    let x = 0, baseY = dm.ascent;
    let controlYAdvance = 0;
    let bottom = dm.height;

    for (const node of nodes) {
      const text = processNode(node, ctx, null);
      let color, font;
      const ct = peek(ctx.color), ft = peek(ctx.font);
      if (!ct || !ft) { color = PAPER.textColor; font = defaultFont; }
      else { color = ct.color; font = ft.font; }

      for (const ch of text) {
        const rune = ch.codePointAt(0);
        if (lineBreakIndex < lineBreaks.length && lineBreaks[lineBreakIndex] === globalBreakCounter) {
          x = 0;
          baseY += font.metrics().lineHeight + controlYAdvance;
          controlYAdvance = 0;
          lineBreakIndex++;
        }
        const g = font.resolveGlyph(rune);
        if (g) {
          if (!isRuneWhiteSpace(g.cp)) glyphs.push({ x, y: baseY, face: g.face, pt: font.size, cp: g.cp, color });
          x += g.advance;
          bottom = Math.max(bottom, baseY + font.metrics().descent);
        }
        globalBreakCounter++;
      }

      if (node.name !== null && CONTROL_TAGS.has(node.name)) {
        const spec = controlSpec(node.name, lh);
        const top = baseY - dm.ascent;
        controls.push({
          kind: node.name, index: counters[node.name]++, label: spec.label,
          x: x + spec.m[0], y: top + spec.m[1], w: spec.w, h: spec.h,
        });
        const desiredW = spec.w + spec.m[0] + spec.m[2];
        const desiredH = spec.h + spec.m[1] + spec.m[3];
        controlYAdvance = Math.max(0, desiredH - font.metrics().lineHeight);
        bottom = Math.max(bottom, top + desiredH);
        x += desiredW;
      }
    }
    return { glyphs, controls, bottom };
  }

  function countOccurrences(text, sub) {
    let n = 0, p = 0;
    while ((p = text.indexOf(sub, p)) !== -1) { n++; p += sub.length; }
    return n;
  }

  // Full paper layout. Returns everything needed to paint and to wire up buttons.
  function layout(source) {
    const defaultFont = RobustFonts.defaultFont();
    const parsed = RobustMarkup.parse(source);
    const diag = makeDiagnostics(source);

    if (parsed.truncatedAt !== null) {
      diag.items.push({ line: diag.lineOf(parsed.truncatedAt), level: 'error',
        msg: 'A lone backslash stops the game reading the paper. Everything after it is dropped. Write \\\\ for a literal backslash.' });
    }
    if (parsed.mode === 'permissive' && parsed.invalidTags.length) {
      const first = parsed.invalidTags[0];
      const snippet = source.slice(first, Math.min(source.length, first + 16)).split('\n')[0];
      diag.items.push({ line: diag.lineOf(first), level: 'info',
        msg: `"${snippet}" isn't a valid tag, so the game shows it as plain text${parsed.invalidTags.length > 1 ? ` (${parsed.invalidTags.length} spots)` : ''}.` });
    }

    const extraBottom = PAPER.extraMarginPerTag *
      (countOccurrences(source, '[form]') + countOccurrences(source, '[signature]') + countOccurrences(source, '[check]'));
    const fullWidth = PAPER.windowWidth - PAPER.border * 2;

    // First pass at full width. If the paper is taller than the window,
    // the game shows a scrollbar, which narrows the text area.
    let wrapWidth = fullWidth;
    let lay = update(parsed.nodes, wrapWidth, defaultFont, diag);
    let scrolls = lay.height + PAPER.border * 2 + extraBottom > PAPER.viewportHeight;
    if (scrolls) {
      wrapWidth = fullWidth - PAPER.scrollbarWidth;
      lay = update(parsed.nodes, wrapWidth, defaultFont, null);
    }

    const drawn = draw(parsed.nodes, lay.lineBreaks, defaultFont);
    const contentHeight = Math.max(lay.height, drawn.bottom);
    const paperHeight = Math.max(PAPER.viewportHeight, Math.ceil(contentHeight + PAPER.border * 2 + extraBottom));

    let blank = null;
    if (source.length === 0) {
      let w = 0;
      for (const ch of PAPER.blankMessage) w += defaultFont.charAdvance(ch.codePointAt(0)) || 0;
      blank = { x: Math.floor((fullWidth - w) / 2), text: PAPER.blankMessage };
    }

    return {
      source, parsed, defaultFont, wrapWidth, scrolls,
      glyphs: drawn.glyphs, controls: drawn.controls,
      width: PAPER.windowWidth, height: paperHeight,
      diagnostics: diag.items.sort((a, b) => (a.line || 0) - (b.line || 0)),
      blank,
    };
  }

  const rgba = c => c.a === 255 ? `rgb(${c.r},${c.g},${c.b})` : `rgba(${c.r},${c.g},${c.b},${(c.a / 255).toFixed(3)})`;

  // Paints a layout onto a canvas at the given pixel scale.
  function paint(canvas, model, scale, { drawControls = false } = {}) {
    canvas.width = Math.round(model.width * scale);
    canvas.height = Math.round(model.height * scale);
    const g = canvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = PAPER.background;
    g.fillRect(0, 0, model.width, model.height);
    g.textBaseline = 'alphabetic';
    if ('fontKerning' in g) g.fontKerning = 'none';

    const ox = PAPER.border, oy = PAPER.border;
    let lastFont = '', lastColor = '';
    const setFont = css => { if (css !== lastFont) { g.font = css; lastFont = css; } };
    const setColor = c => { const s = rgba(c); if (s !== lastColor) { g.fillStyle = s; lastColor = s; } };

    for (const gl of model.glyphs) {
      setFont(gl.face.size(gl.pt).css);
      setColor(gl.color);
      g.fillText(String.fromCodePoint(gl.cp), ox + gl.x, oy + gl.y);
    }

    if (model.blank) {
      const f = model.defaultFont;
      let x = ox + model.blank.x;
      setColor(PAPER.textColor);
      for (const ch of model.blank.text) {
        const r = f.resolveGlyph(ch.codePointAt(0));
        if (!r) continue;
        setFont(r.face.size(f.size).css);
        g.fillText(String.fromCodePoint(r.cp), x, oy + f.metrics().ascent);
        x += r.advance;
      }
    }

    if (drawControls) {
      for (const c of model.controls) paintButton(g, ox + c.x, oy + c.y, c.w, c.h, c.label, model.defaultFont);
    }
  }

  function paintButton(g, x, y, w, h, label, font) {
    g.fillStyle = PAPER.button.bg;
    g.fillRect(x, y, w, h);
    let width = 0;
    const runs = [];
    for (const ch of label) {
      const r = font.resolveGlyph(ch.codePointAt(0));
      if (r) { runs.push(r); width += r.advance; }
    }
    const m = font.metrics();
    let cx = x + Math.round((w - width) / 2);
    const by = y + Math.round((h - m.height) / 2) + m.ascent;
    g.fillStyle = PAPER.button.text;
    for (const r of runs) {
      g.font = r.face.size(font.size).css;
      g.fillText(String.fromCodePoint(r.cp), cx, by);
      cx += r.advance;
    }
  }

  // Width in pixels of a single line of markup, ignoring wrapping. Used for centring.
  function measureLine(markup) {
    const defaultFont = RobustFonts.defaultFont();
    const parsed = RobustMarkup.parse(markup);
    const ctx = makeContext(defaultFont);
    const lh = defaultFont.metrics().lineHeight;
    let w = 0;
    for (const node of parsed.nodes) {
      const text = processNode(node, ctx, null);
      const t = peek(ctx.font);
      const font = t ? t.font : defaultFont;
      for (const ch of text) w += font.charAdvance(ch.codePointAt(0)) || 0;
      if (node.name !== null && CONTROL_TAGS.has(node.name)) {
        const s = controlSpec(node.name, lh);
        w += s.w + s.m[0] + s.m[2];
      }
    }
    return w;
  }

  // ── Tag replacement, same as PaperWindow / PaperSystem ──
  // The nth button of a kind replaces the nth literal "[form]" / "[signature]" / "[check]".
  function findNthTag(text, tag, index) {
    let pos = 0, i = 0;
    while (pos < text.length) {
      const found = text.indexOf(tag, pos);
      if (found === -1) return -1;
      if (i === index) return found;
      i++; pos = found + tag.length;
    }
    return -1;
  }

  // PaperSystem.CleanUnfilledTags, applied when a paper is stamped.
  function cleanUnfilledTags(text) {
    return text.split('[form]').join('').split('[signature]').join('').split('[check]').join('☐');
  }

  return { layout, paint, measureLine, findNthTag, cleanUnfilledTags };
})();
