// parse argv and load config

const fs = require("node:fs");
const path = require("node:path");
const format = require("node:util").format;
const package = require("../package.json");
const minimist = require("minimist");

// parse command line arguments
const argv = minimist(process.argv.slice(2), {
	alias: { v: "verbose", h: "help", s: "socket", p: "port", c: "config", t: "threads" },
	boolean: [ "help", "verbose" ],
});

function usage(err){
	if (err) console.error("%s: %s", package.name, err);
	else console.error("%s %s -- %s", package.name, package.version, package.description);
	console.error("");
	console.error("Usage: %s [options] [-c] config.js", package.name);
	console.error("Options:");
	console.error("	-c --config <config.js>		load config file");
	console.error("	-p --port <[host:]port>		listen on this port (overrides config)");
	console.error("	-s --socket <socket[,mode,gid]>	listen on this socket (overrides config)");
	console.error("	-t --threads <num>		number of threads (overrides config)");
	console.error("	-h --help			print help screen");
	console.error("	-v --verbose			enable debug output");
	console.error("	-q --quiet			disable debug output");
	console.error("");
	process.exit(err?1:0);
};

// show help
if (argv.h) usage();

// enable/disable debug output when --verbose or --quiet
if (argv.v) process.env.DEBUG = process.env.DEBUG || "tileblaster";
if (argv.q) process.env.DEBUG = undefined;

// if no --config, try last argument
if (!argv.c && argv._.length > 0) argv.c = argv._.pop();
if (!argv.c) usage("No config file specified.");

// resolve config path
const configfile = path.resolve(process.cwd(), argv.c);
if (!fs.existsSync(configfile)) usage(format("No config file '%s' does not exist.", configfile));

// load config
const config = (function(){
	try {
		return require(configfile);
	} catch(err) {
		usage(format("Could not load config file: %s", err.toString()));
	}
})();

// expose configfile for watching
config._file = configfile;

// override threads
if (argv.t) {
	let threads = parseInt(argv.t,10);
	if (isNaN(threads) || !isFinite(threads)) return usage(format("Illegal number of threads: %s", argv.t));
	config.threads = threads;
};

// override host and port
if (argv.p) {
	let host, port;
	if (typeof argv.p === "string" && argv.p.includes(":")) {
		host = argv.p.split(":");
		port = parseInt(host.pop());
		host = host.pop().toLowerCase();
	} else {
		port = parseInt(argv.p,10);
		host = "localhost";
	}

	// check
	if (isNaN(port) || !isFinite(port) || port < 1 || port > 65535) return usage(format("Illegal port: %s", argv.p));
	if (!/^[a-z0-9\-\.\_]$/i.test(host)) return usage(format("Illegal hostname: %s", argv.p));

	// remove all listen directives with port
	config.listen = config.listen.filter(function(l){
		return !l.hasOwnProperty("port");
	});

	// add our own
	config.listen.push({ port, host });
};

// override socket
if (argv.s) {
	let socket, mode, group;
	socket = socket.split(/,/g);
	group = (socket.length >= 3) ? socket[2] : false;
	mode = (socket.length >= 2) ? parseInt(socket[1],8) : 0o660;
	socket = socket[0];

	// remove all listen directives with port
	config.listen = config.listen.filter(function(l){
		return !l.hasOwnProperty("socket");
	});

	// add our own
	config.listen.push({ socket, mode, group });

};

// export
module.exports = config;