const worker = require("node:worker_threads");
const stream = require("node:stream");

if (worker.isMainThread) {

	const cache = {};

	// optimize
	module.exports = function modernize({ opts, data }, next){
		const debug = this.lib.debug;
		const load = this.lib.load;

		if (!cache.optipng) cache.optipng = load.exists("optipng-js");
		if (!cache.mozjpeg) cache.mozjpeg = load.exists("js-mozjpeg");

		if (!cache.hasOwnProperty(data.map)) cache[data.map] = {
			png: (!opts.png) ? false : (opts.png === true) ? {} : opts.png,
			jpeg: (!opts.jpeg) ? false : (opts.jpeg === true) ? {} : opts.jpeg,
		};
		opts = cache[data.map];

		const jobs = [];

		// find all pngs
		if (opts.png && cache.optipng) /*[ data.tile, ...data.tiles ]*/data.tiles.filter(function(tile){
			return (tile.type === "png" && !tile.compression && tile.buffer.length > 0) // uncompressed png only
		}).forEach(function(tile){
			jobs.push(new Promise(function(resolve,reject){

				// create png worker
				const w = new worker.Worker(__filename, {
					workerData: { type: "png", opts: opts.png },
					stdin: true, stdout: true,
				});

				// get result from worker
				let result = [];
				w.stdout.on("data", function(chunk){
					result.push(chunk);
				}).on("end", function(){
					result = Buffer.concat(result);
					if (result && result.length > 0 && result.length < tile.buffer.length) {
						debug.info("Optimized PNG '%s': -%db", tile.path.magenta, tile.buffer.length-result.length);
						tile.buffer = result;
					}
					resolve();
				});

				// stream buffer to worker
				stream.Readable.from(tile.buffer).pipe(w.stdin);

			}));
		});

		// find all jpegs
		if (opts.jpeg && cache.mozjpeg) [ data.tile, ...data.tiles ].filter(function(tile){
			return ((tile.type === "jpeg" || tile.type === "jpg") && !tile.compression && tile.buffer.length > 0) // uncompressed jpeg only
		}).forEach(function(tile){
			jobs.push(new Promise(function(resolve,reject){

				// create jpeg worker
				const w = new worker.Worker(__filename, {
					workerData: { type: "jpeg", opts: opts.jpeg },
					stdin: true, stdout: true,
				});

				// get result from worker
				let result = [];
				w.stdout.on("data", function(chunk){
					result.push(chunk);
				}).on("end", function(){
					result = Buffer.concat(result);
					if (result && result.length > 0 && result.length < tile.buffer.length) {
						debug.info("Optimized JPEG '%s': -%db", tile.path.magenta, tile.buffer.length-result.length);
						tile.buffer = result;
					}
					resolve();
				});

				// stream buffer to worker
				stream.Readable.from(tile.buffer).pipe(w.stdin);

			}));
		});

		// check if there are jobs
		if (jobs.length === 0) return debug.warn("Nothing to optimize for '%s': -%db", data.tile.path.magenta), next();

		// execute
		Promise.allSettled(jobs).then(function(){
			next();
		});

	};

} else {
	let buf = [];
	process.stdin.on("data", function(chunk){
		buf.push(chunk);
	}).on("end", function() {
		buf = Buffer.concat(buf);
		if (buf.length > 0) switch (worker.workerData.type) {
			case "png":
				const optipng = require("optipng-js");
				const outputpng = optipng(buf, { o: "3", i: "0", fix: true, quiet: true, ...worker.workerData.opts });
				if (outputpng.data && outputpng.data.length > 0 && outputpng.data.length < buf.length) buf = Buffer.from(outputpng.data);
			break;
			case "jpg":
			case "jpeg":
				const jpegtran = require("js-mozjpeg").jpegtran;
				const outputjpeg = jpegtran(buf, { optimize: true, maxmemory: "4m", copy: "none", ...(worker.workerData.opts||{}) });
				if (outputjpeg.data && outputjpeg.data.length > 0 && outputjpeg.data.length < buf.length) buf = Buffer.from(outputjpeg.data);
			break;
		};

		stream.Readable.from(buf).pipe(process.stdout);
	});

};