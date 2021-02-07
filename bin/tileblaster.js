#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
var watch = require('node-watch');
var configfile = require("path").resolve.apply(global, (!!argv._[0]) ? [ process.cwd(), argv._[0] ] : [ "../config.js" ]);
var tb = require("../lib/tileblaster.js")(
	(function(config){
		["socket","tiles","queue","id"].forEach(function(n){
			if (!!argv[n]) config[n] = argv[n];
		});
		// watch changes in config file
		watch(configfile, function(evt,f){
			if (evt === "update") try {
				delete require.cache[require.resolve(configfile)];
				tb.reconfigure(require(configfile));
			} catch (err) {
				console.error("Unable to read changed config file", err);
			}
		});
		return config;
	})((function(){
		try {
			return require(configfile);
		} catch (err) {
			console.error("usage: tileblaster <config.js> [--socket tileblaster.sock] [--tiles /path/to/tiles] [--queue 100] [--id mytileblaster]");
			process.exit(1);
		}
	})())
).server().listen();

