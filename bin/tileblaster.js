#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
require("../lib/tileblaster.js")(
	(function(config){
		["socket","tiles","queue","id"].forEach(function(n){
			if (!!argv[n]) config[n] = argv[n];
		});
		return config;
	})((function(){
		try {
			return (!!process.argv[2]) ? require(require("path").resolve(process.cwd(), process.argv[2])) : require("../config.js");
		} catch (err) {
			console.error("usage: tileblaster <config.js> [--socket tileblaster.sock] [--tiles /path/to/tiles] [--queue 100] [--id mytileblaster]");
			process.exit(1);
		}
	})())
).server().listen();

