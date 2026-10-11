# -*- coding: utf-8 -*-
"""配色机制重构：PALETTE 常量（可被 window.__PALETTE 覆盖）+ 全部硬编码色改为引用"""
import io

p = r'C:/Users/aa109/Desktop/AIGame/小学一年级/图形小镇-公开课工具包/课件模板.html'
h = io.open(p, encoding='utf-8').read()

# 1) PCOLORS 行 → PALETTE 定义 + CSS 变量注入 + 新 PCOLORS
old = "const PCOLORS = ['#ee5253','#5aa9e6','#5ec26a','#f5923e','#ffce4f','#8ed081'];"
new = """/* 配色表：默认=角色参考图配色；拆分文件可注入 window.__PALETTE 覆盖 */
const PALETTE = Object.assign({
    cuboid:{ m:'#ee5253', d:'#d63f3f', l:'#ff8f86', tint:'#fdecea', tintB:'#f5c1bd', face:'#ee5253' },
    cube:  { m:'#5aa9e6', d:'#3f8fd1', l:'#a9cdf0', tint:'#eaf3fd', tintB:'#b9d7f2', face:'#5aa9e6' },
    cyl:   { m:'#5ec26a', d:'#46a852', l:'#a8e0ae', tint:'#eaf7ee', tintB:'#b4e2ba', face:'#5ec26a' },
    ball:  { m:'#f5923e', d:'#dd7a28', l:'#ffc38f', tint:'#fff3e6', tintB:'#f5d2a8', face:'#f5923e' }
}, window.__PALETTE || {});
for (const k of ['cuboid','cube','cyl','ball']) {
    document.documentElement.style.setProperty('--'+k, PALETTE[k].m);
    document.documentElement.style.setProperty('--'+k+'-d', PALETTE[k].d);
    document.documentElement.style.setProperty('--'+k+'-l', PALETTE[k].l);
}
const hx = s => parseInt(s.slice(1), 16);
const PCOLORS = [PALETTE.cuboid.m, PALETTE.cube.m, PALETTE.cyl.m, PALETTE.ball.m, '#ffce4f', '#8ed081'];"""
assert old in h, 'PCOLORS'
h = h.replace(old, new)

# 2) Shape3D 长方体
old = "const A = 0xee5253, B = 0xd63f3f, C = 0xff8f86;"
assert old in h, 'cuboid mats'
h = h.replace(old, "const A = hx(PALETTE.cuboid.m), B = hx(PALETTE.cuboid.d), C = hx(PALETTE.cuboid.l);")
old = "this.mat(A, faceTexture('#ee5253')), this.mat(A) ];"
assert old in h, 'cuboid face'
h = h.replace(old, "this.mat(A, faceTexture(PALETTE.cuboid.face)), this.mat(A) ];")

# 3) Shape3D 正方体
old = "const mats = []; for (let k = 0; k < 6; k++) mats.push(this.mat(0x5aa9e6));"
assert old in h, 'cube mats'
h = h.replace(old, "const mats = []; for (let k = 0; k < 6; k++) mats.push(this.mat(hx(PALETTE.cube.m)));")
old = "mats[4] = this.mat(0, faceTexture('#5aa9e6'));"
assert old in h, 'cube face'
h = h.replace(old, "mats[4] = this.mat(0, faceTexture(PALETTE.cube.face));")

# 4) Shape3D 圆柱
old = "const side = this.mat(0x5ec26a, faceTexture('#5ec26a'));"
assert old in h, 'cyl side'
h = h.replace(old, "const side = this.mat(hx(PALETTE.cyl.m), faceTexture(PALETTE.cyl.face));")
old = "const cap = this.mat(0xa8e0ae);"
assert old in h, 'cyl cap'
h = h.replace(old, "const cap = this.mat(hx(PALETTE.cyl.l));")

# 5) Shape3D 球
old = "faceTexture('#f5923e')));"
assert old in h, 'ball face'
h = h.replace(old, "faceTexture(PALETTE.ball.face)));")

# 6) 数面兜底扇形（长方体/正方体 SVG 回退）
old = "['#ee5253','#d63f3f','#ff8f86','#ee5253','#d63f3f','#ff8f86']"
assert old in h, 'fan cuboid'
h = h.replace(old, "[PALETTE.cuboid.m,PALETTE.cuboid.d,PALETTE.cuboid.l,PALETTE.cuboid.m,PALETTE.cuboid.d,PALETTE.cuboid.l]")
old = "['#5aa9e6','#5aa9e6','#5aa9e6','#5aa9e6','#5aa9e6','#5aa9e6']"
assert old in h, 'fan cube'
h = h.replace(old, "[PALETTE.cube.m,PALETTE.cube.m,PALETTE.cube.m,PALETTE.cube.m,PALETTE.cube.m,PALETTE.cube.m]")

# 7) 第1关四分区底色 → PALETTE
old = """zones.innerHTML = [['cube','#eaf3fd','#b9d7f2'],['cuboid','#fdecea','#f5c1bd'],
                ['cyl','#eaf7ee','#b4e2ba'],['ball','#fff3e6','#f5d2a8']].map(([s, bg, bd], z) =>"""
new = """zones.innerHTML = [['cube'],['cuboid'],
                ['cyl'],['ball']].map(([s], z) =>"""
assert old in h, 'zones'
h = h.replace(old, new)
old = """                `<div class="g1zone" id="g1z${s}" data-shape="${s}" style="left:calc(${z*25}% + 5px);width:calc(25% - 10px);background:${bg};border-color:${bd}">
                    <span class="zn"></span></div>`).join('');"""
new = """                `<div class="g1zone" id="g1z${s}" data-shape="${s}" style="left:calc(${z*25}% + 5px);width:calc(25% - 10px);background:${PALETTE[s].tint};border-color:${PALETTE[s].tintB}">
                    <span class="zn"></span></div>`).join('');"""
assert old in h, 'zone html'
h = h.replace(old, new)

io.open(p, 'w', encoding='utf-8').write(h)
print('PALETTE 重构完成')
