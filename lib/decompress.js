const zlib = require("zlib");

const lzma = require("node-liblzma");
const zstd = require("fzstd");

const decompress = module.exports = function decompress(buf, compression, fn){
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
			lzma.unxz(buf, fn);
		break;
		case "zstd":
			try {
				fn(null, fzstd.decompress(buf));
			} catch (err) {
				fn(err);
			}
		break;
		default: return fn(null, buf); // pass through if unknown

	}
};