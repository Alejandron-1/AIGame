/* ============================================================
 * 认识立体图形互动课件 · 内置物品素材库
 * drawItem(id)          → 单件物品 SVG（观察发现/分类/PK 用）
 * shapeModelSVG(shape)  → 四种形状的模型小卡（分类命名用）
 * drawPart(shape)       → 拼搭零件（圆柱腿/长方体腿）
 * 想换美术风格，改本文件即可。
 * ============================================================ */
'use strict';

/* ---- 立体图形通用画法 ---- */
function _isoBox(front, top, side, w, h, d) {
    w = w || 70; h = h || 46; d = d || 22;
    const x0 = (120 - w) / 2, y0 = (100 - h - d) / 2 + d / 2;
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${x0},${y0} ${x0 + w},${y0} ${x0 + w + d * 0.8},${y0 - d} ${x0 - d * 0.8 + w - w},${y0 - d}" fill="${top}" opacity=".95"/>
        <polygon points="${x0},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0},${y0 + h}" fill="${front}"/>
        <polygon points="${x0 + w},${y0} ${x0 + w + d * 0.8},${y0 - d} ${x0 + w + d * 0.8},${y0 - d + h} ${x0 + w},${y0 + h}" fill="${front}" opacity=".7"/>
        <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="2"/>
    </svg>`;
}
function _cylBody(c1, c2, topScale) {
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 24 L32 72 Q32 84 60 84 Q88 84 88 72 L88 24Z" fill="${c1}"/>
        <ellipse cx="60" cy="24" rx="28" ry="${9 * (topScale || 1)}" fill="${c2}"/>
        <ellipse cx="60" cy="24" rx="28" ry="${9 * (topScale || 1)}" fill="#fff" opacity=".25"/>
        <path d="M40 30 L40 74" stroke="#fff" opacity=".35" stroke-width="5" stroke-linecap="round"/>
    </svg>`;
}
function _ballBody(c, c2, deco) {
    return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="50" r="38" fill="${c}"/>
        ${deco || ''}
        <ellipse cx="46" cy="34" rx="12" ry="8" fill="#fff" opacity=".5"/>
        <circle cx="60" cy="50" r="38" fill="none" stroke="${c2}" stroke-width="2.5"/>
    </svg>`;
}

/* ---- 单件物品 ---- */
function drawItem(id) {
    switch (id) {
        case 'ball_bk': return _ballBody('#f0932b', '#c8760c',
            `<path d="M22 50 Q60 74 98 50" stroke="#5b3a0e" stroke-width="3" fill="none"/>
             <path d="M22 50 Q60 26 98 50" stroke="#5b3a0e" stroke-width="3" fill="none"/>
             <line x1="60" y1="12" x2="60" y2="88" stroke="#5b3a0e" stroke-width="3"/>`);
        case 'ball_soc': return _ballBody('#f5f6fa', '#636e72',
            `<polygon points="60,34 72,44 68,58 52,58 48,44" fill="#2d3436"/>
             <path d="M60 34 L60 12 M72 44 L92 38 M68 58 L82 74 M52 58 L38 74 M48 44 L28 38"
                stroke="#2d3436" stroke-width="2.5"/>`);
        case 'ball_sm': return _ballBody('#fd79a8', '#e84393',
            `<path d="M22 50 Q60 66 98 50" stroke="#e84393" stroke-width="4" fill="none"/>`);
        case 'cube_mf': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="24" y="20" width="72" height="60" rx="8" fill="#2d3436"/>
            ${[0,1,2].map(r => [0,1,2].map(c =>
                `<rect x="${30 + c * 22}" y="${26 + r * 18}" width="18" height="14" rx="3"
                 fill="${['#e84393', '#00b894', '#f39c12', '#0984e3', '#d63031', '#ffd200', '#55efc4', '#a29bfe', '#ff9f43'][(r*3+c)]}"/>`).join('')).join('')}
        </svg>`;
        case 'cube_y': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="26" y="18" width="68" height="64" rx="6" fill="#ffd200" stroke="#d9ad00" stroke-width="3"/>
            <circle cx="44" cy="30" r="6" fill="#d9ad00"/><circle cx="60" cy="30" r="6" fill="#d9ad00"/><circle cx="76" cy="30" r="6" fill="#d9ad00"/>
            <rect x="26" y="18" width="68" height="64" rx="6" fill="none" stroke="#d9ad00" stroke-width="2" opacity=".5"/>
        </svg>`;
        case 'cube_box': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="22" y="16" width="76" height="68" rx="4" fill="#c8956a" stroke="#8d6035" stroke-width="4"/>
            <path d="M22 16 L98 84 M98 16 L22 84" stroke="#8d6035" stroke-width="5"/>
            <rect x="18" y="12" width="84" height="12" rx="3" fill="#a8763f"/>
        </svg>`;
        case 'cyl_bat': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="14" width="40" height="76" rx="9" fill="#f0932b" stroke="#c8760c" stroke-width="3"/>
            <rect x="40" y="34" width="40" height="26" fill="#fff"/>
            <text x="60" y="53" text-anchor="middle" font-size="15" font-weight="900" fill="#e67e22" font-family="Microsoft YaHei">+</text>
            <rect x="48" y="8" width="24" height="8" rx="3" fill="#c8760c"/>
        </svg>`;
        case 'cyl_cup': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="42" y="10" width="36" height="82" rx="10" fill="#a55eea" stroke="#8d44ad" stroke-width="3"/>
            <rect x="42" y="10" width="36" height="18" rx="8" fill="#6c5ce7"/>
            <path d="M78 30 Q96 34 92 52" stroke="#8d44ad" stroke-width="6" fill="none"/>
            <ellipse cx="52" cy="20" rx="7" ry="4" fill="#fff" opacity=".4"/>
        </svg>`;
        case 'cyl_can': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="36" y="18" width="48" height="68" rx="6" fill="#dfe6e9" stroke="#b2bec3" stroke-width="3"/>
            <rect x="36" y="36" width="48" height="30" fill="#ff9f43"/>
            <ellipse cx="60" cy="18" rx="24" ry="7" fill="#dfe6e9" stroke="#b2bec3" stroke-width="3"/>
            <text x="60" y="56" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="Microsoft YaHei">罐头</text>
        </svg>`;
        case 'cub_yg': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="26" width="60" height="52" rx="6" fill="#74b9ff" stroke="#2f7fd4" stroke-width="3"/>
            <rect x="72" y="30" width="12" height="14" rx="4" fill="#2f7fd4"/>
            <text x="52" y="58" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="Microsoft YaHei">牙膏</text>
        </svg>`;
        case 'cub_board': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="38" width="100" height="24" rx="4" fill="#c8956a" stroke="#8d6035" stroke-width="3"/>
            <line x1="16" y1="50" x2="104" y2="50" stroke="#8d6035" stroke-width="2" opacity=".5"/>
        </svg>`;
        case 'cub_soap': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="26" y="36" width="68" height="34" rx="12" fill="#fd79a8" stroke="#e84393" stroke-width="3"/>
            <rect x="34" y="42" width="52" height="6" rx="3" fill="#e84393" opacity=".5"/>
            <rect x="34" y="52" width="52" height="6" rx="3" fill="#e84393" opacity=".5"/>
        </svg>`;
        case 'cub_milk': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M38 24 L60 10 L82 24 L82 82 Q60 90 38 82Z" fill="#e8f4fd" stroke="#74b9ff" stroke-width="3"/>
            <path d="M60 10 L82 24 L82 82 Q60 90 60 82Z" fill="#d6ecfa"/>
            <text x="60" y="56" text-anchor="middle" font-size="15" font-weight="900" fill="#0984e3" font-family="Microsoft YaHei">牛奶</text>
        </svg>`;
        case 'cub_gear': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="26" y="22" width="68" height="58" rx="6" fill="#74b9ff" stroke="#2f7fd4" stroke-width="3"/>
            <circle cx="60" cy="51" r="15" fill="#2f7fd4"/>
            <circle cx="60" cy="51" r="6" fill="#fff"/>
            ${[0,60,120,180,240,300].map(a => `<rect x="58" y="30" width="4" height="8" fill="#2f7fd4" transform="rotate(${a} 60 51)"/>`).join('')}
        </svg>`;
        case 'cub_pen': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="40" width="92" height="30" rx="8" fill="#00b894" stroke="#00826a" stroke-width="3"/>
            <rect x="14" y="40" width="92" height="12" rx="6" fill="#fff" opacity=".3"/>
            <rect x="96" y="46" width="8" height="8" rx="2" fill="#00826a"/>
        </svg>`;
        case 'other_cone': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,42 84,88 36,88" fill="#e8c39e" stroke="#c89a6a" stroke-width="2.5"/>
            <circle cx="60" cy="34" r="20" fill="#fd79a8"/>
            <circle cx="60" cy="18" r="4.5" fill="#d63031"/>
            <path d="M52 30 Q60 40 68 30" stroke="#fff" stroke-width="2.5" fill="none" opacity=".5"/>
        </svg>`;
        case 'other_prism': return `<svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,14 96,72 24,72" fill="#a29bfe" stroke="#6c5ce7" stroke-width="3" stroke-linejoin="round"/>
            <polygon points="60,14 96,72 60,72" fill="#8d7ae6"/>
        </svg>`;
        case 'plank': case 'plank_cart': return `<svg viewBox="0 0 220 80" xmlns="http://www.w3.org/2000/svg">
            <rect x="16" y="14" width="188" height="44" rx="8" fill="#c8a06a" stroke="#9a7440" stroke-width="4"/>
            <rect x="16" y="14" width="188" height="14" rx="7" fill="#e0bd85"/>
            <line x1="30" y1="46" x2="190" y2="46" stroke="#9a7440" stroke-width="2" opacity=".4"/>
        </svg>`;
        default: return `<svg viewBox="0 0 120 100"><circle cx="60" cy="50" r="30" fill="#ddd"/></svg>`;
    }
}

/* ---- 四种形状模型小卡 ---- */
function shapeModelSVG(shape) {
    switch (shape) {
        case 'ball': return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="20" r="15" fill="#ff9dd3" stroke="#e84393" stroke-width="2.5"/><ellipse cx="25" cy="14" rx="5" ry="3.5" fill="#fff" opacity=".6"/></svg>`;
        case 'cube': return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><polygon points="16,12 36,12 46,4 26,4" fill="#b29bfe"/><polygon points="16,12 16,34 36,34 36,12" fill="#a29bfe"/><polygon points="36,12 46,4 46,26 36,34" fill="#8d7ae6"/></svg>`;
        case 'cuboid': return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><polygon points="10,12 40,12 52,4 22,4" fill="#a8d8ff"/><polygon points="10,12 10,34 40,34 40,12" fill="#74b9ff"/><polygon points="40,12 52,4 52,26 40,34" fill="#5aa8e8"/></svg>`;
        case 'cyl': return `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg"><path d="M18 8 L18 30 Q18 36 30 36 Q42 36 42 30 L42 8Z" fill="#fdcb6e"/><ellipse cx="30" cy="8" rx="12" ry="4.5" fill="#ffeaa7" stroke="#e1a90f" stroke-width="2"/></svg>`;
        default: return `<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="14" fill="#ddd"/></svg>`;
    }
}

/* ---- 拼搭零件 ---- */
function drawPart(shape) {
    if (shape === 'cyl') return `<svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 10 L12 74 Q12 84 30 84 Q48 84 48 74 L48 10Z" fill="#f5a623" stroke="#d99114" stroke-width="3"/>
        <ellipse cx="30" cy="10" rx="18" ry="7" fill="#ffd200"/>
        <ellipse cx="30" cy="10" rx="18" ry="7" fill="#fff" opacity=".25"/>
        <path d="M18 16 L18 72" stroke="#fff" opacity=".4" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
    /* cuboid 竖长方体腿 */
    return `<svg viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="6" width="40" height="78" rx="7" fill="#74b9ff" stroke="#2f7fd4" stroke-width="3"/>
        <rect x="14" y="10" width="12" height="70" rx="6" fill="#fff" opacity=".35"/>
        <rect x="10" y="6" width="40" height="78" rx="7" fill="none" stroke="#2f7fd4" stroke-width="2" opacity=".5"/>
    </svg>`;
}
