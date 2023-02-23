// store files to disk, use xattr to keep metadata

const fs = require("fs");
const dur = require("dur");
const path = require("path");
const xattr = require("fs-xattr");
const rfc822date = require("./rfc822date");

const store = module.exports = function store({ root }){
	if (!(this instanceof store)) return new store(...arguments);

	this.root = path.resolve(process.cwd(), root);
	this.cache = {}; // FIXME use lru cache

	return this;
};

// find best file on disk
store.prototype.find = function(file, extensions, fn){
	const self = this;

	// find all files in question
	Promise.allSettled([ "", ...extensions.map(function(e){
		return e[0] === "." ? e : "."+e;
	})].map(function(ext){
		return new Promise(function(resolve, reject){
			const filepath = path.join(self.root, file+ext);
			fs.stat(filepath, function(err, stats){
				if (err) reject();
				// get extended attributes
				xattr.get(filepath, "user.tileblaster").then(function(attr){

					try {
						attr = JSON.parse(attr);
					} catch (err) {
						return reject(err);
					}

					// check if expired
					if (attr.expires && (attr.expires === true || attr.expires < Date.now())) return reject();

					resolve({
						file: filepath,
						stats: stats,
						attr: attr,
					});

				}).catch(function(err){
					reject(err);
				});
			})
		});
	})).then(function(found){

		// extract
		found = found.filter(function(f){
			return f.status === "fulfilled";
		}).map(function(f){
			return f.value;
		})

		switch (found.length) {
			case 0: return fn(null, null); break;
			case 1: return fn(null, found[0]); break;
			default:
				// find the smallest size
				return fn(null, Array.from(found).sort(function(a,b){
					return a.stats.size - b.stats.size;
				}).shift());
			break;
		}
	});

	return this;
};

// store file and attributes to disk
store.prototype.put = function(tile, fn){
	const self = this;

	const destfile = path.join(self.root, tile.path);
	const tmpfile = destfile+".tmp";

	// FIXME check if exists and still valid?

	// ensure dest dir
	fs.mkdir(path.dirname(tmpfile), { recursive: true }, function(err){
		if (err) return fn(err);

		// write tmp file
		fs.writeFile(tmpfile, tile.buffer, function(err){
			if (err) return fn(err);

			// set etag and rfc822-date
			fs.stat(tmpfile, function(err, stats){
				tile.headers.etag = '"'+Math.floor(stats.mtimeMs/1000).toString(16)+'-'+(stats.size).toString(16)+'"';
				tile.headers["last-modified"] = rfc822date(stats.mtime);

				// store anything but buffer in xattr
				const attr = Object.entries(tile).reduce(function(attr, [ k, v ]){
					if (k !== "buffer") attr[k] = v;
					return attr;
				},{});

				// set attributes
				xattr.set(tmpfile, "user.tileblaster", JSON.stringify(attr)).then(function(){

					// switch tmp → file
					fs.rename(tmpfile, destfile, function(err){
						if (err) return fn(err), fs.unlink(tmpfile, function(){}); // attempt unlinking, no feedback
						fn(null);

					});

				}).catch(function(err){
					return fn(err);
				});

			});

		});

	});

	return this;
};
