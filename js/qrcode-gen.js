/* ============================================================
 * qrcode-gen.js —— 纯 JS QR 编码器（零依赖）
 * 移植自 Python qrcode 库（BSD-3）核心算法，支持版本1-10、EC L/M/Q/H
 * 用法：QRGen.make(text, 'M') → { size, modules }  (modules[row][col] 布尔)
 *       QRGen.draw(canvas, text, opts) → 直接绘制到 canvas
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---- GF(256) 表 ---- */
  var EXP_TABLE = new Array(256), LOG_TABLE = new Array(256);
  (function () {
    for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
    for (var j = 8; j < 256; j++) EXP_TABLE[j] = EXP_TABLE[j - 4] ^ EXP_TABLE[j - 5] ^ EXP_TABLE[j - 6] ^ EXP_TABLE[j - 8];
    for (var k = 0; k < 255; k++) LOG_TABLE[EXP_TABLE[k]] = k;
  })();
  function glog(n) { if (n < 1) throw new Error('glog(' + n + ')'); return LOG_TABLE[n]; }
  function gexp(n) { return EXP_TABLE[n % 255]; }

  /* ---- RS 块表（版本1-10, 顺序 L/M/Q/H） ---- */
  var RS_BLOCK_TABLE = [
    /* v1 */[1,26,19],[1,26,16],[1,26,13],[1,26,9],
    /* v2 */[1,44,34],[1,44,28],[1,44,22],[1,44,16],
    /* v3 */[1,70,55],[1,70,44],[2,35,17],[2,35,13],
    /* v4 */[1,100,80],[2,50,32],[2,50,24],[4,25,9],
    /* v5 */[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
    /* v6 */[2,86,68],[4,43,27],[4,43,19],[4,43,15],
    /* v7 */[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
    /* v8 */[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
    /* v9 */[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
    /* v10*/[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16]
  ];
  var EC_OFFSET = { L: 0, M: 1, Q: 2, H: 3 };
  var EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function rsBlocks(version, ec) {
    var off = EC_OFFSET[ec];
    var rs = RS_BLOCK_TABLE[(version - 1) * 4 + off];
    var blocks = [];
    for (var i = 0; i < rs.length; i += 3) {
      for (var k = 0; k < rs[i]; k++) blocks.push({ total: rs[i + 1], data: rs[i + 2] });
    }
    return blocks;
  }

  /* ---- 多项式（GF256） ---- */
  function Poly(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = num.slice(offset);
    for (var i = 0; i < (shift || 0); i++) this.num.push(0);
  }
  Poly.prototype.mul = function (other) {
    var num = new Array(this.num.length + other.num.length - 1);
    for (var i = 0; i < num.length; i++) num[i] = 0;
    for (var a = 0; a < this.num.length; a++) {
      for (var b = 0; b < other.num.length; b++) {
        num[a + b] ^= gexp(glog(this.num[a]) + glog(other.num[b]));
      }
    }
    return new Poly(num, 0);
  };
  Poly.prototype.mod = function (other) {
    var diff = this.num.length - other.num.length;
    if (diff < 0) return this;
    var ratio = glog(this.num[0]) - glog(other.num[0]);
    var num = [];
    for (var i = 0; i < other.num.length; i++) {
      num.push(this.num[i] ^ gexp(glog(other.num[i]) + ratio));
    }
    for (var j = other.num.length; j < this.num.length; j++) num.push(this.num[j]);
    return new Poly(num, 0).mod(other);
  };
  function rsPolyOf(ecCount) {
    var p = new Poly([1], 0);
    for (var i = 0; i < ecCount; i++) p = p.mul(new Poly([1, gexp(i)], 0));
    return p;
  }

  /* ---- 对齐图案位置 ---- */
  var PATTERN_POSITION = [
    [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]
  ];

  /* ---- BCH ---- */
  var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
  var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
  var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
  function bchDigit(d) { var n = 0; while (d !== 0) { n++; d >>= 1; } return n; }
  function bchTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
    return ((data << 10) | d) ^ G15_MASK;
  }
  function bchTypeNumber(data) {
    var d = data << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18));
    return (data << 12) | d;
  }

  /* ---- 掩码 ---- */
  function maskFunc(pattern) {
    switch (pattern) {
      case 0: return function (i, j) { return (i + j) % 2 === 0; };
      case 1: return function (i) { return i % 2 === 0; };
      case 2: return function (i, j) { return j % 3 === 0; };
      case 3: return function (i, j) { return (i + j) % 3 === 0; };
      case 4: return function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; };
      case 5: return function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; };
      case 6: return function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; };
      case 7: return function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 === 0; };
    }
    throw new Error('bad mask: ' + pattern);
  }

  /* ---- 数据编码 ---- */
  var MODE_8BIT = 4; // 0100
  var PAD0 = 0xEC, PAD1 = 0x11;
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6)); out.push(0x80 | (c & 63)); }
      else if (c < 0x10000) { out.push(0xE0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 63)); out.push(0x80 | (c & 63)); }
      else { out.push(0xF0 | (c >> 18)); out.push(0x80 | ((c >> 12) & 63)); out.push(0x80 | ((c >> 6) & 63)); out.push(0x80 | (c & 63)); }
    }
    return out;
  }
  function createData(version, ec, bytes) {
    var blocks = rsBlocks(version, ec);
    var bitLimit = 0;
    blocks.forEach(function (b) { bitLimit += b.data * 8; });

    /* BitBuffer */
    var buffer = [];
    var bitLen = 0;
    function putBit(bit) {
      var bi = Math.floor(bitLen / 8);
      if (buffer.length <= bi) buffer.push(0);
      if (bit) buffer[bi] |= 0x80 >> (bitLen % 8);
      bitLen++;
    }
    function put(num, length) {
      for (var i = length - 1; i >= 0; i--) putBit(((num >> i) & 1) === 1);
    }
    /* 模式 0100 + 长度(8bit, v<10) + 数据 */
    put(MODE_8BIT, 4);
    put(bytes.length, 8);
    for (var b = 0; b < bytes.length; b++) put(bytes[b], 8);
    if (bitLen > bitLimit) throw new Error('data overflow: ' + bitLen + ' > ' + bitLimit);
    /* 终止符 */
    var term = Math.min(bitLimit - bitLen, 4);
    for (var t = 0; t < term; t++) putBit(false);
    /* 8 位对齐 */
    var delimit = bitLen % 8;
    if (delimit) for (var d = 0; d < 8 - delimit; d++) putBit(false);
    /* 交替填充 */
    var fill = (bitLimit - bitLen) / 8;
    for (var f = 0; f < fill; f++) put(f % 2 === 0 ? PAD0 : PAD1, 8);

    /* RS 纠错 + 交织 */
    var offset = 0, maxDc = 0, maxEc = 0;
    var dcdata = [], ecdata = [];
    for (var i = 0; i < blocks.length; i++) {
      var blk = blocks[i];
      var dcCount = blk.data, ecCount = blk.total - blk.data;
      maxDc = Math.max(maxDc, dcCount);
      maxEc = Math.max(maxEc, ecCount);
      var curDc = buffer.slice(offset, offset + dcCount);
      offset += dcCount;
      var rsPoly = rsPolyOf(ecCount);
      var raw = new Poly(curDc, rsPoly.num.length - 1);
      var modP = raw.mod(rsPoly);
      var curEc = [];
      var modOff = modP.num.length - ecCount;
      for (var e = 0; e < ecCount; e++) {
        var idx = e + modOff;
        curEc.push(idx >= 0 ? modP.num[idx] : 0);
      }
      dcdata.push(curDc);
      ecdata.push(curEc);
    }
    var data = [];
    for (var r = 0; r < maxDc; r++) for (var b2 = 0; b2 < dcdata.length; b2++) if (r < dcdata[b2].length) data.push(dcdata[b2][r]);
    for (var r2 = 0; r2 < maxEc; r2++) for (var b3 = 0; b3 < ecdata.length; b3++) if (r2 < ecdata[b3].length) data.push(ecdata[b3][r2]);
    return data;
  }

  /* ---- 矩阵构建 ---- */
  function makeImpl(version, ec, data, test, maskPattern) {
    var count = version * 4 + 17;
    var modules = [];
    for (var i = 0; i < count; i++) { modules.push(new Array(count)); for (var j = 0; j < count; j++) modules[i][j] = null; }

    function probe(row, col) {
      for (var r = -1; r < 8; r++) {
        if (row + r <= -1 || count <= row + r) continue;
        for (var c = -1; c < 8; c++) {
          if (col + c <= -1 || count <= col + c) continue;
          var dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                     (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                     (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          modules[row + r][col + c] = dark;
        }
      }
    }
    probe(0, 0);
    probe(count - 7, 0);
    probe(0, count - 7);

    var pos = PATTERN_POSITION[version - 1];
    for (var a = 0; a < pos.length; a++) {
      for (var b = 0; b < pos.length; b++) {
        var row = pos[a], col = pos[b];
        if (modules[row][col] !== null) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            modules[row + r][col + c] = (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0));
          }
        }
      }
    }

    for (var t1 = 8; t1 < count - 8; t1++) {
      if (modules[t1][6] === null) modules[t1][6] = (t1 % 2 === 0);
    }
    for (var t2 = 8; t2 < count - 8; t2++) {
      if (modules[6][t2] === null) modules[6][t2] = (t2 % 2 === 0);
    }

    /* 格式信息 + dark module */
    var fmtData = (EC_BITS[ec] << 3) | maskPattern;
    var fmtBits = bchTypeInfo(fmtData);
    var i15;
    for (i15 = 0; i15 < 15; i15++) {
      var mod = !test && ((fmtBits >> i15) & 1) === 1;
      if (i15 < 6) modules[i15][8] = mod;
      else if (i15 < 8) modules[i15 + 1][8] = mod;
      else modules[count - 15 + i15][8] = mod;
    }
    for (i15 = 0; i15 < 15; i15++) {
      var mod2 = !test && ((fmtBits >> i15) & 1) === 1;
      if (i15 < 8) modules[8][count - i15 - 1] = mod2;
      else if (i15 < 9) modules[8][15 - i15] = mod2;
      else modules[8][15 - i15 - 1] = mod2;
    }
    modules[count - 8][8] = !test;

    /* 版本信息 (v>=7) */
    if (version >= 7) {
      var vBits = bchTypeNumber(version);
      for (var v1 = 0; v1 < 18; v1++) {
        var mod3 = !test && ((vBits >> v1) & 1) === 1;
        modules[Math.floor(v1 / 3)][v1 % 3 + count - 8 - 3] = mod3;
      }
      for (var v2 = 0; v2 < 18; v2++) {
        var mod4 = !test && ((vBits >> v2) & 1) === 1;
        modules[v2 % 3 + count - 8 - 3][Math.floor(v2 / 3)] = mod4;
      }
    }

    /* 数据曲折填充 */
    var inc = -1, row2 = count - 1, bitIndex = 7, byteIndex = 0;
    var mf = maskFunc(maskPattern), dataLen = data.length;
    for (var col = count - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      while (true) {
        for (var cIdx = 0; cIdx < 2; cIdx++) {
          var cc = cIdx === 0 ? col : col - 1;
          if (modules[row2][cc] === null) {
            var dark = false;
            if (byteIndex < dataLen) dark = ((data[byteIndex] >> bitIndex) & 1) === 1;
            if (mf(row2, cc)) dark = !dark;
            modules[row2][cc] = dark;
            bitIndex -= 1;
            if (bitIndex === -1) { byteIndex += 1; bitIndex = 7; }
          }
        }
        row2 += inc;
        if (row2 < 0 || count <= row2) { row2 -= inc; inc = -inc; break; }
      }
    }
    return modules;
  }

  /* ---- 罚分（直接移植 ISO 规则） ---- */
  function lostPoint(modules) {
    var n = modules.length;
    var lost = 0;
    /* level1: 连续同色 */
    var container = new Array(n + 1);
    for (var i = 0; i <= n; i++) container[i] = 0;
    var row, col;
    for (row = 0; row < n; row++) {
      var prev = modules[row][0], len = 0;
      for (col = 0; col < n; col++) {
        if (modules[row][col] === prev) len++;
        else { if (len >= 5) container[len]++; len = 1; prev = modules[row][col]; }
      }
      if (len >= 5) container[len]++;
    }
    for (col = 0; col < n; col++) {
      var prev2 = modules[0][col], len2 = 0;
      for (row = 0; row < n; row++) {
        if (modules[row][col] === prev2) len2++;
        else { if (len2 >= 5) container[len2]++; len2 = 1; prev2 = modules[row][col]; }
      }
      if (len2 >= 5) container[len2]++;
    }
    for (var L = 5; L <= n; L++) lost += container[L] * (L - 2);
    /* level2: 2x2 块 */
    for (row = 0; row < n - 1; row++) {
      for (col = 0; col < n - 1; col++) {
        var v = modules[row][col];
        if (v === modules[row][col + 1] && v === modules[row + 1][col] && v === modules[row + 1][col + 1]) lost += 3;
      }
    }
    /* level3: 1:1:3:1:1 图案 */
    for (row = 0; row < n; row++) {
      for (col = 0; col < n - 10; col++) {
        var rw = modules[row];
        if (!rw[col + 1] && rw[col + 4] && !rw[col + 5] && rw[col + 6] && !rw[col + 9] &&
          ((rw[col] && rw[col + 2] && rw[col + 3] && !rw[col + 7] && !rw[col + 8] && !rw[col + 10]) ||
           (!rw[col] && !rw[col + 2] && !rw[col + 3] && rw[col + 7] && rw[col + 8] && rw[col + 10]))) lost += 40;
      }
    }
    for (col = 0; col < n; col++) {
      for (row = 0; row < n - 10; row++) {
        if (!modules[row + 1][col] && modules[row + 4][col] && !modules[row + 5][col] && modules[row + 6][col] && !modules[row + 9][col] &&
          ((modules[row][col] && modules[row + 2][col] && modules[row + 3][col] && !modules[row + 7][col] && !modules[row + 8][col] && !modules[row + 10][col]) ||
           (!modules[row][col] && !modules[row + 2][col] && !modules[row + 3][col] && modules[row + 7][col] && modules[row + 8][col] && modules[row + 10][col]))) lost += 40;
      }
    }
    /* level4: 暗色比例 */
    var darkCount = 0;
    for (row = 0; row < n; row++) for (col = 0; col < n; col++) if (modules[row][col]) darkCount++;
    var percent = darkCount / (n * n);
    lost += Math.floor(Math.abs(percent * 100 - 50) / 5) * 10;
    return lost;
  }

  /* ---- 对外 API ---- */
  function make(text, ec) {
    ec = ec || 'M';
    var bytes = utf8Bytes(String(text));
    /* 选版本 */
    var version = -1;
    for (var v = 1; v <= 10; v++) {
      var blocks = rsBlocks(v, ec);
      var limit = 0;
      blocks.forEach(function (b) { limit += b.data * 8; });
      if (4 + 8 + bytes.length * 8 <= limit) { version = v; break; }
    }
    if (version < 0) throw new Error('QR 内容过长（超出 v10 容量）');
    var data = createData(version, ec, bytes);
    /* 选最优掩码 */
    var best = 0, bestLost = Infinity;
    for (var m = 0; m < 8; m++) {
      var mm = makeImpl(version, ec, data, true, m);
      var lp = lostPoint(mm);
      if (lp < bestLost) { bestLost = lp; best = m; }
    }
    var modules = makeImpl(version, ec, data, false, best);
    return { size: modules.length, modules: modules, mask: best };
  }

  function draw(canvas, text, opts) {
    opts = opts || {};
    var qr = make(text, opts.ec || 'M');
    var n = qr.size, quiet = opts.quiet != null ? opts.quiet : 4;
    var scale = opts.scale || 8;
    var total = (n + quiet * 2) * scale;
    canvas.width = total;
    canvas.height = total;
    var ctx = canvas.getContext('2d');
    var dark = opts.dark || '#0E3D27';
    var light = opts.light || '#FFFFFF';
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = dark;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return qr;
  }

  global.QRGen = { make: make, draw: draw };
})(typeof window !== 'undefined' ? window : this);
