// energy-neon-card v1.3.0 \u2014 \u043D\u0435\u043E\u043D\u043E\u0432\u0430 \u043A\u0430\u0440\u0442\u043A\u0430 \u043F\u043E\u0442\u043E\u043A\u0456\u0432 \u0435\u043D\u0435\u0440\u0433\u0456\u0457 (\u043C\u0435\u0440\u0435\u0436\u0430 / \u0410\u041A\u0411 / \u0434\u0456\u043C)
const ENC_VERSION = '1.3.0';

class EnergyNeonCard extends HTMLElement {
  setConfig(c) {
    if (!c || !c.battery || !c.home) throw new Error('\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0456 battery \u0456 home');
    this._c = Object.assign({ title: '\u0406\u043D\u0432\u0435\u0440\u0442\u043E\u0440', subtitle: 'MultiPlus', max_power: 1600, capacity_kwh: 5, idle_power: 15 }, c);
    this._period = this._period || 'day';
    this._stats = {};
    this._built = false;
    if (this.shadowRoot) this.shadowRoot.innerHTML = '';
  }
  set hass(h) {
    this._hass = h;
    if (!this._built) this._build();
    this._update();
    this._fetch(false);
  }
  getCardSize() { return 10; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  connectedCallback() {
    if (!this._timer) this._timer = setInterval(() => this._fetch(true), 300000);
  }
  disconnectedCallback() { clearInterval(this._timer); this._timer = null; }

  // ---------- helpers ----------
  _list(id) { return id ? (Array.isArray(id) ? id : [id]) : []; }
  _vals(id) {
    const out = [];
    for (const i of this._list(id)) {
      const s = this._hass && this._hass.states[i];
      const n = s ? parseFloat(s.state) : NaN;
      if (!isNaN(n)) out.push(n);
    }
    return out;
  }
  _num(id) { const v = this._vals(id); return v.length ? v[0] : null; }
  _avg(id) { const v = this._vals(id); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
  _sum(id) { const v = this._vals(id); return v.length ? v.reduce((a, b) => a + b, 0) : null; }
  _str(id) { const s = id && this._hass && this._hass.states[id]; return s ? s.state : null; }
  _pw(w) {
    if (w === null) return '\u2014';
    const a = Math.abs(w);
    return a >= 1000 ? (a / 1000).toFixed(2) + ' kW' : Math.round(a) + ' W';
  }
  _f(v, d, u) { return v === null ? '\u2014' : v.toFixed(d) + (u ? ' ' + u : ''); }
  _dur(h) {
    if (h === null || !isFinite(h)) return '\u2014';
    if (h > 99) return '> 99 \u0433\u043E\u0434';
    const m = Math.round(h * 60);
    return Math.floor(m / 60) + ' \u0433\u043E\u0434 ' + String(m % 60).padStart(2, '0') + ' \u0445\u0432';
  }
  _$(id) { return this.shadowRoot.getElementById(id); }
  _flow(id, w, reverse) {
    const el = this._$(id);
    const base = this._$(id + '-base');
    const on = w !== null && Math.abs(w) > this._c.idle_power;
    el.style.opacity = on ? '1' : '0';
    base.classList.toggle('live', on);
    if (on) {
      const d = Math.max(0.3, Math.min(2.6, 450 / (Math.abs(w) + 150)));
      el.style.animationDuration = d.toFixed(2) + 's';
      el.style.animationDirection = reverse ? 'reverse' : 'normal';
    }
  }

  // ---------- build ----------
  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const c = this._c;
    const tabs = [['day', '\u0414\u0415\u041D\u042C'], ['week', '\u0422\u0418\u0416\u0414\u0415\u041D\u042C'], ['month', '\u041C\u0406\u0421\u042F\u0426\u042C'], ['all', '\u0412\u0421\u0415']];
    const temps = (c.temps || []).map((t, i) =>
      `<div class="temp"><div class="tv" id="t${i}">\u2014</div><div class="tl">${t.name || ''}</div></div>`).join('');
    this.shadowRoot.innerHTML = `
<style>
  :host { --g:#3fa9ff; --b:#2ee59d; --h:#b46bff; --a:#ffb84d; --r:#ff4d5e; --txt:#e8eef7; --dim:#7d8aa0; }
  ha-card { background: radial-gradient(120% 80% at 50% 0%, #16233a 0%, #0c1320 55%, #090e18 100%); color: var(--txt);
    border-radius: 22px; overflow: hidden; position: relative; border: 1px solid #1c2a40; }
  ha-card::before { content:''; position:absolute; left:16px; right:16px; top:0; height:3px; border-radius:0 0 3px 3px;
    background: var(--mode, var(--g)); box-shadow: 0 0 12px var(--mode, var(--g)); }
  .wrap { padding: 16px 14px 14px; }
  .hdr { display:flex; align-items:center; gap:12px; }
  .ico { width:44px; height:44px; border-radius:12px; background:#121d30; border:1px solid #22324c; display:flex; align-items:center; justify-content:center; }
  .ico svg { width:24px; height:24px; filter: drop-shadow(0 0 5px #ffb84d); }
  .t { font-size:18px; font-weight:700; letter-spacing:.3px; }
  .st { font-size:11px; color:var(--dim); letter-spacing:1.5px; text-transform:uppercase; display:flex; align-items:center; gap:6px; }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--b); box-shadow:0 0 6px var(--b); animation: blink 2s infinite; }
  .badge { margin-left:auto; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:1.5px;
    border:1px solid currentColor; background: rgba(255,255,255,.03); box-shadow: 0 0 10px -2px currentColor inset; }
  svg.flow { width:100%; height:auto; display:block; margin-top:4px; }
  text { font-family: inherit; }
  .v { font-size:15px; font-weight:700; fill:var(--txt); }
  .s { font-size:10.5px; fill:#a9b4c6; }
  .l { font-size:9.5px; fill:var(--dim); letter-spacing:2px; font-weight:600; }
  .base { fill:none; stroke:#22324c; stroke-width:3; stroke-linejoin:round; transition: stroke .6s; }
  .dots { fill:none; stroke-width:6; stroke-linecap:round; stroke-dasharray:0.1 16; stroke-linejoin:round;
    animation: flow 1s linear infinite; transition: opacity .5s; }
  .base.live.g { stroke:#1d4a70; } .base.live.b { stroke:#1b5a46; } .base.live.h { stroke:#4a2d6e; }
  .dots.g { stroke:var(--g); filter: drop-shadow(0 0 3px var(--g)); }
  .dots.b { stroke:var(--b); filter: drop-shadow(0 0 3px var(--b)); }
  .dots.h { stroke:var(--h); filter: drop-shadow(0 0 3px var(--h)); }
  @keyframes flow { to { stroke-dashoffset: -16; } }
  @keyframes blink { 50% { opacity:.35; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes spinr { to { transform: rotate(-360deg); } }
  @keyframes flick { 0%,100%{opacity:1} 45%{opacity:.75} 50%{opacity:.4} 55%{opacity:.9} }
  @keyframes hg { 0%,80% { transform: rotate(0deg); } 100% { transform: rotate(180deg); } }
  @keyframes fall { to { stroke-dashoffset: -8; } }
  @keyframes wave { to { transform: translateX(42px); } }
  @keyframes waver { from { transform: translateX(42px); } to { transform: translateX(0px); } }
  .liq { transition: transform 1.2s ease-in-out; }
  .wv1 { animation: wave var(--ws, 6s) linear infinite; }
  .wv2 { animation: waver calc(var(--ws, 6s) * 1.6) linear infinite; }
  .spin { animation: spin 24s linear infinite; }
  .spinr { animation: spinr 40s linear infinite; }
  .pylon { color: var(--g); filter: drop-shadow(0 0 6px var(--g)); transition: color .6s; }
  .bolt { animation: flick 3s infinite; }
  .off .pylon { color:#3a4a62; filter:none; } .off .bolt { display:none; } .nogrid { display:none; } .off .nogrid { display:block; }
  .house { filter: drop-shadow(0 0 8px var(--h)); }
  .win { fill:#ffcf6b; filter: drop-shadow(0 0 4px #ffcf6b); }
  .batt { filter: drop-shadow(0 0 10px var(--bc, var(--b))); }
  .hgl { color: var(--a); filter: drop-shadow(0 0 5px var(--a)); }
  .hgl.run .hgi { animation: hg 5s ease-in-out infinite; }
  .stream { stroke-dasharray:2 2; animation: fall .6s linear infinite; }
  .hgl:not(.run) .stream { display:none; }
  .stats { margin-top:10px; background:#0e1726; border:1px solid #1c2a40; border-radius:18px; padding:12px; }
  .tabs { display:flex; gap:6px; justify-content:center; margin-bottom:12px; flex-wrap:wrap; }
  .tab { padding:6px 12px; border-radius:16px; border:1px solid #2a3a55; color:var(--dim); font-size:11px; font-weight:700; letter-spacing:1.5px; cursor:pointer; user-select:none; }
  .tab.on { color:#7fd0ff; border-color:#3fa9ff; background:rgba(63,169,255,.12); box-shadow:0 0 8px -2px #3fa9ff; }
  .tiles { display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; }
  .tile { background:#0b121e; border:1px solid #18253a; border-radius:14px; padding:10px 12px; }
  .tile .n { font-size:21px; font-weight:700; } .tile .n small { font-size:11px; color:var(--dim); font-weight:500; margin-left:2px; }
  .tile .k { font-size:10px; color:var(--dim); letter-spacing:1.8px; font-weight:700; margin-top:2px; }
  .temps { display:grid; grid-template-columns: repeat(var(--tn, 4), minmax(0, 1fr)); gap:6px; margin-top:8px; }
  .temp { background:#0e1726; border:1px solid #1c2a40; border-radius:12px; padding:8px 4px; text-align:center; min-width:0; }
  .tv { font-size:18px; font-weight:700; white-space:nowrap; } .tv small { font-size:10px !important; }
  .tl { font-size:8.5px; color:var(--dim); letter-spacing:.8px; font-weight:700; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
</style>
<ha-card>
 <div class="wrap">
  <div class="hdr">
   <div class="ico"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#ffb84d"/></svg></div>
   <div><div class="t">${c.title}</div><div class="st">${c.subtitle}<span class="dot"></span>LIVE</div></div>
   <div class="badge" id="badge">\u2014</div>
  </div>
  <svg class="flow" viewBox="0 0 400 430">
   <defs>
    <clipPath id="bclip"><rect x="-21" y="-35" width="42" height="72" rx="7"/></clipPath>
    <linearGradient id="lshade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
    <linearGradient id="bgrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
   </defs>

   <!-- \u043B\u0456\u043D\u0456\u0457 -->
   <path id="fg-base" class="base g" d="M330 140 V210 H262"/>
   <path id="fg" class="dots g" d="M330 140 V210 H262"/>
   <path id="fb-base" class="base b" d="M70 282 V210 H138"/>
   <path id="fb" class="dots b" d="M70 282 V210 H138"/>
   <path id="fh-base" class="base h" d="M200 272 V330 H290"/>
   <path id="fh" class="dots h" d="M200 272 V330 H290"/>

   <!-- \u0446\u0435\u043D\u0442\u0440: \u043A\u0456\u043B\u044C\u0446\u0435 \u043D\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0435\u043D\u043D\u044F -->
   <g transform="translate(200,210)">
    <g class="spin"><circle r="74" fill="none" stroke="var(--mode,#3fa9ff)" stroke-opacity=".55" stroke-width="2" stroke-dasharray="3 9" style="filter:drop-shadow(0 0 3px var(--mode,#3fa9ff))"/></g>
    <g class="spinr"><circle r="67" fill="none" stroke="var(--mode,#3fa9ff)" stroke-opacity=".3" stroke-width="1.5" stroke-dasharray="40 14"/></g>
    <circle r="60" fill="#0b1422" stroke="#16243a" stroke-width="2"/>
    <circle r="53" fill="none" stroke="#17263c" stroke-width="7"/>
    <circle id="ring" r="53" fill="none" stroke="var(--mode,#3fa9ff)" stroke-width="7" stroke-linecap="round"
      transform="rotate(-90)" stroke-dasharray="0 400" style="filter:drop-shadow(0 0 5px var(--mode,#3fa9ff)); transition: stroke-dasharray .8s"/>
    <text id="cpct" y="-8" text-anchor="middle" style="font-size:30px;font-weight:800;fill:var(--mode,#3fa9ff)">\u2014</text>
    <text y="8" text-anchor="middle" class="l" style="font-size:8px;letter-spacing:1px">\u041D\u0410\u0412\u0410\u041D\u0422\u0410\u0416\u0415\u041D\u041D\u042F</text>
    <text id="cvolt" y="25" text-anchor="middle" class="s" style="font-weight:600">\u2014</text>
    <text id="cmode" y="40" text-anchor="middle" style="font-size:9.5px;font-weight:700;letter-spacing:1px;fill:#c9d4e6">\u2014</text>
   </g>

   <!-- \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u0456\u044F -->
   <g transform="translate(70,52)">
    <g id="hgl" class="hgl"><g class="hgi">
     <path d="M-16 -27 H16 M-16 27 H16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
     <path d="M-12 -27 C-12 -8 -3 -5 -3 0 C-3 5 -12 8 -12 27 M12 -27 C12 -8 3 -5 3 0 C3 5 12 8 12 27" fill="none" stroke="currentColor" stroke-width="2.2"/>
     <path id="sandT" d="M-9 -19 L9 -19 L0 -3 Z" fill="currentColor" opacity=".85"/>
     <path d="M-9 22 L9 22 L0 9 Z" fill="currentColor" opacity=".85"/>
     <path class="stream" d="M0 -3 V20" stroke="currentColor" stroke-width="1.6"/>
    </g></g>
   </g>
   <text id="av" x="70" y="102" text-anchor="middle" class="v" style="fill:var(--a)">\u2014</text>
   <text id="as" x="70" y="117" text-anchor="middle" class="s">\u2014</text>
   <text id="al" x="70" y="131" text-anchor="middle" class="l">\u0410\u0412\u0422\u041E\u041D\u041E\u041C\u0406\u042F</text>

   <!-- \u043C\u0435\u0440\u0435\u0436\u0430 -->
   <g id="gnode" transform="translate(330,54)">
    <g class="pylon">
     <g stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round">
      <path d="M-15 40 L-5 -34 L5 -34 L15 40"/>
      <path d="M-27 -22 H27 M-21 -6 H21"/>
      <path d="M-11 8 L10 24 M11 8 L-10 24 M-8 -6 L7 8 M8 -6 L-7 8 M-6 -22 L6 -6 M6 -22 L-6 -6"/>
     </g>
     <g fill="currentColor"><circle cx="-27" cy="-22" r="3.2"/><circle cx="27" cy="-22" r="3.2"/><circle cx="-21" cy="-6" r="3.2"/><circle cx="21" cy="-6" r="3.2"/></g>
    </g>
    <path class="bolt" d="M4 -44 L-9 -16 L-1 -16 L-5 4 L10 -24 L2 -24 Z" fill="#9fdcff" style="filter:drop-shadow(0 0 6px #3fa9ff)"/>
    <g class="nogrid"><circle r="15" fill="#0c1320" stroke="#ff4d5e" stroke-width="2.5"/><path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="#ff4d5e" stroke-width="3" stroke-linecap="round"/></g>
   </g>
   <text id="gv" x="330" y="108" text-anchor="middle" class="v" style="fill:#7fd0ff">\u2014</text>
   <text id="gs" x="330" y="123" text-anchor="middle" class="s">\u2014</text>
   <text x="330" y="136" text-anchor="middle" class="l">\u041C\u0415\u0420\u0415\u0416\u0410</text>

   <!-- \u0431\u0430\u0442\u0430\u0440\u0435\u044F -->
   <g transform="translate(70,330)">
    <g id="batt" class="batt">
     <rect x="-10" y="-45" width="20" height="8" rx="2.5" fill="#cfd8e3"/>
     <rect x="-24" y="-39" width="48" height="80" rx="10" fill="#0e1828" stroke="var(--bc,#2ee59d)" stroke-width="2.5"/>
     <g clip-path="url(#bclip)">
      <g id="liq" class="liq" style="transform: translateY(37px)">
       <g class="wv2"><path d="M-63 1 Q-52.5 -2.5 -42 1 T-21 1 T0 1 T21 1 T42 1 T63 1 V90 H-63 Z" fill="var(--bc,#2ee59d)" opacity=".45"/></g>
       <g class="wv1"><path d="M-63 2 Q-52.5 5.5 -42 2 T-21 2 T0 2 T21 2 T42 2 T63 2 V90 H-63 Z" fill="var(--bc,#2ee59d)" opacity=".92"/></g>
      </g>
      <rect x="-21" y="-35" width="42" height="72" fill="url(#lshade)"/>
      <ellipse cx="-9" cy="-27" rx="9" ry="4.5" fill="#fff" opacity=".13"/>
      <ellipse cx="-14" cy="-29" rx="3.5" ry="2" fill="#fff" opacity=".12"/>
     </g>
    </g>
    <text id="bpct" y="7" text-anchor="middle" style="font-size:15px;font-weight:800;fill:#fff;paint-order:stroke;stroke:#0b1220;stroke-width:3px">\u2014</text>
    <path id="bchg" d="M2 -30 L-6 -16 L0 -16 L-3 -6 L6 -20 L0 -20 Z" fill="#fff" opacity="0"/>
   </g>
   <text id="bv" x="70" y="392" text-anchor="middle" class="v" style="fill:var(--bc,#2ee59d)">\u2014</text>
   <text id="bs" x="70" y="407" text-anchor="middle" class="s">\u2014</text>
   <text x="70" y="421" text-anchor="middle" class="l">\u0411\u0410\u0422\u0410\u0420\u0415\u042F</text>

   <!-- \u0434\u0456\u043C -->
   <g transform="translate(332,332)" class="house">
    <rect x="17" y="-42" width="10" height="20" fill="#1a1030" stroke="#b46bff" stroke-width="2"/>
    <rect x="-33" y="-12" width="66" height="48" fill="#1a1030" stroke="#b46bff" stroke-width="2.2"/>
    <path d="M-42 -8 L0 -44 L42 -8" fill="#24143f" stroke="#c98bff" stroke-width="2.5" stroke-linejoin="round"/>
    <rect class="win" x="-25" y="-2" width="15" height="14" rx="1.5"/>
    <rect class="win" x="10" y="-2" width="15" height="14" rx="1.5"/>
    <rect x="-6" y="16" width="12" height="20" fill="#2c1a4c" stroke="#b46bff" stroke-width="1.5"/>
   </g>
   <text id="hv" x="332" y="392" text-anchor="middle" class="v" style="fill:#d2a6ff">\u2014</text>
   <text id="hs" x="332" y="407" text-anchor="middle" class="s">\u2014</text>
   <text x="332" y="421" text-anchor="middle" class="l">\u0414\u0406\u041C</text>
  </svg>

  ${c.energy ? `<div class="stats">
   <div class="tabs">${tabs.map(t => `<div class="tab${t[0] === this._period ? ' on' : ''}" data-p="${t[0]}">${t[1]}</div>`).join('')}</div>
   <div class="tiles">
    <div class="tile"><div class="n" id="e-import" style="color:#7fd0ff">\u2014</div><div class="k">\u0406\u041C\u041F\u041E\u0420\u0422</div></div>
    <div class="tile"><div class="n" id="e-home" style="color:#d2a6ff">\u2014</div><div class="k">\u0421\u041F\u041E\u0416\u0418\u0412\u0410\u041D\u041D\u042F</div></div>
    <div class="tile"><div class="n" id="e-charge" style="color:#2ee59d">\u2014</div><div class="k">\u0417\u0410\u0420\u042F\u0414 \u0410\u041A\u0411</div></div>
    <div class="tile"><div class="n" id="e-discharge" style="color:#ffb84d">\u2014</div><div class="k">\u0420\u041E\u0417\u0420\u042F\u0414 \u0410\u041A\u0411</div></div>
   </div>
  </div>` : ''}
  ${temps ? `<div class="temps" style="--tn:${(c.temps || []).length}">${temps}</div>` : ''}
 </div>
</ha-card>`;
    this.shadowRoot.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => {
      this._period = el.dataset.p;
      this.shadowRoot.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === el));
      this._renderStats();
      this._fetch(false);
    }));
    this._built = true;
  }

  // ---------- update ----------
  _update() {
    if (!this._hass || !this._built) return;
    const c = this._c, root = this.shadowRoot.host;
    const g = c.grid || {}, b = c.battery, h = c.home;

    const gp = this._num(g.power), gvolt = this._num(g.voltage), gcur = this._num(g.current);
    const gridOn = (gvolt !== null && gvolt > 100) || (gvolt === null && gp !== null);
    const bp = this._num(b.power), soc = this._num(b.soc), bvolt = this._avg(b.voltage), bcur = this._num(b.current);
    const hp = this._num(h.power);

    // \u0440\u0435\u0436\u0438\u043C
    const mode = gridOn ? '#3fa9ff' : '#2ee59d';
    root.style.setProperty('--mode', mode);
    const badge = this._$('badge');
    badge.textContent = gridOn ? '\u26A1 \u041C\u0415\u0420\u0415\u0416\u0410' : '\uD83D\uDD0B \u0411\u0410\u0422\u0410\u0420\u0415\u042F';
    badge.style.color = mode;

    // \u043C\u0435\u0440\u0435\u0436\u0430
    this._$('gnode').classList.toggle('off', !gridOn);
    this._$('gv').textContent = gridOn ? (gp !== null ? (gp >= 0 ? '\u2193 ' : '\u2191 ') + this._pw(gp) : '\u2014') : '\u041D\u0415\u041C\u0410\u0404';
    this._$('gv').style.fill = gridOn ? '#7fd0ff' : '#ff6b78';
    this._$('gs').textContent = gridOn ? (gcur !== null ? gcur.toFixed(1) + ' A \u00B7 ' : '') + this._f(gvolt, 0, 'V') : '\u0432\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F';
    this._flow('fg', gridOn ? gp : 0, gp !== null && gp < 0);

    // \u0431\u0430\u0442\u0430\u0440\u0435\u044F
    const bc = soc === null ? '#2ee59d' : soc < 15 ? '#ff4d5e' : soc < 30 ? '#ffb84d' : '#2ee59d';
    root.style.setProperty('--bc', bc);
    const lvl = soc === null ? 0 : Math.max(0, Math.min(100, soc)) / 100;
    const fh = 72 * lvl;
    this._$('liq').style.transform = 'translateY(' + (37 - fh).toFixed(1) + 'px)';
    const ba = bp === null ? 0 : Math.abs(bp);
    root.style.setProperty('--ws', (ba > c.idle_power ? Math.max(1.6, Math.min(4.5, 900 / (ba + 150))) : 9).toFixed(2) + 's');
    this._$('bpct').textContent = soc === null ? '\u2014' : Math.round(soc) + '%';
    const charging = bp !== null && bp > c.idle_power;
    this._$('bchg').setAttribute('opacity', charging ? '0.95' : '0');
    this._$('bv').textContent = bp === null ? '\u2014' : (charging ? '+' : bp < -c.idle_power ? '\u2212' : '') + this._pw(bp);
    this._$('bs').textContent = (bcur !== null ? Math.abs(bcur).toFixed(1) + ' A \u00B7 ' : '') + this._f(bvolt, 2, 'V');
    this._flow('fb', bp, bp !== null && bp > 0);

    // \u0434\u0456\u043C
    this._$('hv').textContent = this._pw(hp);
    const hv = gridOn && gvolt ? gvolt : 230;
    this._$('hs').textContent = hp === null ? '\u2014' : (hp / hv).toFixed(1) + ' A \u00B7 ' + Math.round(hv) + ' V';
    this._flow('fh', hp, false);

    // \u0446\u0435\u043D\u0442\u0440
    const pct = hp === null ? null : Math.max(0, Math.min(100, hp / c.max_power * 100));
    const C = 2 * Math.PI * 53;
    this._$('ring').setAttribute('stroke-dasharray', pct === null ? '0 400' : (C * pct / 100).toFixed(1) + ' ' + C.toFixed(1));
    this._$('cpct').textContent = pct === null ? '\u2014' : Math.round(pct) + '%';
    const fr = this._num(c.frequency);
    this._$('cvolt').textContent = gridOn ? this._f(gvolt, 0, 'V') + (fr !== null ? ' \u00B7 ' + fr.toFixed(1) + ' Hz' : '') : '\u0406\u041D\u0412\u0415\u0420\u0422\u041E\u0420';
    let ms = this._str(c.status);
    if (!ms || ms === 'unavailable' || ms === 'unknown') ms = gridOn ? '\u0412\u0406\u0414 \u041C\u0415\u0420\u0415\u0416\u0406' : '\u0410\u0412\u0422\u041E\u041D\u041E\u041C\u041D\u041E';
    ms = ms.split(':')[0].toUpperCase();
    if (ms.length > 22) ms = ms.slice(0, 21) + '\u2026';
    this._$('cmode').textContent = ms;

    // \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u0456\u044F
    const capAh = this._sum(b.capacity), remAh = this._sum(b.remaining);
    const v = bvolt || 12.8;
    const totWh = capAh !== null ? capAh * v : c.capacity_kwh * 1000;
    const remWh = remAh !== null ? remAh * v : (soc !== null ? soc / 100 * totWh : null);
    let t = null, lbl = '\u041E\u0427\u0406\u041A\u0423\u0412\u0410\u041D\u041D\u042F';
    if (bp !== null && remWh !== null) {
      if (bp < -c.idle_power) { t = remWh / -bp; lbl = '\u0410\u0412\u0422\u041E\u041D\u041E\u041C\u0406\u042F'; }
      else if (bp > c.idle_power) { t = Math.max(0, totWh - remWh) / bp; lbl = '\u0414\u041E \u041F\u041E\u0412\u041D\u041E\u0413\u041E'; }
    }
    this._$('av').textContent = this._dur(t);
    this._$('al').textContent = lbl;
    this._$('as').textContent = remWh !== null ? '\u0437\u0430\u043F\u0430\u0441 ' + (remWh / 1000).toFixed(2) + ' kWh' : '\u2014';
    this._$('hgl').classList.toggle('run', t !== null);

    // \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0438
    (c.temps || []).forEach((tt, i) => {
      const x = this._num(tt.entity);
      const el = this._$('t' + i);
      if (!el) return;
      el.innerHTML = x === null ? '\u2014' : Math.round(x) + '<small style="font-size:11px;color:#7d8aa0"> \u00B0C</small>';
      const w = tt.warn || 40, cr = tt.crit || 55;
      el.style.color = x === null ? '#7d8aa0' : x >= cr ? '#ff4d5e' : x >= w ? '#ffb84d' : '#2ee59d';
    });
  }

  // ---------- \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 ----------
  async _fetch(force) {
    const e = this._c && this._c.energy;
    if (!e || !this._hass || this._fetching) return;
    const p = this._period;
    const cached = this._stats[p];
    if (!force && cached && Date.now() - cached.t < 300000) return;
    this._fetching = true;
    const out = { t: Date.now() };
    const per = p === 'all' ? {} : { calendar: { period: p } };
    for (const k of ['import', 'home', 'charge', 'discharge']) {
      if (!e[k]) continue;
      try {
        const r = await this._hass.callWS(Object.assign({ type: 'recorder/statistic_during_period', statistic_id: e[k], types: ['change'] }, per));
        out[k] = r && typeof r.change === 'number' ? r.change : null;
      } catch (err) { out[k] = null; }
    }
    this._stats[p] = out;
    this._fetching = false;
    this._renderStats();
    if (this._period !== p) this._fetch(false);
  }
  _renderStats() {
    const s = this._stats[this._period] || {};
    for (const k of ['import', 'home', 'charge', 'discharge']) {
      const el = this._$('e-' + k);
      if (!el) continue;
      const v = s[k];
      el.innerHTML = (v === null || v === undefined) ? '\u2014' : (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)) + '<small>kWh</small>';
    }
  }
}

if (!customElements.get('energy-neon-card')) customElements.define('energy-neon-card', EnergyNeonCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'energy-neon-card', name: 'Energy Neon Card', description: '\u041D\u0435\u043E\u043D\u043E\u0432\u0430 \u043A\u0430\u0440\u0442\u043A\u0430 \u043F\u043E\u0442\u043E\u043A\u0456\u0432 \u0435\u043D\u0435\u0440\u0433\u0456\u0457' });
console.info('%c ENERGY-NEON-CARD %c v' + ENC_VERSION + ' ', 'background:#3fa9ff;color:#000;font-weight:700', 'background:#0c1320;color:#3fa9ff');
