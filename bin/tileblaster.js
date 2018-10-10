#!/usr/bin/env node
require("../lib/tileblaster.js")(
	(function(){
		try {
			return (!!process.argv[2]) ? require(require("path").resolve(process.cwd(), process.argv[2])) : require("../config.js");
		} catch (err) {
			console.error("usage: tileblaster <config.js>");
			process.exit();
		}
	})()
).server().listen();

