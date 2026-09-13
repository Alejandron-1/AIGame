/* ============================================================
 * 出题引擎（题库引擎）· 小学数学口算
 * ============================================================
 * 老师三步出题：选年级 → 选知识点（可"综合练习"）→ 选难度
 * 所有口算类游戏共用本引擎；扩展新知识点只需在 TOPICS 里加一项。
 *
 * 返回格式：{ text:'13-5=?', ans:8, topicName, gradeName, difficulty }
 *
 * 覆盖进度（人教版）：
 *   一年级上册：10以内加减法 / 20以内进位加法
 *   一年级下册：20以内退位减法 / 20以内加减混合 / 整十数加减 / 100以内不进位加减
 *   二年级上册：100以内进位加 / 100以内退位减 / 连加连减混合 / 表内乘法
 *   二年级下册：表内除法 / 有余数除法
 * ============================================================ */
'use strict';

(function (global) {
    const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const pick = a => a[R(0, a.length - 1)];
    const mk = (a, op, b) => ({
        text: `${a}${op}${b}=?`,
        ans: op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : Math.trunc(a / b),
    });

    /* ================= 各知识点生成器 =================
       gen(difficulty)：difficulty ∈ 基础 / 标准 / 挑战 */
    const TOPICS = {
        /* ---- 一年级上册 ---- */
        g1a_add10: { name: '10以内加法', gen(d) {
            if (d === '挑战') {   // 三数连加，和≤10
                for (;;) { const a = R(1, 8), b = R(1, 9 - a), c = R(1, 10 - a - b);
                    if (b >= 1 && c >= 1) return mk(mk(a, '+', b).ans, '+', c); }
            }
            const max = d === '基础' ? 5 : 10;
            const a = R(1, max - 1);
            return mk(a, '+', R(1, max - a));
        } },
        g1a_sub10: { name: '10以内减法', gen(d) {
            if (d === '挑战') {   // 三数连减，结果≥0
                const a = R(4, 9); let left = a;
                for (;;) { const b = R(1, left - 1), c = R(1, left - b);
                    if (b >= 1 && c >= 1 && left - b - c >= 0) return mk(mk(a, '-', b).ans, '-', c); }
            }
            const hi = d === '基础' ? 5 : 9;
            const a = R(2, hi);
            return mk(a, '-', R(1, a - 1));
        } },
        g1a_add20: { name: '20以内进位加法', gen(d) {
            const lo = d === '基础' ? 11 : 11, hi = d === '基础' ? 14 : 18;
            const s = R(lo, hi);
            const a = R(Math.max(2, s - 9), Math.min(9, s - 2));
            return mk(a, '+', s - a);
        } },

        /* ---- 一年级下册 ---- */
        g1b_borrow20: { name: '20以内退位减法', gen(d) {
            const hi = d === '基础' ? 15 : 18;
            const a = R(11, hi);
            return mk(a, '-', R(a - 9, a - 2));   // 必退位：差 2~9 且个位不够减
        } },
        g1b_mix20: { name: '20以内加减混合', gen(d) {
            const n = (d === '挑战' || d === '标准' && Math.random() < .5) ? 3 : 2;
            for (let t = 0; t < 200; t++) {
                let v = R(1, 9), s = String(v), ok = true;
                for (let i = 1; i < n; i++) {
                    const x = R(1, 9);
                    const plus = Math.random() < .5 || v - x < 0;
                    s += (plus ? '+' : '-') + x;
                    v = plus ? v + x : v - x;
                }
                if (v >= 0 && v <= 20) return { text: s + '=?', ans: v };
            }
            return mk(2, '+', 3);
        } },
        g1b_tens: { name: '整十数加减法', gen(d) {
            const hi = d === '基础' ? 5 : 9;
            for (;;) {
                const a = R(1, hi) * 10, b = R(1, hi) * 10;
                if (Math.random() < .5) { if (a + b <= 100) return mk(a, '+', b); }
                else if (a !== b) return mk(Math.max(a, b), '-', Math.min(a, b));
            }
        } },
        g1b_no100: { name: '100以内不进位加减', gen(d) {
            /* 逐位生成，数学上保证不进位、不退位 */
            for (let t = 0; t < 300; t++) {
                const a2 = R(1, d === '基础' ? 5 : 9), a1 = R(1, 9);
                const a = a2 * 10 + a1;
                if (Math.random() < .5) {                     // 不进位加
                    const b1 = R(0, 9 - a1), b2 = R(0, 9 - a2);
                    const b = b2 * 10 + b1;
                    if (b >= 1) return mk(a, '+', b);
                } else {                                      // 不退位减
                    const b1 = R(1, a1), b2 = R(0, a2 - 1);
                    const b = b2 * 10 + b1;
                    if (b >= 1 && a - b >= 1) return mk(a, '-', b);
                }
            }
            return mk(23, '+', 14);
        } },

        /* ---- 二年级上册 ---- */
        g2a_carry100: { name: '100以内进位加法', gen(d) {
            for (;;) {
                const a = R(11, d === '基础' ? 67 : 89), b = R(11, 100 - a - 1);
                if (a % 10 + b % 10 > 9 && Math.floor(a / 10) + Math.floor(b / 10) <= 9) return mk(a, '+', b);
            }
        } },
        g2a_borrow100: { name: '100以内退位减法', gen(d) {
            for (;;) {
                const a = R(21, 99), b = R(11, a - 1);
                if (a % 10 < b % 10 && a - b >= 1) return mk(a, '-', b);
            }
        } },
        g2a_chain: { name: '连加连减混合', gen(d) {
            for (let t = 0; t < 200; t++) {
                let v = R(10, 40), s = String(v), ok = true;
                const n = d === '挑战' ? 3 : 2;
                for (let i = 0; i < n; i++) {
                    const x = R(2, 30);
                    const plus = Math.random() < .5 || v - x < 5;
                    s += (plus ? '+' : '-') + x;
                    v = plus ? v + x : v - x;
                }
                if (v >= 0 && v <= 100) return { text: s + '=?', ans: v };
            }
            return mk(20, '+', 10);
        } },
        g2a_mult: { name: '表内乘法', gen(d) {
            const lo = d === '基础' ? 2 : 2, hi = d === '基础' ? 5 : 9;
            return mk(R(lo, hi), '×', R(lo, hi));
        } },

        /* ---- 二年级下册 ---- */
        g2b_div: { name: '表内除法', gen(d) {
            const hi = d === '基础' ? 5 : 9;
            const b = R(2, hi), q = R(2, hi);
            return mk(b * q, '÷', b);
        } },
        g2b_divrem: { name: '有余数除法·填商', gen(d) {
            const hi = d === '基础' ? 5 : 9;
            const b = R(2, hi), q = R(1, hi), r = R(1, b - 1);
            return mk(b * q + r, '÷', b);   // 答案取商（游戏填商，余数在课堂口述）
        } },
    };

    /* ================= 年级 → 知识点映射 ================= */
    const GRADES = [
        { id: 'g1a', name: '一年级上册', topics: [
            { id: 'g1a_add10', name: '10以内加法' },
            { id: 'g1a_sub10', name: '10以内减法' },
            { id: 'g1a_add20', name: '20以内进位加法' },
        ] },
        { id: 'g1b', name: '一年级下册', topics: [
            { id: 'g1b_borrow20', name: '20以内退位减法' },
            { id: 'g1b_mix20', name: '20以内加减混合' },
            { id: 'g1b_tens', name: '整十数加减法' },
            { id: 'g1b_no100', name: '100以内不进位加减' },
        ] },
        { id: 'g2a', name: '二年级上册', topics: [
            { id: 'g2a_carry100', name: '100以内进位加法' },
            { id: 'g2a_borrow100', name: '100以内退位减法' },
            { id: 'g2a_chain', name: '连加连减混合' },
            { id: 'g2a_mult', name: '表内乘法' },
        ] },
        { id: 'g2b', name: '二年级下册', topics: [
            { id: 'g2b_div', name: '表内除法' },
            { id: 'g2b_divrem', name: '有余数除法' },
        ] },
    ];
    const DIFFS = ['基础', '标准', '挑战'];

    /* ================= 主入口 =================
       题库引擎.gen({ grade, topic:'auto'|知识点id, difficulty }) */
    function gen(cfg) {
        cfg = cfg || {};
        const grade = GRADES.find(g => g.id === cfg.grade) || GRADES[0];
        let tid = cfg.topic;
        if (!tid || tid === 'auto' || !grade.topics.some(t => t.id === tid)) {
            tid = pick(grade.topics).id;      // 综合练习：随机抽本册知识点
        }
        const difficulty = DIFFS.includes(cfg.difficulty) ? cfg.difficulty : '标准';
        const topic = TOPICS[tid];
        if (!topic) return { text: '1+1=?', ans: 2, topicName: '默认', gradeName: grade.name, difficulty };
        const q = topic.gen(difficulty);
        return { text: q.text, ans: q.ans, topicName: topic.name, gradeName: grade.name, difficulty };
    }

    function gradeName(gradeId) {
        const g = GRADES.find(g => g.id === gradeId);
        return g ? g.name : gradeId;
    }
    function topicName(gradeId, topicId) {
        const g = GRADES.find(g => g.id === gradeId);
        if (!g) return '';
        if (!topicId || topicId === 'auto') return '综合练习';
        const t = g.topics.find(t => t.id === topicId);
        return t ? t.name : '综合练习';
    }

    const API = { GRADES, DIFFS, TOPICS, gen, gradeName, topicName };
    global.题库引擎 = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;   /* 供 Node 测试 */
})(typeof window !== 'undefined' ? window : globalThis);
