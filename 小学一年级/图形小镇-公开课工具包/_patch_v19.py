# -*- coding: utf-8 -*-
"""V1.9：五项反馈——同时变身 / 相对面逐步染色(全图形) / 找朋友式分一分 / 课本式数一数 / 删小镇落成"""
import io

p = r'C:/Users/aa109/Desktop/AIGame/小学一年级/图形小镇-公开课工具包/课件模板.html'
h = io.open(p, encoding='utf-8').read()
sp = h.index('<script>')   # JS 区起点（防 CSS/JS 同名注释）

# ============ ① 游戏1：同类同时变身（去掉依次错峰） ============
old = """                    let k = 0;
                    G1_ITEMS.forEach(([img2, s2], j) => {
                        if (s2 !== shape || j === i) return;
                        const mate = itemEls[j];
                        if (mate.classList.contains('done')) return;
                        setTimeout(() => transformOne(j), 460 + k*380);
                        k++;
                    });"""
new = """                    G1_ITEMS.forEach(([img2, s2], j) => {
                        if (s2 !== shape || j === i) return;
                        const mate = itemEls[j];
                        if (mate.classList.contains('done')) return;
                        setTimeout(() => transformOne(j), 430);   /* 同类一齐变身 */
                    });"""
assert old in h, 'game1 simultaneous'
h = h.replace(old, new)
print('① 同类同时变身 OK')

# ============ ② 相对的面：逐步染色（一次一对），并配对颜色 ============
old = """            this.pairDefs = [[4,5,'前面和后面是一对，一模一样大！'],[1,0,'左面和右面是一对，一模一样大！'],[2,3,'上面和下面是一对，一模一样大！']];"""
new = """            this.pairDefs = [[4,5,'前面和后面是一对，一模一样大！',0xff5252],[1,0,'左面和右面是一对，一模一样大！',0xffd600],[2,3,'上面和下面是一对，一模一样大！',0x9c6ade]];"""
assert old in h, 'cuboid pairDefs'
h = h.replace(old, new)

old = """                { i:[3], no:'6', tip:'下面 —— 6 个面都一样大！', rx:-1.18, ry:0 } ];"""
new = """                { i:[3], no:'6', tip:'下面 —— 6 个面都一样大！', rx:-1.18, ry:0 } ];
            this.pairDefs = [[4,5,'前面和后面是一对（一样大）！',0xff5252],[1,0,'左面和右面是一对（一样大）！',0xffd600],[2,3,'上面和下面是一对（一样大）！',0x9c6ade]];"""
assert old in h, 'cube pairDefs'
h = h.replace(old, new)

old = """                { i:[0], no:'', tip:'侧面弯弯的，不是平面哦', rx:.2, ry:.6 } ];"""
new = """                { i:[0], no:'', tip:'侧面弯弯的，不是平面哦', rx:.2, ry:.6 } ];
            this.pairDefs = [[1,2,'上面和下面是一对，一样大！',0xff5252]];"""
assert old in h, 'cyl pairDefs'
h = h.replace(old, new)

old = """    pairs() {
        if (this.counting || this.rolling || !this.pairDefs) return;
        this.still = true;   /* 看相对的面时要停稳 */
        this.rotX = .2; this.rotY = .55;
        this.flash(this.pairDefs.map(pr => ({ m: [this.mats[pr[0]], this.mats[pr[1]]], no: '', tip: pr[2] })));
    }"""
new = """    pairs() {
        if (this.counting || this.rolling || !this.pairDefs) return;
        this.still = true;   /* 看相对的面时要停稳 */
        this.rotX = .2; this.rotY = .55;
        const num = this.box.querySelector('.v3dnum'), tip = this.box.querySelector('.v3dtip');
        if (this.pairStep === undefined) this.pairStep = 0;
        if (this.pairStep >= this.pairDefs.length) {   /* 涂满一轮后再点 → 复位重来 */
            this.mats.forEach(m => m.color.setHex(m.userData.base));
            this.pairStep = 0; num.textContent = ''; tip.textContent = '再点一次，重新涂一对';
            SND.click(); return;
        }
        const pr = this.pairDefs[this.pairStep];
        [this.mats[pr[0]], this.mats[pr[1]]].forEach(m => m.color.setHex(pr[3]));
        num.textContent = this.shape === 'cyl' ? '1 对' : (this.pairStep + 1) + ' 对';
        tip.textContent = pr[2]; SND.good();
        this.pairStep++;
        if (this.pairStep >= this.pairDefs.length) {
            setTimeout(() => { if (!this.stop) {
                num.textContent = this.shape === 'cyl' ? '' : '6 个面';
                tip.textContent = this.shape === 'cyl' ? '圆柱这一对相对的面，一样大！' : '6 个面正好配成 3 对，相对的面一样大！';
            } }, 1500);
        }
    }"""
assert old in h, 'pairs stepwise'
h = h.replace(old, new)

# 正方体/圆柱补「相对的面」按钮
old = """              SND.good(); toast('一共 6 个面！你看，全都是一样大的正方形～', 3000); } }
    ]"""
new = """              SND.good(); toast('一共 6 个面！你看，全都是一样大的正方形～', 3000); } },
        { t:'🤝 相对的面', fn:'pairs',
          fb: () => toast('正方体：前面和后面、左面和右面、上面和下面，三对相对的面！', 3000) }"""
assert old in h, 'cube vbtns'
h = h.replace(old, new)

old = """    vbtns:[ { t:'🖐 数一数平平的面', fn:'count',
        fb: () => toast('圆柱两头各有一个平平的圆面，一共 2 个！侧面弯弯的～', 3000) } ],"""
new = """    vbtns:[ { t:'🖐 数一数平平的面', fn:'count',
        fb: () => toast('圆柱两头各有一个平平的圆面，一共 2 个！侧面弯弯的～', 3000) },
        { t:'🤝 相对的面', fn:'pairs',
          fb: () => toast('圆柱上面和下面是一对相对的面，一样大！', 3000) } ],"""
assert old in h, 'cyl vbtns'
h = h.replace(old, new)
print('② 相对的面 逐步染色 + 全图形 OK')

# ============ ③ 游戏3 改「找朋友」形式：上物品 下图形目标 ============
old = """        <div class="g3top">${['cuboid','cube','cyl','ball'].map(s=>`
            <div class="home card" data-shape="${s}">
                <div class="hh" style="background:var(--${s})">${shapeSVG(s,26,{face:false})}<span>${SHAPES[s].name}的家</span></div>
                <div class="hz" style="background:${{cuboid:'#fdf1e3',cube:'#eef5fd',cyl:'#eaf7f1',ball:'#fdeef2'}[s]}"></div>
            </div>`).join('')}
        </div>"""
new = """        <div class="g3top">${['cuboid','cube','cyl','ball'].map(s=>`
            <div class="home" data-shape="${s}">
                ${shapeSVG(s,150,{uid:'ft'+s})}
                <div class="hz"></div>
            </div>`).join('')}
        </div>"""
assert old in h, 'g3 html'
h = h.replace(old, new)

old = """.home { flex:1 1 0; min-width:0; border-radius:20px; overflow:hidden; padding:0; position:relative; transition:transform .18s, box-shadow .18s; }
.home .hh { display:flex; align-items:center; gap:10px; padding:11px 16px; color:#fff; font-weight:900;
    font-size:clamp(17px,2vw,23px); }
.home .hh svg { width:34px; height:34px; flex:0 0 34px; }
.home .hz { min-height:118px; border-top:2.5px dashed rgba(63,58,52,.16); display:flex; align-items:flex-end;
    justify-content:center; gap:6px; padding:10px 8px 12px; overflow:hidden; flex-wrap:wrap; transition:all .2s; }
.home.hot { transform:scale(1.05); box-shadow:0 12px 26px rgba(240,131,31,.35); z-index:3; }"""
new = """.home { flex:1 1 0; min-width:0; text-align:center; position:relative; transition:transform .18s; }
.home > svg { width:clamp(110px,12vw,170px); height:auto; transition:transform .18s, filter .18s; }
.home .hz { min-height:46px; display:flex; align-items:center; justify-content:center; gap:6px;
    flex-wrap:wrap; transition:all .2s; }
.home.hot { transform:translateY(-8px); }
.home.hot > svg { transform:scale(1.14); filter:drop-shadow(0 0 16px rgba(255,206,79,.95)); }"""
assert old in h, 'home css'
h = h.replace(old, new)
print('③ 游戏3 找朋友形式 OK')

# ============ ④ 数一数改课本式：左框散布 + 右侧图形列表 ============
old = """        <div class="htitle" style="font-size:clamp(26px,3.4vw,40px)">工地上 <em>数一数</em></div>
        <div class="hsub">点一个图形名字，帮它数数有几个（课本 P29 · 每次进场题目都不同）</div>
        <div class="countstage gridfloor card" id="cntStage"></div>
        <div class="countqs" id="cntQs">${['cuboid','cube','cyl','ball'].map(s=>`
            <div class="cq" data-s="${s}">${SHAPES[s].name}（<span class="cav">　</span>）个</div>`).join('')}</div>"""
new = """        <div class="htitle" style="font-size:clamp(26px,3.4vw,40px)"><em>数一数</em></div>
        <div class="hsub">点右边的图形，帮它数数有几个（课本 P29 · 每次进场题目都不同）</div>
        <div class="countwrap">
            <div class="countbox" id="cntStage"></div>
            <div class="cqlist" id="cntQs">${['cuboid','cube','cyl','ball'].map(s=>`
                <div class="cq" data-s="${s}">${shapeSVG(s,84,{uid:'cq'+s,face:false})}<span class="cqt">${SHAPES[s].name}（<span class="cav">　</span>）个</span></div>`).join('')}</div>
        </div>"""
assert old in h, 'count html'
h = h.replace(old, new)

old = """.countstage { position:relative; width:min(1000px,100%); height:min(44vh,380px); }"""
new = """.countwrap { display:flex; gap:clamp(16px,2.5vw,40px); align-items:center; justify-content:center; width:min(1300px,100%); }
.countbox { flex:1 1 auto; position:relative; height:min(48vh,420px); border:4.5px dashed #e05d5d; border-radius:30px; background:#fffdf6; }
.cqlist { flex:0 0 clamp(250px,25vw,340px); display:flex; flex-direction:column; gap:14px; }"""
assert old in h, 'count css'
h = h.replace(old, new)

old = """.countqs { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
.cq { border:3px solid var(--line); border-radius:16px; background:#fff; padding:10px 18px; font-weight:900;
    font-size:clamp(16px,1.8vw,21px); cursor:pointer; box-shadow:0 5px 0 rgba(63,58,52,.12); transition:transform .12s; }"""
new = """.cq { display:flex; align-items:center; gap:12px; background:#fff; border:3px solid var(--line); border-radius:16px;
    padding:8px 14px; font-weight:900; font-size:clamp(16px,1.8vw,22px); cursor:pointer;
    box-shadow:0 4px 0 rgba(63,58,52,.12); transition:transform .12s; }
.cq svg { width:64px; height:auto; flex:0 0 64px; }
.cq .cav { color:#e05d5d; font-size:1.15em; }"""
assert old in h, 'cq css'
h = h.replace(old, new)

# 手机端：列表换到下方
old = "    .countstage { }"
if old in h:
    h = h.replace(old, "    .countwrap { flex-direction:column; } .countbox { height:34vh; } .cqlist { flex-basis:auto; }")
else:
    # 在媒体块里补一条
    old2 = "    .viewer3d { height:300px; }"
    new2 = "    .viewer3d { height:300px; }\n    .countwrap { flex-direction:column; } .countbox { height:34vh; } .cqlist { flex-basis:auto; }"
    assert old2 in h, 'count media'
    h = h.replace(old2, new2)
print('④ 数一数课本式 OK')

# ============ ⑤ 删除 小镇落成啦（游戏4） ============
i0 = h.index('/* ================= 游戏4 小镇落成 + 颁奖 ================= */', sp)
i1 = h.index('/* ================= 儿歌页（P37） ================= */', i0)
h = h[:i0] + h[i1:]
# 连带删除其 CSS 段
c0 = h.index('/* ================= 游戏4 小镇 ================= */')
c1 = h.index('/* ================= 儿歌 / 作业 ================= */')
h = h[:c0] + h[c1:]
print('⑤ 删除小镇落成 OK')

io.open(p, 'w', encoding='utf-8').write(h)
print('V1.9 补丁全部应用，模板大小', len(h))
