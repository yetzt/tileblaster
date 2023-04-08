// purge cache cache

const worker = require("node:worker_threads");

if (worker.isMainThread) {

	const debug = require("./debug");

	const purge = module.exports = function purge(){

		// create cleanup worker
		const debug = require("./debug");
		debug.info("Creating Purge Worker");
		new worker.Worker(__filename, {
			argv: process.argv.slice(2),
			env: process.env
		}).on("message", function(message){
			if (message.hasOwnProperty("purged")) debug.info("Purged %d files", message.purged);
		}).unref();

	};

	// run cleanup if called directly
	if (require.main === module) purge();

} else { // cleanup worker

	const dur = require("dur");
	const config = require("./config");
	const klaw = require("klaw");
	const path = require("node:path");
	const fs = require("node:fs");

	// determine paths
	if (!config.paths) config.paths = {};
	if (!config.paths.work) config.paths.work = path.resolve(os.homedir(), "tileblaster");
	if (!config.paths.data) config.paths.data = path.resolve(config.paths.work, "data");

	const caches = Object.entries(config.maps).reduce(function(caches,[map,tasks]){

		// find cache config fore map
		let cache = tasks.find(function(task){
			return task.builtin === "cache" && task.hasOwnProperty("expires");
		});

		// no cache here
		if (!cache) return caches;

		// parse expires, lifted from the builtin
		let expires;
		switch (typeof cache.expires) {
			case "boolean":
				expires = cache.expires;
			break;
			case "number":
				expires = ((Number.isFinite(cache.expires)) ? Math.max(0,Math.round(cache.expires*1000)) : (cache.expires > 0)) || true;
			break;
			case "string":
				expires = dur(cache.expires, true);
			break;
			default:
				expires = true; // expires immediately
			break;
		}

		if (!expires) return caches;
		if (expires === true) expires = 0;

		caches.push({
			dir: path.join(config.paths.data, map),
			expires: Date.now()+expires,
		});

		return caches;

	},[]);

	if (caches.length === 0) {
		worker.parentPort.postMessage({ purged: 0 });
	} else {

		// create tasks
		let purged = 0;
		Promise.allSettled(caches.map(function(cache){
			return new Promise(function(resolve,reject){

				let deletable = [];

				klaw(cache.dir).on("data", function(file){
					if (file.stats.mtimeMs < cache.expires) deletable.push(file.path);
				}).on("end", function(){
					Promise.allSettled(deletable.map(function(file){
						return new Promise(function(resolve,reject){
							fs.unlink(file, function(err){
								if (err) return reject(err);
								purged++;
								resolve();
							});
						});
					})).then(resolve).catch(reject);
				});
			});
		})).then(function(){
			worker.parentPort.postMessage({ purged });
		});

	};

};
