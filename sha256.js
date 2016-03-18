(function (root, factory) {
    // Hack to make all exports of this module sha256 function object properties.
    var exports = {};
    factory(exports);
    var sha256 = exports["default"];
    for (var k in exports) {
        sha256[k] = exports[k];
    }
        
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = sha256;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return sha256; }); 
    } else {
        root.sha256 = sha256;
    }
})(this, function(exports) {
// SHA-256 (+ HMAC and PBKDF2) for JavaScript.
//
// Written in 2014-2016 by Dmitry Chestnykh.
// Public domain, no warranty.
//
// Functions (accept and return Uint8Arrays):
//
//   sha256(message) -> hash
//   sha256.hmac(key, message) -> mac
//   sha256.pbkdf2(password, salt, rounds, dkLen) -> dk
//
//  Classes:
//  
//   new sha256.Hash()
//   new sha256.HMAC(key)
//
"use strict";
var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
    0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
    0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
    0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
    0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
    0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
    0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
    0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
function hashBlocks(w, v, p, pos, len) {
    var a, b, c, d, e, f, g, h, u, i, j, t1, t2;
    while (len >= 64) {
        a = v[0];
        b = v[1];
        c = v[2];
        d = v[3];
        e = v[4];
        f = v[5];
        g = v[6];
        h = v[7];
        for (i = 0; i < 16; i++) {
            j = pos + i * 4;
            w[i] = (((p[j] & 0xff) << 24) | ((p[j + 1] & 0xff) << 16) |
                ((p[j + 2] & 0xff) << 8) | (p[j + 3] & 0xff));
        }
        for (i = 16; i < 64; i++) {
            u = w[i - 2];
            t1 = (u >>> 17 | u << (32 - 17)) ^ (u >>> 19 | u << (32 - 19)) ^ (u >>> 10);
            u = w[i - 15];
            t2 = (u >>> 7 | u << (32 - 7)) ^ (u >>> 18 | u << (32 - 18)) ^ (u >>> 3);
            w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
        }
        for (i = 0; i < 64; i++) {
            t1 = (((((e >>> 6 | e << (32 - 6)) ^ (e >>> 11 | e << (32 - 11)) ^
                (e >>> 25 | e << (32 - 25))) + ((e & f) ^ (~e & g))) | 0) +
                ((h + ((K[i] + w[i]) | 0)) | 0)) | 0;
            t2 = (((a >>> 2 | a << (32 - 2)) ^ (a >>> 13 | a << (32 - 13)) ^
                (a >>> 22 | a << (32 - 22))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        v[0] += a;
        v[1] += b;
        v[2] += c;
        v[3] += d;
        v[4] += e;
        v[5] += f;
        v[6] += g;
        v[7] += h;
        pos += 64;
        len -= 64;
    }
    return pos;
}
var Hash = (function () {
    function Hash() {
        this.digestLength = Hash.digestLength;
        this.blockSize = Hash.blockSize;
        // Note: Int32Array is used instead of Uint32Array for performance reasons.
        this.v = new Int32Array(8); // hash state
        this.w = new Int32Array(64); // temporary state
        this.buf = new Uint8Array(128); // buffer for data to hash
        this.buflen = 0; // number of bytes in buffer
        this.len = 0; // number of total bytes hashed
        this.finished = false; // indicates whether the hash was finalized 
        this.reset();
    }
    // Re-initializes hash state making it possible
    // to re-use this instance to hash other data.
    Hash.prototype.reset = function () {
        this.v[0] = 0x6a09e667;
        this.v[1] = 0xbb67ae85;
        this.v[2] = 0x3c6ef372;
        this.v[3] = 0xa54ff53a;
        this.v[4] = 0x510e527f;
        this.v[5] = 0x9b05688c;
        this.v[6] = 0x1f83d9ab;
        this.v[7] = 0x5be0cd19;
        this.buflen = 0;
        this.len = 0;
        this.finished = false;
    };
    // Cleans internal buffers and re-initializes hash state.
    Hash.prototype.clean = function () {
        for (var i = 0; i < this.buf.length; i++)
            this.buf[i] = 0;
        for (var i = 0; i < this.w.length; i++)
            this.w[i] = 0;
        this.reset();
    };
    // Updates hash state with the given data.
    //
    // Optionally, length of the data can be specified to hash
    // fewer bytes than data.length.
    //
    // Throws error when trying to update already finalized hash:
    // instance must be reset to use it again.
    Hash.prototype.update = function (data, dataLength) {
        if (dataLength === void 0) { dataLength = data.length; }
        if (this.finished) {
            throw new Error("SHA256: can't update because hash was finished.");
        }
        var dataPos = 0;
        this.len += dataLength;
        if (this.buflen > 0) {
            while (this.buflen < 64 && dataLength > 0) {
                this.buf[this.buflen++] = data[dataPos++];
                dataLength--;
            }
            if (this.buflen === 64) {
                hashBlocks(this.w, this.v, this.buf, 0, 64);
                this.buflen = 0;
            }
        }
        if (dataLength >= 64) {
            dataPos = hashBlocks(this.w, this.v, data, dataPos, dataLength);
            dataLength %= 64;
        }
        while (dataLength > 0) {
            this.buf[this.buflen++] = data[dataPos++];
            dataLength--;
        }
        return this;
    };
    // Finalizes hash state and puts hash into out.
    //
    // If hash was already finalized, puts the same value.
    Hash.prototype.finish = function (out) {
        if (!this.finished) {
            var mlen = this.len;
            var left = this.buflen;
            var bhi = (mlen / 0x20000000) | 0;
            var blo = mlen << 3;
            var padlen = (mlen % 64 < 56) ? 64 : 128;
            this.buf[left] = 0x80;
            for (var i = left + 1; i < padlen - 8; i++) {
                this.buf[i] = 0;
            }
            this.buf[padlen - 8] = (bhi >>> 24) & 0xff;
            this.buf[padlen - 7] = (bhi >>> 16) & 0xff;
            this.buf[padlen - 6] = (bhi >>> 8) & 0xff;
            this.buf[padlen - 5] = (bhi >>> 0) & 0xff;
            this.buf[padlen - 4] = (blo >>> 24) & 0xff;
            this.buf[padlen - 3] = (blo >>> 16) & 0xff;
            this.buf[padlen - 2] = (blo >>> 8) & 0xff;
            this.buf[padlen - 1] = (blo >>> 0) & 0xff;
            hashBlocks(this.w, this.v, this.buf, 0, padlen);
            this.finished = true;
        }
        for (var i = 0; i < 8; i++) {
            out[i * 4 + 0] = (this.v[i] >>> 24) & 0xff;
            out[i * 4 + 1] = (this.v[i] >>> 16) & 0xff;
            out[i * 4 + 2] = (this.v[i] >>> 8) & 0xff;
            out[i * 4 + 3] = (this.v[i] >>> 0) & 0xff;
        }
        return this;
    };
    // Returns the final hash digest.
    Hash.prototype.digest = function () {
        var out = new Uint8Array(this.digestLength);
        this.finish(out);
        return out;
    };
    Hash.digestLength = 32;
    Hash.blockSize = 64;
    return Hash;
}());
exports.Hash = Hash;
var HMAC = (function () {
    function HMAC(key) {
        this.inner = new Hash();
        this.outer = new Hash();
        this.blockSize = this.inner.blockSize;
        this.digestLength = this.inner.digestLength;
        var pad = new Uint8Array(this.blockSize);
        if (key.length > this.blockSize) {
            (new Hash()).update(key).finish(pad).clean();
        }
        else {
            for (var i = 0; i < key.length; i++) {
                pad[i] = key[i];
            }
        }
        for (var i = 0; i < pad.length; i++) {
            pad[i] ^= 0x36;
        }
        this.inner.update(pad);
        for (var i = 0; i < pad.length; i++) {
            pad[i] ^= 0x36 ^ 0x5c;
        }
        this.outer.update(pad);
        this.istate = new Uint32Array(this.digestLength / 4);
        this.ostate = new Uint32Array(this.digestLength / 4);
        for (var i = 0; i < this.istate.length; i++) {
            this.istate[i] = this.inner.v[i];
            this.ostate[i] = this.outer.v[i];
        }
        for (var i = 0; i < pad.length; i++) {
            pad[i] = 0;
        }
    }
    HMAC.prototype.reset = function () {
        for (var i = 0; i < this.istate.length; i++) {
            this.inner.v[i] = this.istate[i];
            this.outer.v[i] = this.ostate[i];
        }
        this.inner.len = this.outer.len = this.inner.blockSize;
        this.inner.buflen = this.outer.buflen = 0;
        this.inner.finished = this.outer.finished = false;
    };
    HMAC.prototype.clean = function () {
        for (var i = 0; i < this.istate.length; i++) {
            this.ostate[i] = this.istate[i] = 0;
        }
        this.inner.clean();
        this.outer.clean();
    };
    HMAC.prototype.update = function (data) {
        this.inner.update(data);
        return this;
    };
    HMAC.prototype.finish = function (out) {
        if (this.outer.finished) {
            this.outer.finish(out);
        }
        else {
            this.inner.finish(out);
            this.outer.update(out, this.digestLength).finish(out);
        }
        return this;
    };
    HMAC.prototype.digest = function () {
        var out = new Uint8Array(this.digestLength);
        this.finish(out);
        return out;
    };
    return HMAC;
}());
exports.HMAC = HMAC;
function hash(data) {
    var h = (new Hash()).update(data);
    var digest = h.digest();
    h.clean();
    return digest;
}
exports.hash = hash;
exports.__esModule = true;
exports["default"] = hash;
function hmac(key, data) {
    var h = (new HMAC(key)).update(data);
    var digest = h.digest();
    h.clean();
    return digest;
}
exports.hmac = hmac;
function pbkdf2(password, salt, rounds, dkLen) {
    var ctr = new Uint8Array(4);
    var t = new Uint8Array(32);
    var u = new Uint8Array(32);
    var dk = new Uint8Array(dkLen);
    var prf = new HMAC(password);
    for (var i = 0; i * 32 < dkLen; i++) {
        var k = i + 1;
        ctr[0] = (k >>> 24) & 0xff;
        ctr[1] = (k >>> 16) & 0xff;
        ctr[2] = (k >>> 8) & 0xff;
        ctr[3] = (k >>> 0) & 0xff;
        prf.reset();
        prf.update(salt);
        prf.update(ctr);
        prf.finish(u);
        for (var j = 0; j < 32; j++) {
            t[j] = u[j];
        }
        for (var j = 2; j <= rounds; j++) {
            prf.reset();
            prf.update(u).finish(u);
            for (var k_1 = 0; k_1 < 32; k_1++) {
                t[k_1] ^= u[k_1];
            }
        }
        for (var j = 0; j < 32 && i * 32 + j < dkLen; j++) {
            dk[i * 32 + j] = t[j];
        }
    }
    for (var i = 0; i < 32; i++) {
        t[i] = u[i] = 0;
    }
    for (var i = 0; i < 4; i++) {
        ctr[i] = 0;
    }
    prf.clean();
    return dk;
}
exports.pbkdf2 = pbkdf2;
});
