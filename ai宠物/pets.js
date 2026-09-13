/* ============================================================
 * AI宠物乐园 · 内置宠物形象库（pets.js）
 * 展示端(show.html)与管理后台(admin.html)共用。
 * 16 种宠物 × 4 形态（蛋/幼年/成熟/进化），全部参数化 SVG，
 * 换美术只改本文件；老师上传的自定义图片优先级高于本库。
 * ============================================================ */
'use strict';

/* ---- 通用小部件 ---- */
function _eyes(x, y, r) {
    r = r || 4.5;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#2d3436"/><circle cx="${x + r * 0.4}" cy="${y - r * 0.4}" r="${r * 0.32}" fill="#fff"/>`;
}
function _blush(x, y) { return `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.6" fill="#ff9d9d" opacity=".6"/>`; }
function _smile(x, y, w) { return `<path d="M${x - w} ${y} Q${x} ${y + w * 0.9} ${x + w} ${y}" stroke="#2d3436" stroke-width="2.4" fill="none" stroke-linecap="round"/>`; }
function _crown(x, y, s) {
    s = s || 1;
    return `<g transform="translate(${x},${y}) scale(${s})"><polygon points="0,10 -11,-4 -4,2 0,-9 4,2 11,-4" fill="#ffd200" stroke="#e1a90f" stroke-width="1.6"/></g>`;
}
function _scarf(x, y, w, c) {
    return `<rect x="${x - w / 2}" y="${y}" width="${w}" height="9" rx="4.5" fill="${c || '#e84393'}"/><rect x="${x + w / 2 - 8}" y="${y + 7}" width="9" height="14" rx="4" fill="${c || '#e84393'}"/>`;
}
function _sparkles(x, y) {
    const s = [[-38, -6], [40, 2], [-30, 34], [34, 40]];
    return s.map(p => `<text x="${x + p[0]}" y="${y + p[1]}" font-size="13" fill="#ffeaa7">✦</text>`).join('');
}

/* ---- 蛋（stage 0），cracks: 裂纹数量 0~3（随经验增长） ---- */
function _egg(color, cracks, accent) {
    let cr = '';
    const paths = [
        'M60 46 l8 10 -7 6', 'M55 70 l-9 8 6 9', 'M70 88 l10 6 -3 10'
    ];
    for (let i = 0; i < (cracks || 0); i++) {
        cr += `<path d="${paths[i]}" stroke="#7a5a2a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="60" cy="66" rx="40" ry="48" fill="${color}" stroke="${accent}" stroke-width="3"/>
        <ellipse cx="60" cy="66" rx="40" ry="48" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="6 5"/>
        <ellipse cx="42" cy="42" rx="10" ry="14" fill="#fff" opacity=".55" transform="rotate(-18 42 42)"/>
        ${cr}
        <ellipse cx="60" cy="112" rx="30" ry="5" fill="rgba(0,0,0,.12)"/>
    </svg>`;
}

/* ---- 16 种宠物的身体画法（stage 1~3） ---- */
const _B = {
    duck: (c, a) => `
        <ellipse cx="60" cy="74" rx="34" ry="28" fill="${c}"/>
        <circle cx="60" cy="42" r="24" fill="${c}"/>
        <polygon points="60,42 88,48 60,54" fill="#ff9f43"/>
        ${_eyes(50, 38)}${_eyes(70, 38)}${_blush(40, 50)}${_blush(80, 50)}
        <path d="M52 74 Q60 82 68 74" stroke="#2d3436" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    fish: (c, a) => `
        <ellipse cx="56" cy="58" rx="34" ry="24" fill="${c}"/>
        <polygon points="88,58 108,42 104,58 108,74" fill="${a}"/>
        <polygon points="52,36 64,20 70,38" fill="${a}"/>
        ${_eyes(38, 54, 5)}${_blush(44, 66)}
        <path d="M60 52 Q70 58 60 66" stroke="${a}" stroke-width="3" fill="none"/>
        <circle cx="30" cy="50" r="3" fill="#fff" opacity=".6"/>`,
    octopus: (c, a) => `
        <path d="M28 62 Q28 26 60 26 Q92 26 92 62 L92 78 Q84 70 76 80 Q68 70 60 80 Q52 70 44 80 Q36 70 28 78 Z" fill="${c}"/>
        ${_eyes(46, 52)}${_eyes(74, 52)}${_blush(36, 64)}${_blush(84, 64)}${_smile(60, 64, 7)}`,
    star: (c, a) => `
        <polygon points="60,10 72,42 106,44 80,66 88,98 60,79 32,98 40,66 14,44 48,42"
            fill="${c}" stroke="${a}" stroke-width="3" stroke-linejoin="round"/>
        ${_eyes(48, 50)}${_eyes(72, 50)}${_blush(40, 62)}${_blush(80, 62)}${_smile(60, 64, 8)}`,
    spacedog: (c, a) => `
        <ellipse cx="60" cy="72" rx="32" ry="26" fill="${c}"/>
        <circle cx="60" cy="42" r="25" fill="${c}"/>
        <path d="M38 30 Q30 12 48 18 Z" fill="${a}"/><path d="M82 30 Q90 12 72 18 Z" fill="${a}"/>
        <ellipse cx="60" cy="50" rx="10" ry="7" fill="#fff"/><circle cx="60" cy="48" r="3.5" fill="#2d3436"/>
        ${_eyes(48, 38)}${_eyes(72, 38)}${_smile(60, 60, 6)}
        <rect x="34" y="86" width="52" height="10" rx="5" fill="#74b9ff"/>`,
    rocketcat: (c, a) => `
        <ellipse cx="60" cy="72" rx="32" ry="26" fill="${c}"/>
        <circle cx="60" cy="42" r="25" fill="${c}"/>
        <polygon points="38,28 34,6 54,20" fill="${a}"/><polygon points="82,28 86,6 66,20" fill="${a}"/>
        ${_eyes(48, 40)}${_eyes(72, 40)}
        <path d="M40 52 L34 48 M40 56 L33 55 M80 52 L86 48 M80 56 L87 55" stroke="#2d3436" stroke-width="1.8"/>
        ${_blush(42, 52)}${_blush(78, 52)}${_smile(60, 58, 6)}`,
    uforabbit: (c, a) => `
        <ellipse cx="60" cy="74" rx="32" ry="26" fill="${c}"/>
        <circle cx="60" cy="40" r="25" fill="${c}"/>
        <ellipse cx="44" cy="8" rx="8" ry="20" fill="${c}"/><ellipse cx="76" cy="8" rx="8" ry="20" fill="${c}"/>
        <ellipse cx="44" cy="8" rx="4" ry="14" fill="#ffb2b2"/><ellipse cx="76" cy="8" rx="4" ry="14" fill="#ffb2b2"/>
        ${_eyes(48, 38)}${_eyes(72, 38)}${_smile(60, 52, 5)}
        <ellipse cx="60" cy="66" rx="18" ry="12" fill="#fff" opacity=".35"/>`,
    stardragon: (c, a) => `
        <ellipse cx="60" cy="72" rx="32" ry="26" fill="${c}"/>
        <circle cx="60" cy="42" r="25" fill="${c}"/>
        <polygon points="46,20 40,2 56,14" fill="${a}"/><polygon points="74,20 80,2 64,14" fill="${a}"/>
        <path d="M92 66 Q112 58 108 40" stroke="${a}" stroke-width="8" fill="none" stroke-linecap="round"/>
        ${_eyes(48, 40)}${_eyes(72, 40)}${_blush(40, 54)}${_blush(80, 54)}${_smile(60, 58, 7)}`,
    bear: (c, a) => `
        <circle cx="34" cy="24" r="11" fill="${a}"/><circle cx="86" cy="24" r="11" fill="${a}"/>
        <ellipse cx="60" cy="72" rx="34" ry="28" fill="${c}"/>
        <circle cx="60" cy="42" r="26" fill="${c}"/>
        <ellipse cx="60" cy="50" rx="12" ry="9" fill="${a}"/><circle cx="60" cy="47" r="3.4" fill="#2d3436"/>
        ${_eyes(47, 38)}${_eyes(73, 38)}${_smile(60, 60, 6)}`,
    fox: (c, a) => `
        <ellipse cx="60" cy="72" rx="32" ry="26" fill="${c}"/>
        <circle cx="60" cy="42" r="25" fill="${c}"/>
        <polygon points="38,30 32,4 56,20" fill="${c}"/><polygon points="82,30 88,4 64,20" fill="${c}"/>
        <polygon points="38,28 34,8 52,20" fill="#fff"/><polygon points="82,28 86,8 68,20" fill="#fff"/>
        <ellipse cx="60" cy="50" rx="13" ry="10" fill="#fff"/>
        ${_eyes(48, 38)}${_eyes(72, 38)}<circle cx="60" cy="48" r="3.2" fill="#2d3436"/>${_smile(60, 56, 5)}`,
    mushroom: (c, a) => `
        <rect x="44" y="52" width="32" height="34" rx="12" fill="#fff7e6"/>
        <path d="M18 56 Q18 18 60 18 Q102 18 102 56 Z" fill="${c}"/>
        <circle cx="38" cy="38" r="8" fill="#fff"/><circle cx="66" cy="30" r="10" fill="#fff"/><circle cx="88" cy="42" r="7" fill="#fff"/>
        ${_eyes(52, 66)}${_eyes(70, 66)}${_blush(42, 76)}${_blush(80, 76)}${_smile(61, 74, 6)}`,
    woodpecker: (c, a) => `
        <ellipse cx="58" cy="72" rx="30" ry="26" fill="${c}"/>
        <circle cx="60" cy="42" r="24" fill="${c}"/>
        <path d="M34 26 Q44 4 62 12 L54 24Z" fill="${a}"/>
        <polygon points="84,40 110,46 84,52" fill="#ff9f43"/>
        <ellipse cx="52" cy="52" rx="8" ry="6" fill="#fff"/><circle cx="54" cy="52" r="3.4" fill="#2d3436"/>
        ${_eyes(70, 40, 4.2)}${_blush(48, 64)}${_blush(74, 62)}`,
    candy: (c, a) => `
        <circle cx="60" cy="52" r="30" fill="${c}"/>
        <path d="M32 40 Q10 30 14 18 Q26 22 34 32Z" fill="${a}"/>
        <path d="M88 40 Q110 30 106 18 Q94 22 86 32Z" fill="${a}"/>
        <path d="M36 64 Q60 76 84 64" stroke="${a}" stroke-width="4" fill="none"/>
        <circle cx="48" cy="46" r="5" fill="#fff" opacity=".7"/>
        ${_eyes(48, 52)}${_eyes(72, 52)}${_smile(60, 62, 7)}`,
    lollipop: (c, a) => `
        <rect x="55" y="58" width="10" height="52" rx="5" fill="#fff" stroke="#dfe6e9" stroke-width="2"/>
        <circle cx="60" cy="44" r="32" fill="${c}"/>
        <path d="M60 44 m-32 0 a32 32 0 0 1 22 -30 M60 44 m-22 30 a32 32 0 0 1 -10 -12"
            stroke="${a}" stroke-width="7" fill="none" stroke-linecap="round"/>
        ${_eyes(50, 40)}${_eyes(70, 40)}${_blush(40, 52)}${_blush(80, 52)}${_smile(60, 54, 7)}`,
    marsh: (c, a) => `
        <rect x="28" y="28" width="64" height="56" rx="20" fill="${c}"/>
        <rect x="28" y="28" width="64" height="18" rx="9" fill="#fff" opacity=".45"/>
        ${_eyes(48, 52)}${_eyes(72, 52)}${_blush(38, 64)}${_blush(82, 64)}${_smile(60, 62, 7)}
        <path d="M40 16 Q44 6 50 12 M76 14 Q80 4 86 10" stroke="${a}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    pudding: (c, a) => `
        <path d="M24 58 Q24 26 60 26 Q96 26 96 58 L96 66 L24 66Z" fill="${c}"/>
        <ellipse cx="60" cy="66" rx="38" ry="9" fill="#fff" opacity=".4"/>
        <path d="M40 30 Q52 16 68 26 Q58 30 40 30Z" fill="${a}"/>
        ${_eyes(48, 46)}${_eyes(72, 46)}${_blush(38, 56)}${_blush(82, 56)}${_smile(60, 56, 6)}
        <rect x="20" y="66" width="80" height="12" rx="6" fill="#ffeaa7"/>`,
};

/* ---- 物种注册表（id / 名称 / 主色 / 副色） ---- */
const SPECIES = {
    /* 🌊 海洋乐园 */
    duck:       { name: '小鸭',   c: '#ffe08a', a: '#e6a817' },
    fish:       { name: '小鱼',   c: '#74b9ff', a: '#2f7fd4' },
    octopus:    { name: '章鱼',   c: '#ff9dd3', a: '#e84393' },
    star:       { name: '海星',   c: '#ffbe76', a: '#e67e22' },
    /* 🚀 太空冒险 */
    spacedog:   { name: '太空犬', c: '#dfe6e9', a: '#636e72' },
    rocketcat:  { name: '火箭猫', c: '#a29bfe', a: '#6c5ce7' },
    uforabbit:  { name: 'UFO兔', c: '#f3f6fb', a: '#dfe6e9' },
    stardragon: { name: '星龙',   c: '#55efc4', a: '#00b894' },
    /* 🌲 森林派对 */
    bear:       { name: '小熊',   c: '#c98d5f', a: '#8d5524' },
    fox:        { name: '狐狸',   c: '#ff9f43', a: '#e67e22' },
    mushroom:   { name: '蘑菇精', c: '#ff7675', a: '#d63031' },
    woodpecker: { name: '啄木鸟', c: '#4a9eff', a: '#2c5fd4' },
    /* 🍬 糖果王国 */
    candy:      { name: '糖果兽', c: '#ff9dd3', a: '#e84393' },
    lollipop:   { name: '棒棒糖精灵', c: '#55efc4', a: '#00b894' },
    marsh:      { name: '棉花糖云', c: '#ffeaa7', a: '#fdcb6e' },
    pudding:    { name: '布丁',   c: '#ffd200', a: '#e17055' },
};

/* ---- 形态参数：尺寸缩放 + 配饰 ---- */
const STAGE_CFG = [
    null,                                             // 0=蛋（单独处理）
    { s: 0.72, acc: null },                           // 幼年
    { s: 0.92, acc: (x, y) => _scarf(x, y, 44) },     // 成熟：围巾
    { s: 1.02, acc: (x, y) => _crown(x, y, 1.15) + _sparkles(x, y) },  // 进化：皇冠+星光
];

/* ---- 主入口：petSVG(petId, stage, opts) ----
   opts.cracks：蛋期裂纹数 0~3；opts.color/accent：临时覆盖配色 */
function petSVG(petId, stage, opts) {
    opts = opts || {};
    const sp = SPECIES[petId] || SPECIES.duck;
    const c = opts.color || sp.c, a = opts.accent || sp.a;
    if (stage <= 0) return _egg(c, opts.cracks || 0, a);
    const cfg = STAGE_CFG[Math.min(stage, 3)];
    const s = cfg.s;
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(${60 - 60 * s},${120 - 120 * s}) scale(${s})">
            ${_B[petId] ? _B[petId](c, a) : _B.duck(c, a)}
            ${cfg.acc ? cfg.acc(60, 62) : ''}
        </g>
    </svg>`;
}

/* 主题宠物渲染：有自定义图片用图片，否则用内置 SVG */
function renderPet(theme, petDef, stage, opts) {
    const path = petDef && petDef.stages && petDef.stages[stage];
    if (path) return `<img src="/themes/${encodeURIComponent(theme.name)}/${path}" style="width:100%;height:100%;object-fit:contain">`;
    return petSVG(petDef ? petDef.id : 'duck', stage, opts);
}
