const zlib = require("zlib");
const load = require("../lib/load");

const lzma = load("node-liblzma");
const zstd = load("fzstd");

const decompress = module.exports = function decompress(buf, compression, fn){

	// promisify
	if (!fn || typeof fn !== "function") return new Promise(function(resolve, reject){
		decompress(buf, compression, function(err, buf){
			if (err) return reject(err);
			return resolve(buf);
		});
	});

	switch (compression) {
		case "gzip":
		case "gz":
			zlib.gunzip(buf, fn);
		break;
		case "brotli":
		case "br":
			zlib.brotliDecompress(buf, fn);
		break;
		case "inflate":
		case "deflate":
			zlib.inflate(buf, fn);
		break;
		case "lzma":
		case "xz":
			if (!lzma) return fn(new Error("Missing optional dependency: 'node-liblzma'"));
			lzma.unxz(buf, fn);
		break;
		case "zstd":
			if (!zstd) return fn(new Error("Missing optional dependency: 'fzstd'"));
			try {
				fn(null, fzstd.decompress(buf));
			} catch (err) {
				fn(err);
			}
		break;
		default: return fn(null, buf); // pass through if unknown
	}
};