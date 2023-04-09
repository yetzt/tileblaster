#!/usr/bin/env node

// run only if called directly
if (require.main === module) {

	const cluster = require("node:cluster");
	const config = require("../lib/config");
	const debug = require("../lib/debug");

	if (cluster.isPrimary) { // main

		// shutdown state
		let shuttingdown = false;

		// pool management
		let pool = [];

		// recursive fork helper
		function fork(n){
			worker = cluster.fork({ ...process.env, workerid: n });
			debug.info("Started Worker #%d".bold.white, n);
			worker.on('disconnect', function(){
				debug.warn("Disconnect from Worker #%d".bold.white, n);
				if (shuttingdown) { // remove worker from pool
					pool[n] = null;
					if (pool.filter(w=>!!w).length === 0) { // no more workers left, shutdowm
						debug.info("All Workers terminated. Exiting.".bold.white);
						process.exit(0);
					}
				} else { // fork new worker
					pool[n] = fork(n);
				}
			});
			return worker;
		};

		// initial fork for all worker threads
		pool = Array(config.threads).fill().map(function(_,n){
			return fork(n);
		});

		const shutdown = function shutdown(){
			shuttingdown = true;
			debug.info("Shutdown initiated".white.bold);
			pool.forEach(function(worker,n){
				debug.info("Sending shutdown message to Worker #%d".white.bold, n);
				worker.send("shutdown");
			});
			setTimeout(function(){
				debug.warn("Exiting Non-Graceful".white.bold);
				process.exit(1);
			},2900);
		};

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		// watch config file for changes, reload workers on change
		const watch = require("node-watch");
		watch(config._file, {}).on("change", function(evt){
			debug.info("Config file change detected, restarting Workers".white.bold);
			pool.forEach(function(worker,n){
				worker.send("shutdown");
			});
		});

		// create purge worker
		const purge = require("../lib/purge");
		setInterval(purge, 3600000).unref(); // regularly every  1h; FIXME: make configurable
		setTimeout(purge, 300000).unref(); // run once after 5 minutes of uptime

	} else { // worker

		const tileblaster = require("../tileblaster");
		const instance = tileblaster({ ...config, id: process.env.workerid });

	}

};
