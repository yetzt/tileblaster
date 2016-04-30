#!/usr/bin/env node

// node modules
var fs = require("fs");
var path = require("path");
var stream = require("stream");

// npm modules
var debug = require("debug")("tileblaster");
var ellipse = require("ellipse");
var mkdirp = require("mkdirp");
var queue = require("fastq");
var request = require("request");

// get config
if (!fs.existsSync(path.resolve(__dirname, "config.js"))) console.error("no config file") || process.exit();
var config = require(path.resolve(__dirname, "config.js"));

// check config
if (!config.hasOwnProperty("socket") || typeof config.socket !== "string" || config.socket === "") console.error("no socket configured") || process.exit();
if (!config.hasOwnProperty("tiles") || typeof config.tiles !== "string" || config.tiles === "") console.error("no tiles dir configured") || process.exit();

// produce absolute paths
config.socket = path.resolve(__dirname, config.socket);
config.tiles = path.resolve(__dirname, config.tiles);

// preconfigure maps
Object.keys(config.maps).forEach(function(mapid){
	
	// generate default zoom
	if (!config.maps[mapid].hasOwnProperty("zoom")) config.maps[mapid].zoom = [0,20];
	
	// precalculate bbox for zoom levels
	config.maps[mapid].bounds = false;
	if (config.maps[mapid].hasOwnProperty("bbox")) {

		// check if bbox and zoom are valid
		if (!(config.maps[mapid].bbox instanceof Array) || config.maps[mapid].bbox.length !== 4 || !checklatlng([config.maps[mapid].bbox[0],config.maps[mapid].bbox[1]]) || !checklatlng([config.maps[mapid].bbox[2],config.maps[mapid].bbox[3]])) return debug("invalid bounding box: %j", config.maps[mapid].bbox.bbox) || console.error(new Error("Invalid bounding box")) || process.exit(1);
		if (!range(config.maps[mapid].zoom)) console.error("invalid zoom in map "+mapid) || process.exit(1);
		
		config.maps[mapid].bounds = {};
		range(config.maps[mapid].zoom).forEach(function(z){
			config.maps[mapid].bounds[z.toString()] = { 
				"w": lng(config.maps[mapid].bbox[0],z), 
				"s": lat(config.maps[mapid].bbox[1],z), 
				"e": lng(config.maps[mapid].bbox[2],z), 
				"n": lat(config.maps[mapid].bbox[3],z) 
			};
		});
	
	};
	
});

// console.log(config.maps["berlin-2015"]);
// process.exit();

// generate global queue
var q = queue(function(t,n){ t(n); }, 20);

// statistics
var statistics = { hit: 0, fetch: 0, err: 0 };

// make app
var app = ellipse();

// configure map route
app.get("/:map([A-Za-z0-9\\-\\_\\.]+)/:z(\\d+)/:x(\\d+)/:y(\\d+).:ext([A-Za-z0-9]+)", function(req,res){

	// count hit
	statistics.hit++;
	
	// check if map exists
	var map = req.params.map.toLowerCase();
	var ext = req.params.ext.toLowerCase();
	var x = parseInt(req.params.x,10);
	var y = parseInt(req.params.y,10);
	var z = parseInt(req.params.z,10);
	
	if (!config.maps.hasOwnProperty(map)) return debug("requested invalid map: %s", map) || res.status(404).end() || (statistics.err++);
	
	// check requested tile
	check(map, z, x, y, ext, function(err){
		if (err) return debug("invalid tile /%s/%d/%d/%d.%s (%s)", map, z, x, y, ext, err) || res.status(404).end() || (statistics.err++);
		
		// get tile FIXME
			if (err) return debug("invalid tile /%s/%d/%d/%d.%s (%s)", map, z, x, y, ext, err) || res.status(404).end() || (statistics.err++);
		tile(map, z, x, y, r, ext, function(err, stream){

			// set status and content type
			res.status(200);
			res.setHeader("Content-Type", "image/"+ext);

			// pipe tile to response
			stream.pipe(res);
		});
		
	});
	
});


// default get route
app.get("*", function(req,res){
	res.status(404).end();
});

// default route for other methods
app.all("*", function(req,res){
	res.status(405).end();
});

// listen on socket
(function(fn){
	(function(next){
		fs.exists(config.socket, function(x){
			if (!x) return next();
			fs.unlink(config.socket, function(err){
				if (err) return fn(err);
				next();
			});
		});
	})(function(){
		app.listen(config.socket, function(err) {
			if (err) return fn(err);
			// change socket mode
			fs.chmod(config.socket, 0777, fn);
		});
	});
})(function(err){
	if (err) console.error("unable to listen on socket") || process.exit();
	debug("listening on socket %s", config.socket);
});

// heartbeats
if (config.hasOwnProperty("heartbeat")) {
	var heartbeat = require("nsa")({
		server: config.heartbeat,
		service: "tileblaster",
		interval: "10s"
	}).start();
	
	// send stats every five minutes
	setInterval(function(){
		heartbeat.send(statistics);
	},300000).unref();
};

// get a tile
function tile(mapid, z, x, y, r, e, fn){
	var file = path.resolve(config.tiles, tilefile(mapid, z, x, y, r, e));
	fs.exists(file, function(ex){
		if (ex) return fn(null, fs.createReadStream(file));
		
		// count fetch
		statistics.fetch++;
		
		// check queue length, refuse if too full
		if (q.length() > 200) return debug("fetch queue is too full: %d", q.length) || fn(new Error("queue too full"));
		
		var tile_url = tileurl(mapid, z, x, y, r, e);
		
		// ensure directory exists
		mkdirp(path.dirname(file), function(err){
			if (err) return debug("creating dir for saving tile %s failed: %s", file, err) || fn(new Error("could not create tile dir"));
				
			// fetch tile
			q.push(function(done){
				debug("fetching tile '%s'", tile_url);
				request.get(tile_url).on('response', function(resp){
					done();

					// check response
					if (resp.statusCode !== 200) return debug("status code for tile '%s' is %d", tile_url, resp.statusCode) || fn(new Error("status code is not 200"));
					if (resp.headers.hasOwnProperty("content-type") && !/^image\//.test(resp.headers["content-type"])) return debug("content type for tile '%s' is %s", tile_url, resp.headers["content-type"]) || fn(new Error("content-type is not image/*"));
					if (resp.headers.hasOwnProperty("content-length") && parseInt(resp.headers["content-length"],10) === 0) return debug("content lenght for tile '%s' is 0", tile_url) || fn(new Error("content-length is 0"));

					// create passthrough stream for painless multiplexing
					var mux = new stream.PassThrough;
					
					// creat file writer stres,
					var savestream = fs.createWriteStream(file);

					// return multiplexer stream to route handler and pipe it to savestream
					fn(null, mux);
					mux.pipe(savestream)

					// do some post-save-checks (FIXME)
					savestream.on("finish", function(){
						debug("saved tile %s", tile_url);
						// experimental: check if cached file has the right size, otherwise delete.
						if (resp.headers.hasOwnProperty("content-length")) {
							fs.stat(file, function(err, stats){
								if (err) return debug("could not get stats for file %s", file);
								if (stats.size !== parseInt(resp.headers["content-length"],10)) {
									debug("oh shit: got just half a file: %s", file);
									fs.unlink(file, function(err){
										if (err) return debug("could not unlink broken file: %s", file);
										debug("unlinked broken file %s", file);
									});
								}
							});
						};
					});
					
					// finally pipe data to multiplexer stream
					this.pipe(mux);

				});
			});
		});
	});
};

// transform parameters to url
function tileurl(mapid, z, x, y, r, e){
	return config.maps[mapid].url
		.replace("{x}", x.toFixed(0))
		.replace("{y}", y.toFixed(0))
		.replace("{z}", z.toFixed(0))
		.replace("{r}", (r) ? (config.maps[mapid].retina||"@2x") : "")
		.replace("{e}", (e) ? e : "");
};

// transform parameters to filename
function tilefile(mapid, z, x, y, r, e){
	return ("{m}/{z}/{x}/{y}{r}.{e}")
		.replace("{m}", mapid)
		.replace("{x}", x.toFixed(0))
		.replace("{y}", y.toFixed(0))
		.replace("{z}", z.toFixed(0))
		.replace("{r}", (r) ? (config.maps[mapid].retina||"@2x") : "")
		.replace("{e}", (e) ? e : "");
};

// convert lng to tile x
function lng(lng,z){
	return (Math.floor((lng+180)/360*Math.pow(2,z)));
};

// convert lat to tile y
function lat(lat,z){
	return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,z)));
};

// get full range from start,end
function range(z){
	if (z.length !== 2) return false;
	if (z[0] > z[1]) return false;
	var zooms = [];
	for (var i = z[0]; i <= z[1]; i++) zooms.push(i);
	return zooms;
}

// check coordinate pair
function checklatlng(latlng) {
	if (!(latlng instanceof Array) || latlng.length !== 2) return false;
	if (!(typeof latlng[0] === "number") || latlng[0] < -90 || latlng[0] > 90) return false;
	if (!(typeof latlng[1] === "number") || latlng[1] < -180 || latlng[1] > 180) return false;
	return true;
};

// check if a tile meets specifications
function check(map, z, x, y, ext, fn){

	// check map identifier
	if (!/^[A-Za-z0-9\-\_]+$/.test(map)) return debug("check: invalid map '%s'", map) || fn(new Error("Invalid map identifier"));
	if (!config.maps.hasOwnProperty(map)) return debug("check: unknown map '%s'", map) || fn(new Error("Unknown map identifier"));

	// check extension
	if (config.maps[map].ext instanceof Array && config.maps[map].ext.length > 0 && config.maps[map].ext.indexOf(ext) < 0) return debug("check: disallowed extension '%s'", ext) || fn(new Error("Disallowed extension"));
	if (typeof config.maps[map].ext === "string" && config.maps[map].ext !== "" && ext !== config.maps[map].ext) return debug("check: disallowed extension '%s'", ext) || fn(new Error("Disallowed extension"));

	// check zoom level
	var zf = parseFloat(z,10);
	if (zf%1!==0) return debug("check: invalid zoom float %d ", zf) || fn(new Error("Disallowed zoom factor"));
	if (zf < config.maps[map].zoom[0]) return debug("check: invalid zoom %d < %d", zf, config.maps[map].zoom[0]) || fn(new Error("Disallowed zoom factor"));
	if (zf > config.maps[map].zoom[1]) return debug("check: invalid zoom %d > %d", zf, config.maps[map].zoom[1]) || fn(new Error("Disallowed zoom factor"));

	// check bbox
	if (config.maps[map].hasOwnProperty("bbox")) {
		var zs = z.toString();
		if (x < config.maps[map].bounds[zs].w || x > config.maps[map].bounds[zs].e) return debug("check: invalid tile x %d <> [%d-%d@%d]", x, config.maps[map].bounds[zs].e, config.maps[map].bounds[zs].w, z) || fn(new Error("Disallowed tile x"));
		if (y < config.maps[map].bounds[zs].n || y > config.maps[map].bounds[zs].s) return debug("check: invalid tile y %d <> [%d-%d@%d]", y, config.maps[map].bounds[zs].n, config.maps[map].bounds[zs].s, z) || fn(new Error("Disallowed tile y"));
	}
	
	fn(null);

};

// gracefully stop sending heartbeats
function terminate(){
	debug("statistics: %j", statistics);
	if (!heartbeat) process.exit(0);
	debug("stopping heartbeat client");
	heartbeat.end(function(){
		debug("stopped heartbeat client");
		process.exit(0);
	});
};

// handle SIGTERM
process.on("SIGTERM", function(){
	debug("caught SIGTERM, terminating");
	terminate();
});

// handle SIGINT
process.on("SIGINT", function(){
	debug("caught SIGINT, terminating");
	terminate();
});
