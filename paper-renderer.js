// ─── Paper and business card renderer ───────────────────────────────────────
// Port of RobustToolbox RichTextEntry (Update + Draw) and WordWrap, plus the window
// geometry of Content.Client/Paper/UI/PaperWindow.xaml and
// Content.Client/_RMC14/Paper/BusinessCardWindow.xaml.
// Layout runs exactly like the game: whole-pixel advances, word wrap rules, per-line
// heights taken from the font active at each line break, and inline controls (the
// Fill / Sign / check / Date / Time buttons, links and icons) placed where
// RichTextEntry.Draw puts them.

const PAPER = {
  windowWidth: 520,          // PaperWindow SetSize="520 660"
  windowHeight: 660,
  // Close-button row above the paper: Margin 6 + AngleRect padding 10 +
  // 22px cross texture + 10 + 6. The scroll area gets the rest of the window.
  closeRowHeight: 54,
  paperMaxWidth: 600,        // PaperContent MaxWidth="600" (centred when the window is wider)
  border: 20,                // PaperComponent.Thickness, applied as the StyleBoxFlat border
  scrollbarWidth: 10,        // StyleBase.DefaultGrabberSize (the grabber's minimum size)
  scrollbar: {               // StyleBase vScrollBarGrabber*: Gray / 140 / 160 at 35% alpha
    normal: 'rgba(128,128,128,0.35)', hover: 'rgba(140,140,140,0.35)', grabbed: 'rgba(160,160,160,0.35)',
  },
  background: '#ffffff',     // PaperComponent.Color = White
  textColor: { r: 25, g: 25, b: 25, a: 255 },   // PaperWindow.DefaultTextColor, BusinessCardWindow.TextColor
  colorTagDefault: { r: 200, g: 200, b: 200, a: 255 }, // ColorTag.DefaultColor
  button: { bg: '#464966', hover: '#575b7f', pressed: '#3e6c45', text: '#ffffff' },
  blankMessage: 'This page intentionally left blank',
};

// BusinessCardWindow.xaml: a fixed 650×430 window with no scroll container. The close
// button's AngleRect has no margin, so its row is 10 + 22 + 10 = 42px, and the plain white
// card fills the 388px below it with the text 4px in from each edge. Text that doesn't
// fit is cut off at the card's edges.
const CARD = {
  windowWidth: 650,          // SetSize="650 430"
  windowHeight: 430,
  closeRowHeight: 42,
  margin: 4,                 // ContentLabel Margin="4"
  maxLength: 5000,           // RMCBusinessCard: Paper contentSize 5000
};

const PaperRenderer = (() => {
  // Biggest size the simulator draws. The game would try anything, but its glyph sheets
  // break long before this (see bigGlyph below).
  const MAX_SIZE = 1000;

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

  // ── Drawing context ──
  function makeContext(defaultFont) {
    return { font: [{ font: defaultFont, tag: null }], color: [{ color: PAPER.textColor, tag: null }] };
  }
  const peek = st => st.length ? st[st.length - 1] : null;

  // FontTag.CreateFont: the size comes from the font on top of the stack (12 if there's
  // none) or the tag's size= attribute, and unknown font ids fall back to Default.
  function createFont(ctx, node, fontId, env, forcedSize) {
    let size = RobustFonts.DEFAULT_SIZE;
    const top = peek(ctx.font);
    if (top) size = top.font.size;
    const sp = forcedSize === undefined && node.attrs ? node.attrs.size : null;
    if (forcedSize !== undefined) size = forcedSize;
    else if (sp && sp.type === 'long') size = sp.value;
    if (env.diag) env.diag.fontSize(node, sp, size);
    // FreeType turns anything under 1pt into 1pt.
    const { font, status } = RobustFonts.prototypeFont(fontId, Math.min(Math.max(1, size), MAX_SIZE));
    if (status === 'loading') env.state.fontsLoading = true;
    if (env.diag && status !== 'ok') env.diag.fontStatus(node, fontId, status);
    return font;
  }

  // ── Markup tags ──
  // Each handler mirrors one IMarkupTagHandler: push/pop change the drawing context,
  // textBefore/textAfter add text, and control makes an inline control.
  const popFont = (node, ctx, env) => {
    if (env.diag) env.diag.checkPop(node, ctx.font, 'font');
    ctx.font.pop();
  };

  // BoldTag, ItalicTag, BoldItalicTag and MonoTag switch to a font prototype. The game
  // never fills MarkupDrawingContext.Tags, so [bold] inside [italic] is just bold.
  function fontTag(prototype) {
    return {
      push(node, ctx, env) {
        if (env.diag) env.diag.checkNesting(node, ctx);
        ctx.font.push({ font: createFont(ctx, node, prototype, env), tag: node.name });
      },
      pop: popFont,
    };
  }

  // PaperTagButton (#10571): exactly one line of text tall, with a 1px margin left and right.
  // Its height is PaperTagButton.LineHeight, which the paper window sets to the default
  // font's whole-pixel line height. A business card never sets it, so there it keeps the
  // value from the last paper window drawn (the same 22px, or 16px if no paper has been
  // opened since the game started).
  function buttonTag(kind, width, label) {
    return {
      control(node, env) {
        const lh = env.tagLineHeight;
        if (env.diag && !env.profile.liveButtons) env.diag.deadButton(node, label);
        return { type: 'button', kind, label, w: width === null ? lh : width, h: lh, margin: [1, 0, 1, 0] };
      },
    };
  }

  // CommandLinkTag and TextLinkTag: a Label holding the link text. A Label uses its own
  // style font (the default 12pt stack), not the markup font around it, and a fixed colour.
  function linkTag(kind, attr, color) {
    return {
      control(node, env) {
        if (node.closing) return null;
        const v = node.value, target = node.attrs && node.attrs[attr];
        if (!v || v.type !== 'string' || !target || target.type !== 'string') {
          if (env.diag) env.diag.add(node, 'info', `[${kind}] needs ="text" and ${attr}="..." or it shows nothing.`);
          return null;
        }
        const f = env.defaultFont, m = f.metrics();
        const lines = v.value.split('\n');
        const w = Math.max(...lines.map(line => runWidth(line, f)));
        if (env.diag) env.diag.link(node, kind, target.value);
        return { type: 'link', kind, text: v.value, target: target.value, color,
          w, h: m.height + m.lineHeight * (lines.length - 1), margin: [0, 0, 0, 0] };
      },
    };
  }

  // LanguageIconTag: a 20×21 control holding the language's 16px icon, 5px down.
  const LANGUAGES = new Set(['English', 'Xeno', 'French', 'Spanish', 'Japanese', 'Chinese', 'Russian',
    'German', 'Scandinavian', 'Hindi', 'SignLanguage', 'Primitive']);
  const langIconTag = {
    control(node, env) {
      if (node.closing) return null;
      const a = node.attrs && node.attrs.language;
      if (!a || a.type !== 'string' || !LANGUAGES.has(a.value)) {
        if (env.diag) env.diag.add(node, 'info', `[langicon] needs language="..." naming one of the game's languages (${[...LANGUAGES].join(', ')}), or it shows nothing.`);
        return null;
      }
      if (env.diag) env.diag.once('langicon', node, 'info', "[langicon] shows a language's icon in game. The simulator doesn't have the icons, so it draws a grey square the same size.");
      return { type: 'icon', kind: 'langicon', language: a.value, w: 20, h: 21, margin: [0, 0, 0, 0] };
    },
  };

  // OperationTagHandler, PlanetTagHandler, ShipTagHandler: names from the round info, or a
  // placeholder when there's none.
  const roundTag = (key, fallback) => ({ textBefore: (node, env) => env.round[key] || fallback });

  // ScrambleTag: `length` random characters from `chars` (at most 32), re-rolled every `rate`
  // milliseconds. The random seed comes from the time and the node's hash code, and that hash
  // ignores attributes, so every [scramble] in a text shows the same characters.
  function scrambleText(node, env) {
    const { rate, length, chars } = node.attrs || {};
    if (!rate || rate.type !== 'long' || !length || length.type !== 'long' || !chars || chars.type !== 'string') {
      if (env.diag) env.diag.add(node, 'info', '[scramble] needs rate=, length= and chars="..." or it shows nothing.');
      return '';
    }
    const n = Math.min(length.value, 32);
    if (n <= 0) return '';
    if (!chars.value.length) {
      if (env.diag) env.diag.add(node, 'error', '[scramble] with chars="" makes the game throw an error. Give it some characters.');
      return '';
    }
    let tick = 0;
    if (rate.value !== 0) {
      tick = Math.trunc(env.time / rate.value);
      env.state.animate = Math.min(env.state.animate, Math.max(Math.abs(rate.value), 40));
    }
    let seed = (tick + hashString(`${node.name}|${node.value ? JSON.stringify(node.value) : ''}`)) >>> 0;
    let out = '';
    for (let i = 0; i < n; i++) {
      seed = (seed + 0x6D2B79F5) >>> 0;  // mulberry32
      let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      out += chars.value[Math.floor(r * chars.value.length)];  // char by char, like ToCharArray()
    }
    return out;
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // KeyBindTag: the reader's own key for that action, or the action's name if they have none.
  const keybindTag = {
    textBefore(node, env) {
      const v = node.value;
      if (!v || v.type !== 'string') return '';
      if (env.diag) env.diag.once('keybind', node, 'info', `[keybind] shows the reader's own key for "${v.value}", so it reads differently from person to person. The simulator shows the name.`);
      return v.value;
    },
  };

  // ProtodataTag: a value from the game's prototypes, which the simulator doesn't have.
  const protodataTag = {
    textBefore(node, env) {
      const v = node.value, a = node.attrs || {};
      if (!v || v.type !== 'string' || !a.comp || !a.member) return '';
      if (env.diag) env.diag.once('protodata', node, 'info', "[protodata] shows a value from the game's data. The simulator doesn't have it, so it shows ??? like the game does when the lookup fails.");
      return '???';
    },
  };

  // Every markup tag the game registers: the engine's own tags plus every IMarkupTagHandler
  // in Content.Client (MarkupTagManager). Tag names must be written exactly as here.
  const TAG_HANDLERS = new Map(Object.entries({
    bold: fontTag('DefaultBold'),
    italic: fontTag('DefaultItalic'),
    bolditalic: fontTag('DefaultBoldItalic'),
    mono: fontTag('Monospace'),
    font: {
      push(node, ctx, env) {
        const v = node.value;
        if (env.diag && v && v.type === 'color') env.diag.add(node, 'warn', `Font names need quotes, like [font="${v.raw}"]. Without them the game uses Default.`);
        if (env.diag && v && v.type === 'long') env.diag.add(node, 'warn', `[font=${v.value}] doesn't set a size. Use [font size=${v.value}].`);
        const id = v && v.type === 'string' ? v.value : 'Default';
        ctx.font.push({ font: createFont(ctx, node, id, env), tag: 'font' });
      },
      pop: popFont,
    },
    head: {
      push(node, ctx, env) {
        const v = node.value;
        if (v && v.type === 'long') {
          const level = Math.min(Math.max(v.value, 1), 3);
          const size = Math.ceil(RobustFonts.DEFAULT_SIZE * 2 / Math.sqrt(level));
          ctx.font.push({ font: createFont(ctx, node, 'DefaultBold', env, size), tag: 'head' });
        } else if (env.diag) {
          env.diag.add(node, 'warn', '[head] needs a number (1, 2 or 3). Without one it does nothing, but its closing tag still removes a style.');
        }
      },
      pop: popFont,
    },
    color: {
      push(node, ctx, env) {
        const v = node.value;
        const color = v && v.type === 'color' ? v.value : PAPER.colorTagDefault;
        if (env.diag && v && v.type === 'color' && !ROBUST_NAMED_COLORS[v.raw.toLowerCase()] && !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.raw)) {
          env.diag.add(node, 'warn', `"${v.raw}" isn't a colour the game knows, so it renders black.`);
        }
        ctx.color.push({ color, tag: 'color' });
      },
      pop(node, ctx, env) {
        if (env.diag) env.diag.checkPop(node, ctx.color, 'colour');
        ctx.color.pop();
      },
    },
    bullet: { textBefore: () => ' · ' },
    cmdlink: linkTag('cmdlink', 'command', RobustMarkup.createColor('LightBlue')),
    textlink: linkTag('textlink', 'link', RobustMarkup.createColor('CornflowerBlue')),
    form: buttonTag('form', 32, 'Fill'),
    signature: buttonTag('signature', 48, 'Sign'),
    check: buttonTag('check', null, '☐'),
    date: buttonTag('date', 48, 'Date'),
    time: buttonTag('time', 48, 'Time'),
    operation: roundTag('operation', 'Unknown Operation'),
    planet: roundTag('planet', 'Unknown Planet'),
    ship: roundTag('ship', 'Unknown Ship'),
    scramble: { textBefore: scrambleText },
    keybind: keybindTag,
    protodata: protodataTag,
    langicon: langIconTag,
  }));

  const PROFILES = {
    // PaperWindow._allowedTags.
    paper: {
      name: 'paper', liveButtons: true,
      allowed: new Set(['bolditalic', 'bold', 'bullet', 'color', 'head', 'italic', 'mono', 'form', 'signature',
        'check', 'date', 'time', 'operation', 'planet', 'ship']),
    },
    // BusinessCardWindow passes no list to SetMessage, so every registered tag works. The
    // Fill / Sign / check / Date / Time buttons still appear, but their click handlers look
    // for a PaperWindow parent, so on a card they do nothing.
    card: { name: 'card', liveButtons: false, allowed: null },
  };

  function handlerFor(name, profile) {
    const h = TAG_HANDLERS.get(name);
    return h && (!profile.allowed || profile.allowed.has(name)) ? h : null;
  }

  // RichTextEntry.ProcessNode. Returns the text this node contributes.
  function processNode(node, ctx, env) {
    if (node.name === null) return node.text;
    const h = handlerFor(node.name, env.profile);
    if (!h) {
      if (env.diag && !node.closing) env.diag.unknownTag(node);
      return '';
    }
    if (!node.closing) {
      if (h.push) h.push(node, ctx, env);
      return h.textBefore ? h.textBefore(node, env) : '';
    }
    if (h.pop) h.pop(node, ctx, env);
    return h.textAfter ? h.textAfter(node, env) : '';
  }

  // RichTextEntry's constructor: every tag node, opening or closing, whose handler makes a
  // control gets one. Buttons are counted per kind in order, which is how clicking the nth
  // button of a kind finds the nth tag.
  function createControls(nodes, env) {
    const controls = new Map();
    const counters = {};
    nodes.forEach((node, i) => {
      if (node.name === null) return;
      const h = handlerFor(node.name, env.profile);
      const c = h && h.control ? h.control(node, env) : null;
      if (!c) return;
      c.index = counters[c.kind] || 0;
      counters[c.kind] = c.index + 1;
      controls.set(i, c);
    });
    return controls;
  }

  function makeEnv(profile, defaultFont, opts, diag) {
    return {
      profile, defaultFont, diag,
      round: opts.round || {},
      time: opts.time || 0,
      tagLineHeight: defaultFont.metrics().lineHeight,
      state: { animate: Infinity, fontsLoading: false },  // shared by every pass over the text
    };
  }

  // Diagnostics help authors spot places where the game does something surprising.
  function makeDiagnostics(source, profile) {
    const lineStarts = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1);
    const lineOf = pos => {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
    const items = [];
    const seen = new Set();
    const fontNames = Object.keys(ROBUST_FONT_PROTOTYPES);
    const d = {
      items, lineOf,
      add(node, level, msg) {
        const line = node ? lineOf(node.start) : null;
        const key = line + msg;
        if (seen.has(key) || items.length > 40) return;
        seen.add(key);
        items.push({ line, level, msg });
      },
      at(pos, level, msg) {
        d.add(pos === null ? null : { start: pos }, level, msg);
      },
      once(key, node, level, msg) {
        if (seen.has(`once:${key}`)) return;
        seen.add(`once:${key}`);
        d.add(node, level, msg);
      },
      unknownTag(node) {
        const name = node.name, lower = name.toLowerCase();
        if (lower !== name && handlerFor(lower, profile)) {
          d.add(node, 'info', `[${name}] isn't a tag, because tag names are lower case in game. Write [${lower}].`);
        } else if (TAG_HANDLERS.has(name)) {
          d.add(node, 'info', `[${name}] only works on business cards. Paper hides it.`);
        } else {
          d.add(node, 'info', `[${name}] isn't a ${profile.allowed ? 'paper tag' : 'tag the game knows'}, so the game hides it.`);
        }
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
          d.add(node, 'error', `[/${node.name}] has nothing left to close. The game throws an error here and the text may not display.`);
        } else if (top.tag === null) {
          d.add(node, 'warn', `[/${node.name}] has no matching opening tag.`);
        } else if (top.tag !== node.name) {
          d.add(node, 'warn', `[/${node.name}] closes the [${top.tag}] ${what} first, because the game closes tags in stack order.`);
        }
      },
      fontSize(node, sp, size) {
        if (sp && sp.type !== 'long') d.add(node, 'warn', 'size needs a plain number, like size=20, so the game ignores this one.');
        else if (size < 1) d.add(node, 'warn', `size=${size} gets drawn at size 1 in game, which is too small to read.`);
        else if (size > MAX_SIZE) d.add(node, 'warn', `size=${size} is too big to preview, so it's drawn at size ${MAX_SIZE} here.`);
      },
      fontStatus(node, id, status) {
        if (status === 'unknown') {
          const match = fontNames.find(n => n.toLowerCase() === String(id).toLowerCase());
          d.add(node, 'warn', match
            ? `There's no font called "${id}", because font names are case-sensitive, so the game uses Default. Did you mean "${match}"?`
            : `There's no font called "${id}", so the game uses Default. The fonts are ${fontNames.join(', ')}.`);
        } else if (status === 'unavailable') {
          d.add(node, 'info', `"${id}" isn't free to share, so the simulator draws it with Default and its spacing won't match the game.`);
        } else if (status === 'failed') {
          d.add(node, 'info', `Couldn't load the "${id}" font, so it's drawn with Default here.`);
        }
      },
      deadButton(node, label) {
        d.once(`dead:${label}`, node, 'warn', `[${node.name}] puts a ${label} button on the card, but on a business card clicking it does nothing in game.`);
      },
      link(node, kind, target) {
        if (kind === 'cmdlink') d.add(node, 'warn', `Clicking this [cmdlink] makes the reader's game run the console command "${target}".`);
        else d.once('textlink', node, 'info', '[textlink] links only go somewhere in the guidebook. Clicking one here does nothing.');
      },
      bigGlyph(node) {
        d.once('bigglyph', node, 'warn', 'Some letters here are bigger than the 256×256 sheets the game draws text from, so in game they may come out blank or garbled.');
      },
      abort(node) {
        d.add(node, 'warn', 'A character here is wider than the space for text, so the game stops wrapping and everything after it goes on one line.');
      },
    };
    return d;
  }

  function parserDiagnostics(parsed, source, diag) {
    if (parsed.truncatedAt !== null) {
      diag.at(parsed.truncatedAt, 'error',
        'A lone backslash stops the game reading the text. Everything after it is dropped. Write \\\\ for a literal backslash.');
    }
    if (parsed.mode === 'permissive' && parsed.invalidTags.length) {
      const first = parsed.invalidTags[0];
      const snippet = source.slice(first, Math.min(source.length, first + 16)).split('\n')[0];
      diag.at(first, 'info',
        `"${snippet}" isn't a valid tag, so the game shows it as plain text${parsed.invalidTags.length > 1 ? ` (${parsed.invalidTags.length} spots)` : ''}.`);
    }
  }

  const sortDiagnostics = items => items.sort((a, b) => (a.line || 0) - (b.line || 0));

  // ── RichTextEntry.Update ──
  function update(nodes, controls, maxSizeX, env) {
    const defaultFont = env.defaultFont;
    let height = defaultFont.metrics().height;
    const lineBreaks = [];
    const ww = new WordWrap(maxSizeX);
    const ctx = makeContext(defaultFont);

    const currentFont = () => { const t = peek(ctx.font); return t ? t.font : defaultFont; };
    const checkLineBreak = line => {
      if (line === null || line === undefined) return;
      lineBreaks.push(line);
      height += currentFont().metrics().lineHeight;
    };
    // Update returns early when a single character is wider than the space, without
    // working out a width.
    const aborted = node => {
      if (env.diag) env.diag.abort(node);
      return { lineBreaks, height, width: 0 };
    };

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      const text = processNode(node, ctx, env);
      const font = currentFont();
      const checkSheets = env.diag && font.metrics().ppem > 128;
      for (const ch of text) {
        const rune = ch.codePointAt(0);
        const r = ww.nextRune(rune);
        checkLineBreak(r.breakLine);
        checkLineBreak(r.breakNewLine);
        if (r.skip) continue;
        const adv = font.charAdvance(rune);
        if (adv === null) continue;
        if (checkSheets) {
          const g = font.resolveGlyph(rune);
          const ink = g && g.face.glyphInk(g.cp, font.size);
          if (ink && (ink.w > 256 || ink.h > 256)) env.diag.bigGlyph(node);
        }
        const m = ww.nextMetrics(adv);
        checkLineBreak(m.breakLine);
        if (m.abort) return aborted(node);
      }
      const c = controls.get(ni);
      if (!c) continue;
      // control.Measure(maxSizeX, Height): the desired size can't be wider than the space.
      const m = ww.nextMetrics(Math.min(c.w + c.margin[0] + c.margin[2], maxSizeX));
      checkLineBreak(m.breakLine);
      if (m.abort) return aborted(node);
    }
    const fin = ww.finalizeText();
    checkLineBreak(fin.breakLine);
    return { lineBreaks, height, width: fin.width };
  }

  // ── RichTextEntry.Draw ──
  // Also tracks where the ink actually lands, and the first node that crosses the given
  // top or bottom edge (in text coordinates), for the warnings.
  function draw(nodes, controls, lay, env, edges = { top: -Infinity, bottom: Infinity }) {
    const defaultFont = env.defaultFont;
    const dm = defaultFont.metrics();
    const ctx = makeContext(defaultFont);
    const glyphs = [];
    const placed = [];
    const lineBreaks = lay.lineBreaks;
    let globalBreakCounter = 0, lineBreakIndex = 0;
    let x = 0, baseY = dm.ascent;
    let controlYAdvance = 0;
    // topAt / bottomAt: { node, k }, the node and the offset into its text where ink first
    // crosses an edge. sourcePos turns that into a position in the source.
    const ink = { top: Infinity, bottom: -Infinity, topAt: null, bottomAt: null };
    const mark = (top, bottom, at) => {
      if (top < ink.top) ink.top = top;
      if (bottom > ink.bottom) ink.bottom = bottom;
      if (ink.topAt === null && top < edges.top) ink.topAt = at;
      if (ink.bottomAt === null && bottom > edges.bottom) ink.bottomAt = at;
    };

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      const text = processNode(node, ctx, env);
      let color, font;
      const ct = peek(ctx.color), ft = peek(ctx.font);
      if (!ct || !ft) { color = PAPER.textColor; font = defaultFont; }
      else { color = ct.color; font = ft.font; }
      const fm = font.metrics();

      let k = 0; // offset into the node's text, in UTF-16 units
      for (const ch of text) {
        const rune = ch.codePointAt(0);
        if (lineBreakIndex < lineBreaks.length && lineBreaks[lineBreakIndex] === globalBreakCounter) {
          x = 0;
          baseY += fm.lineHeight + controlYAdvance;
          controlYAdvance = 0;
          lineBreakIndex++;
        }
        const g = font.resolveGlyph(rune);
        if (g) {
          if (!isRuneWhiteSpace(g.cp)) {
            glyphs.push({ x, y: baseY, face: g.face, pt: font.size, cp: g.cp, color });
            const gi = g.face.glyphInk(g.cp, font.size);
            if (gi) mark(baseY + gi.top, baseY + gi.bottom, { node, k });
          }
          x += g.advance;
        }
        globalBreakCounter++;
        k += ch.length;
      }

      const c = controls.get(ni);
      if (!c) continue;
      // control.Position goes straight to the pen position, so the control's margin isn't
      // applied to where it's drawn, only to how far the pen moves after it.
      const top = baseY - dm.ascent;
      placed.push({ ...c, x, y: top });
      const desiredW = Math.min(c.w + c.margin[0] + c.margin[2], lay.width);
      const desiredH = Math.min(c.h + c.margin[1] + c.margin[3], lay.height);
      controlYAdvance = Math.max(0, desiredH - fm.lineHeight);
      if (c.type === 'icon') mark(top + 5, top + 21, { node, k: 0 });
      else mark(top, top + c.h, { node, k: 0 });
      x += desiredW;
    }
    if (ink.top === Infinity) { ink.top = 0; ink.bottom = 0; }
    return { glyphs, controls: placed, ink };
  }

  // Source position of a { node, k } from draw. Text nodes hold unescaped text, so walk the
  // source counting each escape (\[ and friends) as the one character it stands for.
  function sourcePos(source, at) {
    if (!at) return null;
    const { node, k } = at;
    if (node.name !== null) return node.start;
    let p = node.start;
    for (let i = 0; i < k && p < node.end; i++) p += source[p] === '\\' ? 2 : 1;
    return p;
  }

  // ── Paper ──
  // Paper width and text width for a given width of the scroll area.
  function geometry(contentWidth) {
    const paperWidth = Math.max(0, Math.min(contentWidth, PAPER.paperMaxWidth));
    return { contentWidth, paperWidth, wrapWidth: Math.max(0, paperWidth - PAPER.border * 2) };
  }

  const DEFAULT_WINDOW = { width: PAPER.windowWidth, height: PAPER.windowHeight };

  // Full paper layout for the paper window (the game's default size is 520×660).
  // Returns everything needed to paint the paper, place the buttons and draw the scrollbar.
  function layoutPaper(source, win = DEFAULT_WINDOW, opts = {}) {
    const profile = PROFILES.paper;
    const defaultFont = RobustFonts.defaultFont();
    const parsed = RobustMarkup.parse(source);
    const diag = makeDiagnostics(source, profile);
    parserDiagnostics(parsed, source, diag);
    const env = makeEnv(profile, defaultFont, opts, diag);
    const quiet = { ...env, diag: null };
    const controls = createControls(parsed.nodes, env);

    const viewportHeight = Math.max(0, win.height - PAPER.closeRowHeight);
    const contentHeightOf = lay => lay.height + PAPER.border * 2;

    // The game's ScrollContainer creates its scrollbar already visible, and opening the
    // window only measures it, so the first real layout wraps the text with the
    // scrollbar's 10px taken off. If the paper overflows at that width the scrollbar
    // stays. Otherwise it hides, and the text re-wraps at the full width.
    let geo = geometry(win.width - PAPER.scrollbarWidth);
    let lay = update(parsed.nodes, controls, geo.wrapWidth, env);
    const scrolls = contentHeightOf(lay) > viewportHeight;
    if (!scrolls) {
      geo = geometry(win.width);
      lay = update(parsed.nodes, controls, geo.wrapWidth, quiet);
    }

    // The white panel is as tall as the game measured it, or the scroll area if that's taller.
    const paperHeight = Math.max(viewportHeight, Math.ceil(contentHeightOf(lay)));
    const drawn = draw(parsed.nodes, controls, lay, quiet,
      { top: -PAPER.border, bottom: paperHeight - PAPER.border });

    // The scroll area clips the paper, so ink beyond its edges is lost.
    const cutTop = Math.ceil(-PAPER.border - drawn.ink.top);
    if (cutTop > 0) {
      diag.at(sourcePos(source, drawn.ink.topAt), 'warn',
        `The first line's big text pokes ${cutTop}px above the paper, so the top of it gets cut off in game. A line break straight after the opening size tag fixes it.`);
    }
    const cutBottom = Math.ceil(PAPER.border + drawn.ink.bottom - paperHeight);
    if (cutBottom > 0) {
      diag.at(sourcePos(source, drawn.ink.bottomAt), 'warn',
        `The end of the text reaches ${cutBottom}px past the bottom of the paper, so it gets cut off in game. Adding blank lines at the end fixes it.`);
    }

    let blank = null;
    if (source.length === 0) {
      const w = runWidth(PAPER.blankMessage, defaultFont);
      blank = { x: Math.floor((geo.wrapWidth - w) / 2), text: PAPER.blankMessage };
    }

    return {
      kind: 'paper', source, parsed, defaultFont, scrolls,
      window: { width: win.width, height: win.height },
      viewportHeight,
      contentWidth: geo.contentWidth,                      // scroll area width (minus the scrollbar)
      paperX: Math.round((geo.contentWidth - geo.paperWidth) / 2), // centred when capped at 600px
      wrapWidth: geo.wrapWidth,
      width: geo.paperWidth, height: paperHeight,           // the canvas: just the white paper
      surface: { x: 0, y: 0, w: geo.paperWidth, h: paperHeight },
      origin: { x: PAPER.border, y: PAPER.border },
      scrollMax: Math.max(0, paperHeight - viewportHeight),
      glyphs: drawn.glyphs, controls: drawn.controls,
      diagnostics: sortDiagnostics(diag.items),
      blank,
      animate: env.state.animate, fontsLoading: env.state.fontsLoading,
    };
  }

  // ── Business card ──
  // Layout for BusinessCardWindow. The canvas is exactly the card, so anything outside it
  // isn't drawn.
  function layoutCard(source, opts = {}) {
    const profile = PROFILES.card;
    const defaultFont = RobustFonts.defaultFont();
    const parsed = RobustMarkup.parse(source);
    const diag = makeDiagnostics(source, profile);
    parserDiagnostics(parsed, source, diag);
    const env = makeEnv(profile, defaultFont, opts, diag);
    const controls = createControls(parsed.nodes, env);

    const wrapWidth = CARD.windowWidth - CARD.margin * 2;
    const cardHeight = CARD.windowHeight - CARD.closeRowHeight;
    const lay = update(parsed.nodes, controls, wrapWidth, env);
    const drawn = draw(parsed.nodes, controls, lay, { ...env, diag: null },
      { top: -CARD.margin, bottom: cardHeight - CARD.margin });

    // The first line always sits where 12pt text would, so big text on it rises out of the
    // top of the card, and text that doesn't fit runs out of the bottom. Both get cut off.
    const cutTop = Math.max(0, Math.ceil(-CARD.margin - drawn.ink.top));
    const cutBottom = Math.max(0, Math.ceil(CARD.margin + drawn.ink.bottom - cardHeight));
    if (cutTop > 0) {
      diag.at(sourcePos(source, drawn.ink.topAt), 'warn',
        `The first line's big text pokes ${cutTop}px above the card, so the top of it gets cut off. The game puts the first line where 12pt text would go. A line break straight after the opening [head] or [font] tag fixes it.`);
    }
    if (cutBottom > 0) {
      diag.at(sourcePos(source, drawn.ink.bottomAt), 'warn',
        `The text runs ${cutBottom}px past the bottom of the card, so the end gets cut off. Business cards don't scroll.`);
    }
    if (source.length > CARD.maxLength) {
      diag.at(null, 'error',
        `Business cards hold at most ${CARD.maxLength} characters. This has ${source.length}, so the game won't let you save it.`);
    }

    return {
      kind: 'card', source, parsed, defaultFont,
      window: { width: CARD.windowWidth, height: CARD.windowHeight },
      wrapWidth,
      width: CARD.windowWidth, height: cardHeight,
      surface: { x: 0, y: 0, w: CARD.windowWidth, h: cardHeight },
      origin: { x: CARD.margin, y: CARD.margin },
      cutTop, cutBottom,
      glyphs: drawn.glyphs, controls: drawn.controls,
      diagnostics: sortDiagnostics(diag.items),
      length: source.length, maxLength: CARD.maxLength,
      animate: env.state.animate, fontsLoading: env.state.fontsLoading,
    };
  }

  // ── Painting ──
  const rgba = c => c.a === 255 ? `rgb(${c.r},${c.g},${c.b})` : `rgba(${c.r},${c.g},${c.b},${(c.a / 255).toFixed(3)})`;

  // Width of a run of text in whole pixels, the way Label measures it.
  function runWidth(text, font) {
    let w = 0;
    for (const ch of text) w += font.charAdvance(ch.codePointAt(0)) || 0;
    return w;
  }

  // Draws a run of text glyph by glyph on whole-pixel advances, like Font.DrawChar.
  function paintRun(g, text, x, baseline, font, fill) {
    g.fillStyle = fill;
    for (const ch of text) {
      const r = font.resolveGlyph(ch.codePointAt(0));
      if (!r) continue;
      if (!isRuneWhiteSpace(r.cp)) {
        g.font = r.face.size(font.size).css;
        g.fillText(String.fromCodePoint(r.cp), x, baseline);
      }
      x += r.advance;
    }
  }

  // Where a square button's label starts. ButtonSquare's content box starts 9px in (8px
  // margin + 1px padding) and stops 10px from the right (8 + 2), and Label centres the
  // text in it with integer maths.
  function buttonLabelX(w, label, font) {
    return 9 + Math.trunc((w - 19 - runWidth(label, font)) / 2);
  }

  function paintButton(g, x, y, w, h, label, font) {
    g.fillStyle = PAPER.button.bg;
    g.fillRect(x, y, w, h);
    const m = font.metrics();
    const labelTop = Math.trunc((h - Math.min(h, m.height)) / 2);
    paintRun(g, label, x + buttonLabelX(w, label, font), y + labelTop + m.ascent, font, PAPER.button.text);
  }

  // Paints a layout onto a canvas at the given pixel scale. surfaceOnly crops to the white
  // paper or card, which is what the image export saves.
  function paint(canvas, model, scale, { drawControls = false, surfaceOnly = false } = {}) {
    const s = model.surface;
    const width = surfaceOnly ? s.w : model.width;
    const height = surfaceOnly ? s.h : model.height;
    // Browsers refuse canvases taller than about 32k pixels, so very long papers
    // are drawn at a lower pixel density instead of coming out blank.
    scale = Math.max(0.25, Math.min(scale, 32000 / Math.max(1, height), 16000 / Math.max(1, width)));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const g = canvas.getContext('2d');
    g.setTransform(scale, 0, 0, scale, surfaceOnly ? -s.x * scale : 0, surfaceOnly ? -s.y * scale : 0);
    g.fillStyle = PAPER.background;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.textBaseline = 'alphabetic';
    if ('fontKerning' in g) g.fontKerning = 'none';

    const ox = model.origin.x, oy = model.origin.y;
    let lastFont = '', lastColor = '';
    for (const gl of model.glyphs) {
      const css = gl.face.size(gl.pt).css;
      if (css !== lastFont) { g.font = css; lastFont = css; }
      const fill = rgba(gl.color);
      if (fill !== lastColor) { g.fillStyle = fill; lastColor = fill; }
      g.fillText(String.fromCodePoint(gl.cp), ox + gl.x, oy + gl.y);
    }

    const f = model.defaultFont, m = f.metrics();
    if (model.blank) paintRun(g, model.blank.text, ox + model.blank.x, oy + m.ascent, f, rgba(PAPER.textColor));

    for (const c of model.controls) {
      const x = ox + c.x, y = oy + c.y;
      if (c.type === 'link') {
        c.text.split('\n').forEach((line, i) => paintRun(g, line, x, y + m.ascent + i * m.lineHeight, f, rgba(c.color)));
      } else if (c.type === 'icon') {
        g.fillStyle = 'rgba(128,128,128,0.45)';
        g.fillRect(x, y + 5, 16, 16);
      } else if (drawControls) {
        paintButton(g, x, y, c.w, c.h, c.label, f);
      }
    }
  }

  // Width in pixels of a single line of markup, ignoring wrapping. Used for centring.
  function measureLine(markup, profileName = 'paper', opts = {}) {
    const defaultFont = RobustFonts.defaultFont();
    const parsed = RobustMarkup.parse(markup);
    const env = makeEnv(PROFILES[profileName], defaultFont, opts, null);
    const controls = createControls(parsed.nodes, env);
    const ctx = makeContext(defaultFont);
    let w = 0;
    parsed.nodes.forEach((node, i) => {
      const text = processNode(node, ctx, env);
      const t = peek(ctx.font);
      w += runWidth(text, t ? t.font : defaultFont);
      const c = controls.get(i);
      if (c) w += c.w + c.margin[0] + c.margin[2];
    });
    return w;
  }

  // ── Tag replacement, same as PaperWindow / PaperSystem ──
  // The nth button of a kind replaces the nth literal "[form]", "[signature]", "[check]",
  // "[date]" or "[time]".
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

  // PaperSystem.CleanUnfilledTags, applied when a paper or card is stamped.
  function cleanUnfilledTags(text) {
    return text.split('[form]').join('').split('[signature]').join('')
      .split('[date]').join('').split('[time]').join('').split('[check]').join('☐');
  }

  return { layoutPaper, layoutCard, paint, measureLine, findNthTag, cleanUnfilledTags, buttonLabelX };
})();
