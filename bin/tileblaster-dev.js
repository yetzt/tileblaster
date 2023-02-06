// minimalistic dev server, restarting on main file change

const debug = require("../lib/debug");

// run if called directly
if (require.main === module) {
	process.env.DEBUG = process.env.DEBUG || "tileblaster";

	const fs = require("node:fs");
	const path = require("node:path");
	const cluster = require("node:cluster");
	const retrieve = require("../lib/retrieve");

	if (cluster.isPrimary) {
		let worker;
		let alive = Date.now();
		function fork(){
			debug.info("Starting tileblaster".bold.white);
			worker = cluster.fork();
			worker.on('disconnect', function(){
				if (Date.now()-alive < 1000) {
					debug.warn("Unspinning");
					setTimeout(function(){
						worker = fork();
					}, 5000);
				} else {
					worker = fork();
				}
				alive = Date.now();
			});
			return worker;
		};

		let lastevent = Date.now();
		function watch(file){
			fs.watch(file).on("change", function(event){
				if (event === "change" && Date.now() - lastevent > 100) worker.kill();
				lastevent = Date.now();
				this.close();
				watch(file);
			});
		};

		worker = fork();
		watch(path.resolve(__dirname, "../tileblaster.js"));

		let lastsigint = Date.now();
		process.on("SIGINT", function(){
			if (Date.now()-lastsigint < 1000) process.exit(0);
			lastsigint = Date.now();
			console.log("");
			debug.info("Ending Worker...".white.bold);
			worker.kill();
		});

	} else {
		const tileblaster = require("../tileblaster");
		tileblaster({
			version: 1,
			listen: [{ port: 8080 }],
			maps: { example: [] },
			...require("../config"),
		});

		retrieve("http://127.0.0.1:8080/example/0/0/0.png", function(){});

	}
};
