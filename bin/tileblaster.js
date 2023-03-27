#!/usr/bin/env node

// run only if called directly
if (require.main === module) {

	const cluster = require("node:cluster");
	const config = require("../lib/config");
	const debug = require("../lib/debug");

	if (cluster.isPrimary) { // main

		// fork, watch config, reload, shutdown, etc

		// shutdown state
		let shutdown = false;

		// pool management
		let pool = [];

		// recursive fork helper
		function fork(n){
			worker = cluster.fork({ ...process.env, workerid: n });
			debug.info("Started Worker #%d".bold.white, n);
			worker.on('disconnect', function(){
				debug.warn("Disconnect from Worker #%d".bold.white, n);
				if (shutdown) { // remove worker from pool
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

		process.on("SIGINT", function(){
			shutdown = true;
			debug.info("\nShutdown initiated".white.bold);
			pool.forEach(function(worker,n){
				debug.info("Sending SIGTERM to Worker #%d".white.bold, n);
				worker.kill();
			});
			setTimeout(function(){
				debug.warn("Exiting Non-Graceful".white.bold);
				process.exit(1);
			},2900)
		});

		// watch config file for changes, reload workers on change
		const watch = require("node-watch");
		watch(config._file, {}).on("change", function(evt){
			debug.info("Config file change detected, restarting Workers".white.bold);
			pool.forEach(function(worker,n){
				worker.kill();
			});
		});

	} else { // worker

		const tileblaster = require("../tileblaster");
		const instance = tileblaster({ ...config, id: process.env.workerid });

	}

};
