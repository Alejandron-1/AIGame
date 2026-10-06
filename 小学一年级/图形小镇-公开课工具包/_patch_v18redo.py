# -*- coding: utf-8 -*-
"""V1.8 第一批重打：删环节 + 游戏1四分区 + 名牌页 + 3D强化（锚点针对当前模板）"""
import io

p = r'C:/Users/aa109/Desktop/AIGame/小学一年级/图形小镇-公开课工具包/课件模板.html'
h = io.open(p, encoding='utf-8').read()

# ============ ① 删除「怎么分 才好呢」环节 ============
i0 = h.index('/* ================= 分一分引入（课本 P5-8） ================= */')
i1 = h.index('/* ================= 游戏1 认识小伙伴')
h = h[:i0] + h[i1:]
print('① 删除分一分引入 OK')

# ============ ② 游戏1 四分区 ============
old = '<div class="g1stage gridfloor card" id="g1stage"></div>'
new = '<div class="g1stage gridfloor card" id="g1stage"></div>'
h = h.replace(old, new)  # 分区容器在 reset 里动态建

old = """        const g1layout = () => {   /* 自适应网格：宽屏 8×2，窄屏 4×4 */
            if (!stage.clientWidth) return;
            const cols = stage.clientWidth > 700 ? 8 : 4;
            const rows = Math.ceil(G1_ITEMS.length / cols);
            itemEls.forEach((d, i) => {
                const col = i % cols, row = Math.floor(i / cols);
                d.style.left = ((col + 0.5) * 100/cols) + '%';
                d.style.top  = ((row + 0.52) * 100/rows) + '%';
            });
        };"""
new = """        const g1layout = () => {   /* 每个形状住自己的分区：区内小网格 */
            if (!stage.clientWidth) return;
            const order = ['cuboid','cube','cyl','ball'];
            order.forEach((s, z) => {
                const els = itemEls.map((d, i) => ({ d, s: G1_ITEMS[i][1] }))
                    .filter(o => o.s === s && !o.d.classList.contains('gone'));
                const n = els.length; if (!n) return;
                const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
                els.forEach((o, k) => {
                    const col = k % cols, row = Math.floor(k / cols);
                    o.d.style.left = ((z + (col + 0.5)/cols) * 25) + '%';
                    o.d.style.top  = ((row + 0.5) * 100/rows) + '%';
                });
            });
        };"""
assert old in h, 'g1layout'
h = h.replace(old, new)

old = """        const reset = () => {
            stage.innerHTML = '';
            el.querySelector('#g1next').style.display = 'none';
            shapesBy = { cuboid:[], cube:[], cyl:[], ball:[] };
            mergedBy = {};
            itemEls = [];"""
new = """        const reset = () => {
            stage.innerHTML = '';
            el.querySelector('#g1next').style.display = 'none';
            shapesBy = { cuboid:[], cube:[], cyl:[], ball:[] };
            mergedBy = {};
            itemEls = [];
            /* 底层四分区（有边框），各住一种图形 */
            const zones = document.createElement('div');
            zones.id = 'g1zones'; zones.style.cssText = 'position:absolute;inset:0';
            stage.appendChild(zones);
            zones.innerHTML = [['cuboid','#fdf1e3','#f0c9a0'],['cube','#eef5fd','#b7d4f0'],
                ['cyl','#eaf7f1','#a8dcbf'],['ball','#fdeef2','#f3c3d0']].map(([s, bg, bd], z) =>
                `<div class="g1zone" id="g1z${s}" data-shape="${s}" style="left:calc(${z*25}% + 5px);width:calc(25% - 10px);background:${bg};border-color:${bd}">
                    <span class="zn"></span></div>`).join('');"""
assert old in h, 'reset zones'
h = h.replace(old, new)

old = """                /* 该组合体完成：原实物位置（含绿勾）淡出消失 */
                G1_ITEMS.forEach((it, i) => {
                    if (it[1] === shape) itemEls[i].classList.add('gone');
                });"""
new = """                /* 该组合体完成：原实物位置（含绿勾）淡出消失；分区标记形状名 */
                G1_ITEMS.forEach((it, i) => {
                    if (it[1] === shape) itemEls[i].classList.add('gone');
                });
                const zn = document.querySelector('#g1z' + shape + ' .zn');
                if (zn) { zn.textContent = SHAPES[shape].name; document.querySelector('#g1z' + shape).classList.add('named'); }"""
assert old in h, 'zone name'
h = h.replace(old, new)

old = """            ['cuboid','cube','cyl','ball'].forEach((s, i) => {
                const e = shapesBy[s][0];
                setTimeout(() => {
                    e.style.left = (17 + i*22) + '%';
                    e.style.top = '46%';
                }, i*280);
            });"""
new = """            ['cuboid','cube','cyl','ball'].forEach((s, i) => {
                const e = shapesBy[s][0];
                setTimeout(() => {
                    e.style.left = ((i + 0.5) * 25) + '%';
                    e.style.top = '46%';
                }, i*280);
            });"""
assert old in h, 'finale pos'
h = h.replace(old, new)

# 分区 CSS（挂在 g1item.gone 之后）
old = ".g1item.gone { opacity:0; pointer-events:none; }"
new = """.g1item.gone { opacity:0; pointer-events:none; }
.g1zone { position:absolute; top:8px; bottom:8px; border:2.5px dashed; border-radius:16px; }
.g1zone .zn { position:absolute; bottom:6px; left:50%; transform:translateX(-50%);
    font-size:14px; font-weight:900; background:#fff; border:2.5px solid var(--line);
    border-radius:999px; padding:2px 14px; opacity:0; transition:opacity .4s; }
.g1zone.named .zn { opacity:1; }"""
assert old in h, 'zone css'
h = h.replace(old, new)

# ============ ③ 名牌页 ============
old = """const NAMECARDS = [
    ['cuboid','长长方方','6 个平平的面，相对的两个面一样大'],
    ['cube','正正方方','6 个平平的面，6 个面一样大'],
    ['cyl','直直的','上下一样粗，两头圆圆的、平平的'],
    ['ball','圆圆鼓鼓','没有平平的面，可以到处滚动']
];
regSlide({
    id:'namecards', title:'图形名片',
    html: () => `
        <div class="htitle">四位图形 <em>小伙伴</em></div>
        <div class="hsub">点一点名片，听它们自我介绍</div>
        <div class="namegrid">${NAMECARDS.map(([s],i)=>`
            <div class="namecard card" data-s="${s}">${shapeSVG(s,120,{uid:'nc'+i})}<div class="nm ${SHAPES[s].tag==='t-cuboid'?'':''}">${SHAPES[s].name}</div>
            <div class="ft"></div></div>`).join('')}
        </div>`,
    init(el) {
        el.querySelectorAll('.namecard').forEach(c => {
            c.onclick = () => {
                SND.pop(); c.querySelector('.ft').textContent = NAMECARDS.find(x=>x[0]===c.dataset.s)[2];
                c.classList.remove('jiggle'); void c.offsetWidth; c.classList.add('jiggle');
            };
        });
    }
});"""
new = """regSlide({
    id:'namecards', title:'图形名片',
    html: () => `
        <div class="htitle">四位图形 <em>小伙伴</em></div>
        <div class="hsub">点一点名片，看看它是谁</div>
        <div class="namegrid">${['cuboid','cube','cyl','ball'].map((s,i)=>`
            <div class="namecard card" data-s="${s}">${shapeSVG(s,150,{uid:'nc'+i})}<div class="nm"></div></div>`).join('')}
        </div>`,
    init(el) {
        el.querySelectorAll('.namecard').forEach(c => {
            c.onclick = () => {
                const nm = c.querySelector('.nm');
                if (nm.textContent) { SND.click(); return; }
                SND.pop();
                nm.innerHTML = `<span class="pill" style="background:var(--${c.dataset.s});color:#fff">${SHAPES[c.dataset.s].name}</span>`;
                c.classList.remove('jiggle'); void c.offsetWidth; c.classList.add('jiggle');
            };
        });
    }
});"""
assert old in h, 'namecards'
h = h.replace(old, new)

old = ".namecard { width:clamp(150px,17vw,230px); padding:18px 12px 14px; text-align:center; cursor:pointer; transition:transform .18s; }"
new = """.namecard { width:clamp(170px,19vw,260px); padding:20px 12px 16px; text-align:center; cursor:pointer; transition:transform .18s; }
.namecard svg { width:clamp(120px,13vw,175px); height:auto; }
.namecard .nm { min-height:48px; display:flex; align-items:center; justify-content:center; }"""
assert old in h, 'namecard css'
h = h.replace(old, new)
print('③ 名牌页 OK')

# ============ ④ 3D 强化 ============
old = "            if (!this.rolling && !this.dragging && !this.counting) this.rotY += .0028;"
new = "            if (!this.still && !this.rolling && !this.dragging && !this.counting) this.rotY += .0012;   /* 自转变慢 */"
assert old in h, 'rot speed'
h = h.replace(old, new)

old = """    pairs() {
        if (this.counting || this.rolling || !this.pairDefs) return;"""
new = """    pairs() {
        if (this.counting || this.rolling || !this.pairDefs) return;
        this.still = true;   /* 看相对的面时要停稳 */
        this.rotX = .2; this.rotY = .55;"""
assert old in h, 'pairs still'
h = h.replace(old, new)

old = "            st.m.forEach(m => m.color.setHex(0xfff1bf));"
new = "            st.m.forEach(m => m.color.setHex(0xff5252));   /* 当前面对比强烈 */"
assert old in h, 'flash color'
h = h.replace(old, new)

old = """.v3dnum { position:absolute; top:12px; left:12px; min-width:44px; text-align:center; background:var(--gold); border:3px solid var(--line);
    border-radius:12px; font-weight:900; font-size:26px; padding:2px 10px; z-index:3; }"""
new = """.v3dnum { position:absolute; top:12px; left:12px; min-width:64px; text-align:center; background:var(--gold); border:3.5px solid var(--line);
    border-radius:16px; font-weight:900; font-size:44px; padding:4px 16px; z-index:3; }"""
assert old in h, 'num css'
h = h.replace(old, new)
print('④ 3D 强化 OK')

io.open(p, 'w', encoding='utf-8').write(h)
print('V1.8 第一批重打完成，模板大小', len(h))
