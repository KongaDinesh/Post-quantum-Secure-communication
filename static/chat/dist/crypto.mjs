//#region node_modules/@noble/hashes/_u64.js
var e = /* @__PURE__ */ BigInt(2 ** 32 - 1), t = /* @__PURE__ */ BigInt(32);
function n(n, r = !1) {
	return r ? {
		h: Number(n & e),
		l: Number(n >> t & e)
	} : {
		h: Number(n >> t & e) | 0,
		l: Number(n & e) | 0
	};
}
function r(e, t = !1) {
	let r = e.length, i = new Uint32Array(r), a = new Uint32Array(r);
	for (let o = 0; o < r; o++) {
		let { h: r, l: s } = n(e[o], t);
		[i[o], a[o]] = [r, s];
	}
	return [i, a];
}
//#endregion
//#region node_modules/@noble/hashes/utils.js
function i(e) {
	return e instanceof Uint8Array || ArrayBuffer.isView(e) && e.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in e && e.BYTES_PER_ELEMENT === 1;
}
var a = (e) => e ? `"${e}" ` : "";
function o(e, t = "") {
	if (typeof e != "number") throw TypeError(a(t) + "expected number, got " + typeof e);
	if (!Number.isSafeInteger(e) || e < 0) throw RangeError(a(t) + "expected integer >= 0, got " + e);
	return e;
}
function s(e, t = "") {
	if (typeof e != "boolean") throw TypeError(a(t) + "expected boolean, got type=" + typeof e);
	return e;
}
function c(e, t, n = "") {
	if (i(e) && (t === void 0 || e.length === t)) return e;
	t !== void 0 && o(t, "length");
	let r = i(e), s = t === void 0 ? "" : ` of length ${t}`, c = r ? `length=${e.length}` : `type=${typeof e}`, l = a(n) + "expected Uint8Array" + s + ", got " + c;
	throw r ? RangeError(l) : TypeError(l);
}
var l = (e, t) => {
	if (typeof e != "object" || !e || Array.isArray(e)) throw TypeError((t === "object" ? "" : `"${t}" `) + "expected object, got type=" + typeof e);
}, u = (e, t) => {
	l(e, t);
	let n = Object.getPrototypeOf(e);
	if (n !== Object.prototype && n !== null) throw TypeError(`"${t}" expected plain object`);
	if (Object.hasOwn(e, "__proto__")) throw TypeError(`"${t}.__proto__" is not allowed`);
};
function d(e, t = !0) {
	if (e.destroyed) throw Error("hash was destroyed");
	if (t && e.finished) throw Error("digest() was already called");
}
function f(e, t) {
	c(e, void 0, "output");
	let n = t.outputLen;
	if (!(e.length >= n)) throw RangeError("\"output\" expected length >= " + n);
}
function p(e) {
	return new Uint32Array(e.buffer, e.byteOffset, Math.floor(e.byteLength / 4));
}
function m(...e) {
	for (let t = 0; t < e.length; t++) e[t].fill(0);
}
var h = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
function g(e) {
	return e << 24 & 4278190080 | e << 8 & 16711680 | e >>> 8 & 65280 | e >>> 24 & 255;
}
function _(e) {
	for (let t = 0; t < e.length; t++) e[t] = g(e[t]);
	return e;
}
var v = h ? (e) => e : _;
function y(e, t, n = "opts") {
	return u(e, "defaults"), t !== void 0 && u(t, n), Object.assign(Object.create(null), e, t);
}
function b(e, t = {}) {
	if (typeof e != "function") throw TypeError("\"hashCons\" expected function, got type=" + typeof e);
	t = y({}, t, "info");
	let n = (t, n) => e(n).update(t).digest(), r = e(void 0);
	return n.outputLen = r.outputLen, n.blockLen = r.blockLen, n.canXOF = r.canXOF, n.create = (t) => e(t), Object.assign(n, t), Object.freeze(n);
}
function ee(e = 32) {
	o(e, "bytesLength");
	let t = typeof globalThis == "object" ? globalThis.crypto : null;
	if (typeof t?.getRandomValues != "function") throw Error("crypto.getRandomValues must be defined");
	if (e > 65536) throw RangeError(`"bytesLength" expected <= 65536, got ${e}`);
	return t.getRandomValues(new Uint8Array(e));
}
var x = (e) => ({ oid: Uint8Array.from([
	6,
	9,
	96,
	134,
	72,
	1,
	101,
	3,
	4,
	2,
	e
]) }), te = BigInt(0), S = BigInt(1), ne = BigInt(2), re = BigInt(7), ie = BigInt(256), ae = BigInt(113), oe = [], se = [], ce = [];
for (let e = 0, t = S, n = 1, r = 0; e < 24; e++) {
	[n, r] = [r, (2 * n + 3 * r) % 5], oe.push(2 * (5 * r + n)), se.push((e + 1) * (e + 2) / 2 % 64);
	let i = te;
	for (let e = 0; e < 7; e++) t = (t << S ^ (t >> re) * ae) % ie, t & ne && (i ^= S << (S << BigInt(e)) - S);
	ce.push(i);
}
var le = r(ce, !0), ue = le[0], de = le[1], fe = (e, t, n) => e << n | t >>> 32 - n, pe = (e, t, n) => t << n | e >>> 32 - n, me = (e, t, n) => t << n - 32 | e >>> 64 - n, he = (e, t, n) => e << n - 32 | t >>> 64 - n, ge = (e, t, n) => n > 32 ? me(e, t, n) : fe(e, t, n), _e = (e, t, n) => n > 32 ? he(e, t, n) : pe(e, t, n), C = /* @__PURE__ */ new Uint32Array(10);
function ve(e, t = 24) {
	if (!(e instanceof Uint32Array)) throw TypeError("\"s\" expected Uint32Array(50), got type=" + typeof e);
	if (e.length !== 50) throw RangeError("\"s\" expected Uint32Array(50), got length=" + e.length);
	if (o(t, "rounds"), t < 1 || t > 24) throw Error("\"rounds\" expected integer 1..24");
	for (let n = 24 - t; n < 24; n++) {
		for (let t = 0; t < 10; t++) C[t] = e[t] ^ e[t + 10] ^ e[t + 20] ^ e[t + 30] ^ e[t + 40];
		for (let t = 0; t < 10; t += 2) {
			let n = (t + 8) % 10, r = (t + 2) % 10, i = C[r], a = C[r + 1], o = ge(i, a, 1) ^ C[n], s = _e(i, a, 1) ^ C[n + 1];
			for (let n = 0; n < 50; n += 10) e[t + n] ^= o, e[t + n + 1] ^= s;
		}
		let t = e[2], r = e[3];
		for (let n = 0; n < 24; n++) {
			let i = se[n], a = ge(t, r, i), o = _e(t, r, i), s = oe[n];
			t = e[s], r = e[s + 1], e[s] = a, e[s + 1] = o;
		}
		for (let t = 0; t < 50; t += 10) {
			let n = e[t], r = e[t + 1], i = e[t + 2], a = e[t + 3];
			e[t] ^= ~e[t + 2] & e[t + 4], e[t + 1] ^= ~e[t + 3] & e[t + 5], e[t + 2] ^= ~e[t + 4] & e[t + 6], e[t + 3] ^= ~e[t + 5] & e[t + 7], e[t + 4] ^= ~e[t + 6] & e[t + 8], e[t + 5] ^= ~e[t + 7] & e[t + 9], e[t + 6] ^= ~e[t + 8] & n, e[t + 7] ^= ~e[t + 9] & r, e[t + 8] ^= ~n & i, e[t + 9] ^= ~r & a;
		}
		e[0] ^= ue[n], e[1] ^= de[n];
	}
	m(C);
}
var w = class e {
	state;
	pos = 0;
	posOut = 0;
	finished = !1;
	state32;
	destroyed = !1;
	blockLen;
	suffix;
	outputLen;
	canXOF;
	enableXOF = !1;
	rounds;
	constructor(e, t, n, r = !1, i = 24) {
		if (o(e, "blockLen"), o(t, "suffix"), o(i, "rounds"), s(r, "enableXOF"), this.blockLen = e, this.suffix = t, this.outputLen = n, this.enableXOF = r, this.canXOF = r, this.rounds = i, o(n, "outputLen"), !(0 < e && e < 200)) throw Error("\"blockLen\" must be 1..199");
		this.state = /* @__PURE__ */ new Uint8Array(200), this.state32 = p(this.state);
	}
	clone() {
		return this._cloneInto();
	}
	keccak() {
		v(this.state32), ve(this.state32, this.rounds), v(this.state32), this.posOut = 0, this.pos = 0;
	}
	update(e) {
		d(this), c(e);
		let { blockLen: t, state: n, state32: r } = this, i = e.length, a = t % 4 == 0 && e.byteOffset % 4 == 0, o = t / 4, s = a && i >= t ? p(e) : void 0;
		for (let a = 0; a < i;) {
			if (s !== void 0 && this.pos === 0 && a % 4 == 0 && i - a >= t) {
				for (let e = 0, t = a / 4; e < o; e++) r[e] ^= s[t + e];
				a += t, this.pos = t, this.keccak();
				continue;
			}
			let c = Math.min(t - this.pos, i - a);
			for (let t = 0; t < c; t++) n[this.pos++] ^= e[a++];
			this.pos === t && this.keccak();
		}
		return this;
	}
	finish() {
		if (this.finished) return;
		this.finished = !0;
		let { state: e, suffix: t, pos: n, blockLen: r } = this;
		e[n] ^= t, t & 128 && n === r - 1 && this.keccak(), e[r - 1] ^= 128, this.keccak();
	}
	writeInto(e) {
		d(this, !1), c(e), this.finish();
		let t = this.state, { blockLen: n } = this;
		for (let r = 0, i = e.length; r < i;) {
			this.posOut >= n && this.keccak();
			let a = Math.min(n - this.posOut, i - r);
			e.set(t.subarray(this.posOut, this.posOut + a), r), this.posOut += a, r += a;
		}
		return e;
	}
	xofInto(e) {
		if (!this.enableXOF) throw Error("XOF is not enabled");
		return this.writeInto(e);
	}
	xof(e) {
		return o(e), this.xofInto(new Uint8Array(e));
	}
	digestInto(e) {
		if (f(e, this), this.finished) throw Error("digest() was already called");
		this.writeInto(e.length === this.outputLen ? e : e.subarray(0, this.outputLen)), this.destroy();
	}
	digest() {
		let e = new Uint8Array(this.outputLen);
		return this.digestInto(e), e;
	}
	destroy() {
		this.destroyed = !0, m(this.state);
	}
	_cloneInto(t) {
		let { blockLen: n, suffix: r, outputLen: i, rounds: a, enableXOF: o } = this;
		return t ||= new e(n, r, i, o, a), t.blockLen = n, t.state32.set(this.state32), t.pos = this.pos, t.posOut = this.posOut, t.finished = this.finished, t.rounds = a, t.suffix = r, t.outputLen = i, t.enableXOF = o, t.canXOF = this.canXOF, t.destroyed = this.destroyed, t;
	}
}, T = (e, t, n, r = {}) => b(() => new w(t, e, n), r), ye = /* @__PURE__ */ T(6, 136, 32, /* @__PURE__ */ x(8)), be = /* @__PURE__ */ T(6, 72, 64, /* @__PURE__ */ x(10)), E = (e, t, n, r = {}) => b((r = {}) => (r = y({}, r), new w(t, e, r.dkLen === void 0 ? n : r.dkLen, !0)), r), xe = /* @__PURE__ */ E(31, 168, 16, /* @__PURE__ */ x(11)), D = /* @__PURE__ */ E(31, 136, 32, /* @__PURE__ */ x(12));
//#endregion
//#region node_modules/@noble/curves/utils.js
function O(e, t = "object") {
	if (typeof e != "object" || !e || Array.isArray(e)) throw TypeError(t === "object" ? "expected valid options object" : `"${t}" expected object, got type=${typeof e}`);
	return e;
}
function Se(e, t = {}, n = {}, r = "object") {
	O(e, r), O(t, "fields"), O(n, "optFields");
	function i(t, n, i) {
		let a = r === "object" ? `param "${String(t)}"` : `"${r}.${String(t)}"`, o = e[t];
		if (!Object.hasOwn(e, t) && (i ? o !== void 0 : n !== "function")) throw TypeError(`${a} is invalid: expected own property`);
		if (i && o === void 0) return;
		let s = typeof o;
		if (s !== n || o === null) throw TypeError(`${a} is invalid: expected ${n}, got ${s}`);
	}
	let a = (e, t) => Object.entries(e).forEach(([e, n]) => i(e, n, t));
	a(t, !1), a(n, !0);
}
//#endregion
//#region node_modules/@noble/curves/abstract/fft.js
function k(e, t = "n") {
	if (typeof e != "number") throw TypeError(`wrong u32 integer "${t}": expected number, got type=${typeof e}`);
	if (!Number.isSafeInteger(e) || e < 0 || e > 4294967295) throw RangeError(`wrong u32 integer "${t}": expected 0..4294967295, got ${e}`);
	return e;
}
function A(e) {
	return k(e, "x"), !(e & e - 1) && e !== 0;
}
function j(e, t) {
	if (k(e), typeof t != "number") throw TypeError("\"bits\" expected number, got type=" + typeof t);
	if (!Number.isSafeInteger(t) || t < 0 || t > 32) throw Error(`expected integer 0 <= bits <= 32, got ${t}`);
	let n = 0;
	for (let r = 0; r < t; r++, e >>>= 1) n = n << 1 | e & 1;
	return n >>> 0;
}
function M(e) {
	return k(e), 31 - Math.clz32(e);
}
function N(e) {
	if (!e || typeof e != "object" || typeof e.length != "number") throw TypeError("\"values\" expected array-like, got type=" + typeof e);
	let t = e.length;
	if (!A(t)) throw Error("expected positive power-of-two length, got " + t);
	let n = M(t);
	for (let r = 0; r < t; r++) {
		let t = j(r, n);
		if (r < t) {
			let n = e[r];
			e[r] = e[t], e[t] = n;
		}
	}
	return e;
}
var P = (e, t) => {
	Se(t, {
		N: "number",
		roots: "object",
		dit: "boolean"
	}, {
		invertButterflies: "boolean",
		skipStages: "number",
		brp: "boolean"
	}, "coreOpts");
	let { N: n, roots: r, dit: i, invertButterflies: a = !1, skipStages: o = 0, brp: s = !0 } = t;
	k(n, "coreOpts.N");
	let c = M(n);
	if (!A(n)) throw Error("FFT: Polynomial size should be power of two");
	k(o, "coreOpts.skipStages");
	let l = c === 0 ? 0 : c - 1;
	if (o > l) throw Error(`FFT: wrong skipStages: expected 0 <= skipStages <= ${l}`);
	if (r.length !== n) throw Error(`FFT: wrong roots length: expected ${n}, got ${r.length}`);
	let u = i !== a;
	return (t) => {
		if (t.length !== n) throw Error("FFT: wrong Polynomial length");
		i && s && N(t);
		for (let s = 0, l = 1; s < c - o; s++) {
			let d = i ? s + 1 + o : c - s, f = 1 << d, p = f >> 1, m = n >> d;
			for (let o = 0; o < n; o += f) for (let s = 0, c = l++; s < p; s++) {
				let l = a ? i ? n - c : c : s * m, d = o + s, f = o + s + p, h = r[l], g = t[f], _ = t[d];
				if (u) {
					let n = e.mul(g, h);
					t[d] = e.add(_, n), t[f] = e.sub(_, n);
				} else a ? (t[d] = e.add(g, _), t[f] = e.mul(e.sub(g, _), h)) : (t[d] = e.add(_, g), t[f] = e.mul(e.sub(_, g), h));
			}
		}
		return !i && s && N(t), t;
	};
}, F = c, I = ee;
function Ce(e, t, n = () => {}) {
	if (!Array.isArray(e)) throw TypeError(`"${t}" expected array, got type=${typeof e}`);
	for (let r = 0; r < e.length; r++) n(e[r], `${t}[${r}]`);
	return e;
}
function L(e, t) {
	if (e = c(e), t = c(t), e.length !== t.length) return !1;
	let n = 0;
	for (let r = 0; r < e.length; r++) n |= e[r] ^ t[r];
	return n === 0;
}
function we(e) {
	return new Uint8Array(c(e));
}
function R(e, ...t) {
	let n = (e) => typeof e == "number" ? e : e.bytesLen, r = t.reduce((e, t) => e + n(t), 0);
	return {
		bytesLen: r,
		encode: (i) => {
			let a = new Uint8Array(r);
			for (let r = 0, o = 0; r < t.length; r++) {
				let s = t[r], l = n(s), u = typeof s == "number" ? i[r] : s.encode(i[r]);
				c(u, l, e), a.set(u, o), typeof s != "number" && u.fill(0), o += l;
			}
			return a;
		},
		decode: (i) => {
			c(i, r, e);
			let a = [];
			for (let e of t) {
				let t = n(e), r = i.subarray(0, t);
				a.push(typeof e == "number" ? r : e.decode(r)), i = i.subarray(t);
			}
			return a;
		}
	};
}
function z(e, t) {
	let n = e, r = t * n.bytesLen;
	return {
		bytesLen: r,
		encode: (e) => {
			let i = Ce(e, "u");
			if (i.length !== t) throw RangeError(`vecCoder.encode: wrong length=${i.length}. Expected: ${t}`);
			let a = new Uint8Array(r);
			for (let e = 0, t = 0; e < i.length; e++) {
				let r = n.encode(i[e]);
				a.set(r, t), r.fill(0), t += r.length;
			}
			return a;
		},
		decode: (e) => {
			c(e, r);
			let t = [];
			for (let r = 0; r < e.length; r += n.bytesLen) t.push(n.decode(e.subarray(r, r + n.bytesLen)));
			return t;
		}
	};
}
function B(...e) {
	for (let t of e) if (Array.isArray(t)) for (let e of t) e.fill(0);
	else t.fill(0);
}
function Te(e) {
	if (o(e, "bits"), e > 32) throw RangeError("\"bits\" expected <= 32, got " + e);
	return e === 32 ? 4294967295 : ~(-1 << e) >>> 0;
}
//#endregion
//#region node_modules/@noble/post-quantum/_crystals.js
var Ee = (e) => {
	let { newPoly: t, N: n, Q: r, F: i, ROOT_OF_UNITY: a, brvBits: o, isKyber: s } = e, c = (e, t = r) => {
		let n = e % t | 0;
		return (n >= 0 ? n | 0 : t + n | 0) | 0;
	}, l = (e, t = r) => {
		let n = c(e, t) | 0;
		return (n > t >> 1 ? n - t | 0 : n) | 0;
	};
	function u() {
		let e = t(n);
		for (let t = 0; t < n; t++) {
			let n = j(t, o), i = BigInt(a) ** BigInt(n) % BigInt(r);
			e[t] = Number(i) | 0;
		}
		return e;
	}
	let d = u(), f = (e) => {
		throw Error("not implemented");
	}, p = s ? {
		add: (e, t) => {
			let n = e + t | 0;
			return n >= r ? n - r | 0 : n;
		},
		sub: (e, t) => {
			let n = e - t | 0;
			return n < 0 ? n + r | 0 : n;
		},
		mul: (e, t) => c((e | 0) * (t | 0)) | 0,
		inv: f
	} : {
		add: (e, t) => c((e | 0) + (t | 0)) | 0,
		sub: (e, t) => c((e | 0) - (t | 0)) | 0,
		mul: (e, t) => c((e | 0) * (t | 0)) | 0,
		inv: f
	}, m = {
		N: n,
		roots: d,
		invertButterflies: !0,
		skipStages: +!!s,
		brp: !1
	}, h = P(p, {
		dit: !1,
		...m
	}), g = P(p, {
		dit: !0,
		...m
	}), _ = {
		encode: (e) => h(e),
		decode: (e) => {
			g(e);
			for (let t = 0; t < e.length; t++) e[t] = c(i * e[t]);
			return e;
		}
	};
	return {
		mod: c,
		smod: l,
		nttZetas: d,
		NTT: {
			encode: (e) => _.encode(e),
			decode: (e) => _.decode(e)
		},
		bitsCoder: (e, r) => {
			for (let t = 0, r = 0; t < n; t++) r += e, r > 32 && Te(r), r %= 8;
			let i = Te(e), a = n / 8 * e;
			return {
				bytesLen: a,
				encode: (t) => {
					let n = t, o = new Uint8Array(a);
					for (let t = 0, a = 0, s = 0, c = 0; t < n.length; t++) for (a |= (r.encode(n[t]) & i) << s, s += e; s >= 8; s -= 8, a >>= 8) o[c++] = a & 255;
					return o;
				},
				decode: (a) => {
					let o = t(n);
					for (let t = 0, n = 0, s = 0, c = 0; t < a.length; t++) for (n |= a[t] << s, s += 8; s >= e; s -= e, n >>= e) o[c++] = r.decode(n & i);
					return o;
				}
			};
		}
	};
}, De = /* @__PURE__ */ ((e) => (t, n) => {
	n ||= e.blockLen;
	let r = new Uint8Array(t.length + 2);
	r.set(t);
	let i = t.length, a = new Uint8Array(n), o = e.create({}), s = 0, c = 0;
	return {
		stats: () => ({
			calls: s,
			xofs: c
		}),
		get: (t, n) => (r[i + 0] = t, r[i + 1] = n, o.destroy(), o = e.create({}).update(r), s++, () => (c++, o.xofInto(a))),
		clean: () => {
			o.destroy(), B(a, r);
		}
	};
})(xe), V = 256, H = 3329, U = /* @__PURE__ */ Ee({
	N: V,
	Q: H,
	F: 3303,
	ROOT_OF_UNITY: 17,
	newPoly: (e) => new Uint16Array(e),
	brvBits: 7,
	isKyber: !0
}), Oe = /* @__PURE__ */ Object.freeze({
	512: Object.freeze({
		N: V,
		Q: H,
		K: 2,
		ETA1: 3,
		ETA2: 2,
		du: 10,
		dv: 4,
		RBGstrength: 128
	}),
	768: Object.freeze({
		N: V,
		Q: H,
		K: 3,
		ETA1: 2,
		ETA2: 2,
		du: 10,
		dv: 4,
		RBGstrength: 192
	}),
	1024: Object.freeze({
		N: V,
		Q: H,
		K: 4,
		ETA1: 2,
		ETA2: 2,
		du: 11,
		dv: 5,
		RBGstrength: 256
	})
}), ke = (e) => {
	if (e >= 12) return {
		encode: (e) => e,
		decode: (e) => e >= H ? e - H : e
	};
	let t = 2 ** (e - 1);
	return {
		encode: (t) => ((t << e) + H / 2) / H,
		decode: (n) => n * H + t >>> e
	};
}, Ae = (e) => U.bitsCoder(e, e === 12 ? {
	encode: (e) => e,
	decode: (e) => e >= H ? e - H : e
} : {
	encode: (e) => e,
	decode: (e) => e
}), W = (e) => e === 12 ? Ae(12) : U.bitsCoder(e, ke(e));
function G(e, t) {
	let n = e, r = t;
	for (let e = 0; e < V; e++) {
		let t = n[e] + r[e];
		n[e] = t >= H ? t - H : t;
	}
}
function je(e, t) {
	let n = e, r = t;
	for (let e = 0; e < V; e++) {
		let t = n[e] - r[e];
		n[e] = t < 0 ? t + H : t;
	}
}
function Me(e, t, n, r, i) {
	return {
		c0: U.mod(U.mod(t * r) * i + e * n),
		c1: U.mod(e * r + t * n)
	};
}
function K(e, t) {
	let n = e, r = t;
	for (let e = 0; e < V / 2; e++) {
		let t = U.nttZetas[64 + (e >> 1)];
		e & 1 && (t = -t);
		let { c0: i, c1: a } = Me(n[2 * e + 0], n[2 * e + 1], r[2 * e + 0], r[2 * e + 1], t);
		n[2 * e + 0] = i, n[2 * e + 1] = a;
	}
	return n;
}
function q(e) {
	let t = e, n = new Uint16Array(V);
	for (let e = 0; e < V;) {
		let r = t();
		if (r.length % 3) throw Error("SampleNTT: unaligned block");
		for (let t = 0; e < V && t + 3 <= r.length; t += 3) {
			let i = (r[t + 0] | 0 | r[t + 1] << 8) & 4095, a = (r[t + 1] >> 4 | r[t + 2] << 4) & 4095;
			i < H && (n[e++] = i), e < V && a < H && (n[e++] = a);
		}
	}
	return n;
}
var Ne = (e, t) => {
	let n = new Uint16Array(V), r = p(e);
	v(r);
	let i = 0;
	for (let e = 0, a = 0, o = 0, s = 0; e < r.length; e++) {
		let c = r[e];
		for (let e = 0; e < 32; e++) o += c & 1, c >>= 1, i += 1, i === t ? (s = o, o = 0) : i === 2 * t && (n[a++] = U.mod(s - o), o = 0, i = 0);
	}
	if (v(r), i) throw Error(`sampleCBD: leftover bits: ${i}`);
	return n;
};
function J(e, t, n, r) {
	return Ne(e(r * V / 4, t, n), r);
}
var Pe = (e) => {
	let { K: t, PRF: n, XOF: r, HASH512: i, ETA1: a, ETA2: o, du: s, dv: c } = e, l = W(1), u = W(c), d = W(s), f = R("publicKey", z(W(12), t), 32), p = z(W(12), t), m = R("ciphertext", z(d, t), u), h = R("seed", 32, 32), g = (e, r, i, s) => {
		let c = [];
		for (let e = 0; e < t; e++) c.push(U.NTT.encode(J(n, s, e, a)));
		let u = new Uint16Array(V), d = [];
		for (let i = 0; i < t; i++) {
			let a = J(n, s, t + i, o), l = new Uint16Array(V);
			for (let e = 0; e < t; e++) G(l, K(r(i, e), c[e]));
			G(a, U.NTT.decode(l)), d.push(a), G(u, K(e[i], c[i])), B(l);
		}
		let f = J(n, s, 2 * t, o);
		G(f, U.NTT.decode(u));
		let p = l.decode(i);
		return G(p, f), B(e, c, u, f), m.encode([d, p]);
	};
	return {
		secretCoder: p,
		lengths: {
			secretKey: p.bytesLen,
			publicKey: f.bytesLen,
			cipherText: m.bytesLen
		},
		keygen: (e) => {
			F(e, 32, "seed");
			let o = /* @__PURE__ */ new Uint8Array(33);
			o.set(e), o[32] = t;
			let s = i(o), [c, l] = h.decode(s), u = [], d = [];
			for (let e = 0; e < t; e++) u.push(U.NTT.encode(J(n, l, e, a)));
			let m = r(c);
			for (let e = 0; e < t; e++) {
				let r = U.NTT.encode(J(n, l, t + e, a));
				for (let n = 0; n < t; n++) G(r, K(q(m.get(n, e)), u[n]));
				d.push(r);
			}
			m.clean();
			let g = {
				publicKey: f.encode([d, c]),
				secretKey: p.encode(u)
			};
			return B(c, l, u, d, o, s), g;
		},
		encrypt: (e, t, n) => {
			let [i, a] = f.decode(e), o = r(a), s = g(i, (e, t) => q(o.get(e, t)), t, n);
			return o.clean(), s;
		},
		prepare: (e) => {
			let [n, i] = f.decode(e), a = r(i), o = [];
			for (let e = 0; e < t; e++) for (let n = 0; n < t; n++) o.push(q(a.get(e, n)));
			return a.clean(), {
				encrypt: (e, r) => g(n.map((e) => e.slice()), (e, n) => o[e * t + n].slice(), e, r),
				clean: () => B(n, o)
			};
		},
		decrypt: (e, n) => {
			let [r, i] = m.decode(e), a = p.decode(n), o = new Uint16Array(V);
			for (let e = 0; e < t; e++) G(o, K(a[e], U.NTT.encode(r[e])));
			je(i, U.NTT.decode(o));
			let s = l.encode(i);
			return B(o, a, r, i), s;
		}
	};
};
function Fe(e) {
	let t = e, n = Pe(t), { HASH256: r, HASH512: i, KDF: a } = t, { secretCoder: o, lengths: s } = n, c = R("secretKey", s.secretKey, s.publicKey, 32, 32), l = (e, n) => {
		let r = e.subarray(0, 384 * t.K), i = o.encode(o.decode(we(r))), a = L(i, r);
		if (B(i), !a) throw Error(`ML-KEM.${n}: wrong publicKey modulus`);
	}, u = Object.freeze({
		...s,
		seed: 64,
		msg: 32,
		msgRand: 32,
		secretKey: c.bytesLen
	});
	return Object.freeze({
		info: Object.freeze({ type: "ml-kem" }),
		lengths: u,
		keygen: (e) => {
			let t = e === void 0, i = t ? I(64) : e, a, o;
			try {
				F(i, 64, "seed");
				let e = n.keygen(i.subarray(0, 32)), t = e.publicKey;
				return a = e.secretKey, o = r(t), {
					publicKey: t,
					secretKey: c.encode([
						a,
						t,
						o,
						i.subarray(32)
					])
				};
			} finally {
				a !== void 0 && B(a), o !== void 0 && B(o), t && B(i);
			}
		},
		getPublicKey: (e) => {
			let [t, n, r, i] = c.decode(e);
			return Uint8Array.from(n);
		},
		encapsulate: (e, t) => {
			let a = t === void 0, o = a ? I(32) : t, c;
			try {
				return F(e, s.publicKey, "publicKey"), F(o, 32, "message"), l(e, "encapsulate"), c = i.create().update(o).update(r(e)).digest(), {
					cipherText: n.encrypt(e, o, c.subarray(32, 64)),
					sharedSecret: c.subarray(0, 32)
				};
			} finally {
				c !== void 0 && B(c.subarray(32)), a && B(o);
			}
		},
		decapsulate: (e, t) => {
			F(t, c.bytesLen, "secretKey"), F(e, s.cipherText, "cipherText");
			let o = c.bytesLen - 96, l = o + 32;
			if (!L(r(t.subarray(o / 2, l)), t.subarray(l, l + 32))) throw Error("invalid secretKey: hash check failed");
			let [u, d, f, p] = c.decode(t), m = n.decrypt(e, u), h = i.create().update(m).update(f).digest(), g = h.subarray(0, 32), _ = n.encrypt(d, m, h.subarray(32, 64)), v = L(e, _), y = a.create({ dkLen: 32 }).update(p).update(e).digest();
			return B(m, _, h.subarray(32), v ? y : g), v ? g : y;
		},
		prepare: (e) => {
			F(e, s.publicKey, "publicKey"), l(e, "prepare");
			let t = we(e), o = r(t), u = n.prepare(t);
			return Object.freeze({
				publicKey: t,
				encapsulate: (e) => {
					let t = e === void 0, n = t ? I(32) : e, r;
					try {
						return F(n, 32, "message"), r = i.create().update(n).update(o).digest(), {
							cipherText: u.encrypt(n, r.subarray(32, 64)),
							sharedSecret: r.subarray(0, 32)
						};
					} finally {
						r !== void 0 && B(r.subarray(32)), t && B(n);
					}
				},
				decapsulate: (e, r) => {
					F(r, c.bytesLen, "secretKey"), F(e, s.cipherText, "cipherText");
					let [l, d, f, p] = c.decode(r);
					if (!L(d, t) || !L(f, o)) throw Error("ML-KEM.decapsulate: secretKey does not match prepared publicKey");
					let m = n.decrypt(e, l), h = i.create().update(m).update(o).digest(), g = h.subarray(0, 32), _ = u.encrypt(m, h.subarray(32, 64)), v = L(e, _), y = a.create({ dkLen: 32 }).update(p).update(e).digest();
					return B(m, _, h.subarray(32), v ? y : g), v ? g : y;
				},
				clean: u.clean
			});
		}
	});
}
function Ie(e, t, n) {
	return D.create({ dkLen: e }).update(t).update(new Uint8Array([n])).digest();
}
var Le = {
	HASH256: ye,
	HASH512: be,
	KDF: D,
	XOF: De,
	PRF: Ie
}, Y = /* @__PURE__ */ ((e) => Fe({
	...Le,
	...e
}))(Oe[768]), Re = "pqc-chat-db", X = "keys", ze = 2, Be = 6e5, Ve = "ML-KEM-768+AES-256-GCM";
function He() {
	let e = document.body?.dataset?.username;
	if (!e) throw Error("Username is missing. Add data-username to the conversation page.");
	return `ml-kem-768-${encodeURIComponent(e)}`;
}
function Z(e) {
	let t = "", n = 32768;
	for (let r = 0; r < e.length; r += n) t += String.fromCharCode(...e.subarray(r, r + n));
	return btoa(t);
}
function Q(e) {
	let t = atob(e), n = new Uint8Array(t.length);
	for (let e = 0; e < t.length; e++) n[e] = t.charCodeAt(e);
	return n;
}
function Ue() {
	return new Promise((e, t) => {
		let n = indexedDB.open(Re, 1);
		n.onupgradeneeded = () => {
			let e = n.result;
			e.objectStoreNames.contains(X) || e.createObjectStore(X, { keyPath: "id" });
		}, n.onsuccess = () => e(n.result), n.onerror = () => t(n.error);
	});
}
async function We() {
	let e = await Ue();
	return new Promise((t, n) => {
		let r = e.transaction(X, "readonly").objectStore(X).get(He());
		r.onsuccess = () => {
			t(r.result || null), e.close();
		}, r.onerror = () => {
			n(r.error), e.close();
		};
	});
}
async function Ge(e) {
	let t = await Ue();
	return new Promise((n, r) => {
		let i = t.transaction(X, "readwrite");
		i.objectStore(X).put(e), i.oncomplete = () => {
			t.close(), n();
		}, i.onerror = () => {
			t.close(), r(i.error);
		}, i.onabort = () => {
			t.close(), r(i.error || /* @__PURE__ */ Error("Key storage transaction aborted."));
		};
	});
}
async function Ke(e, t) {
	let n = await crypto.subtle.importKey("raw", new TextEncoder().encode(e), "PBKDF2", !1, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "PBKDF2",
		salt: t,
		iterations: Be,
		hash: "SHA-256"
	}, n, {
		name: "AES-GCM",
		length: 256
	}, !1, ["encrypt", "decrypt"]);
}
async function qe(e, t, n) {
	let r = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16)), i = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(12)), a = await Ke(t, r), o = await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: i
	}, a, e);
	return {
		id: He(),
		algorithm: "ML-KEM-768",
		publicKey: Z(n),
		encryptedSecretKey: Z(new Uint8Array(o)),
		salt: Z(r),
		iv: Z(i),
		storageVersion: ze
	};
}
async function Je(e, t) {
	if (e.storageVersion !== ze || !e.encryptedSecretKey || !e.publicKey || !e.salt || !e.iv) throw Error("Stored key record has an unsupported format.");
	let n = Q(e.salt), r = Q(e.iv), i = Q(e.encryptedSecretKey), a = await Ke(t, n), o = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: r
	}, a, i);
	return {
		publicKey: Q(e.publicKey),
		secretKey: new Uint8Array(o)
	};
}
async function Ye(e) {
	if (typeof e != "string" || e.length < 12) throw Error("Use a passphrase with at least 12 characters.");
	let t = await We();
	if (t) {
		let n = await Je(t, e);
		return console.log("Existing ML-KEM-768 key unlocked."), n;
	}
	let n = Y.keygen(), r = new Uint8Array(n.publicKey), i = new Uint8Array(n.secretKey);
	if (r.length !== 1184 || i.length !== 2400) throw Error("Unexpected ML-KEM-768 key sizes.");
	return await Ge(await qe(i, e, r)), console.log("New ML-KEM-768 key pair generated and stored."), {
		publicKey: r,
		secretKey: i
	};
}
function Xe() {
	let e = Y.keygen();
	if (e.publicKey.length !== 1184 || e.secretKey.length !== 2400) throw Error("ML-KEM-768 key-size test failed.");
	console.log("ML-KEM-768 key-generation test passed.");
}
function Ze() {
	let e = Y.keygen(), t = Y.encapsulate(e.publicKey), n = Y.decapsulate(t.cipherText, e.secretKey);
	if (!(t.sharedSecret.length === n.length && t.sharedSecret.every((e, t) => e === n[t]))) throw Error("KEM shared-secret exchange test failed.");
	console.log("ML-KEM-768 KEM exchange test passed.");
}
async function $(e, t) {
	let n = await crypto.subtle.importKey("raw", e, "HKDF", !1, ["deriveKey"]);
	return crypto.subtle.deriveKey({
		name: "HKDF",
		hash: "SHA-256",
		salt: t,
		info: new TextEncoder().encode("PQC-Chat message encryption v1")
	}, n, {
		name: "AES-GCM",
		length: 256
	}, !1, ["encrypt", "decrypt"]);
}
async function Qe() {
	let e = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(32)), t = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16)), n = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(12)), r = await $(e, t), i = "PQC encryption test", a = await crypto.subtle.encrypt({
		name: "AES-GCM",
		iv: n
	}, r, new TextEncoder().encode(i)), o = await crypto.subtle.decrypt({
		name: "AES-GCM",
		iv: n
	}, r, a);
	if (new TextDecoder().decode(o) !== i) throw Error("AES-GCM message encryption test failed.");
	console.log("AES-GCM encryption/decryption test passed.");
}
async function $e(e, t) {
	if (typeof t != "string" || !t.trim()) throw Error("Enter a message before sending.");
	let n = Q(e);
	if (n.length !== 1184) throw Error("Recipient ML-KEM-768 public key is invalid.");
	let r = Y.encapsulate(n), i = new Uint8Array(r.sharedSecret);
	try {
		let e = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16)), n = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(12)), a = await $(i, e), o = await crypto.subtle.encrypt({
			name: "AES-GCM",
			iv: n
		}, a, new TextEncoder().encode(t));
		return {
			algorithm: Ve,
			kem_ciphertext: Z(new Uint8Array(r.cipherText)),
			salt: Z(e),
			nonce: Z(n),
			ciphertext: Z(new Uint8Array(o))
		};
	} finally {
		i.fill(0);
	}
}
async function et(e, t) {
	if (t.algorithm !== Ve) throw Error("Unsupported message encryption algorithm.");
	let n = Q(t.kem_ciphertext), r = Q(t.salt), i = Q(t.nonce), a = Q(t.ciphertext);
	if (n.length !== 1088) throw Error("Invalid ML-KEM ciphertext length.");
	if (r.length !== 16 || i.length !== 12) throw Error("Invalid message encryption parameters.");
	let o = new Uint8Array(Y.decapsulate(n, e));
	try {
		let e = await $(o, r), t = await crypto.subtle.decrypt({
			name: "AES-GCM",
			iv: i
		}, e, a);
		return new TextDecoder().decode(t);
	} finally {
		o.fill(0);
	}
}
//#endregion
export { et as decryptMessage, $e as encryptMessage, Ye as getOrCreatePqcKeyPair, Ze as testKemExchange, Qe as testMessageEncryption, Xe as testPqcLibrary };
