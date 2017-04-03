#!/usr/bin/env node

// node modules
var fs = require("fs");
var url = require("url");
var path = require("path");
var http = require("http");
var zlib = require("zlib");
var stream = require("stream");

// npm modules
var debug = require("debug")("tileblaster");
var request = require("request");
var mkdirp = require("mkdirp");
var queue = require("fastq");

// get config
if (!fs.existsSync(path.resolve(__dirname, "config.js"))) console.error("no config file") || process.exit();
var config = require(path.resolve(__dirname, "config.js"));

// check config
if (!config.hasOwnProperty("socket") || typeof config.socket !== "string" || config.socket === "") console.error("no socket configured") || process.exit();
if (!config.hasOwnProperty("tiles") || typeof config.tiles !== "string" || config.tiles === "") console.error("no tiles dir configured") || process.exit();

// produce absolute paths
config.socket = path.resolve(__dirname, config.socket);
config.tiles = path.resolve(__dirname, config.tiles);

// keep account of missing tiles
config.missing = {};

// preconfigure maps
Object.keys(config.maps).forEach(function(mapid){
	
	// generate default zoom
	if (!config.maps[mapid].hasOwnProperty("zoom")) config.maps[mapid].zoom = [0,20];
	
	if (config.maps[mapid].url.indexOf("{s}") >= 0) {
		if (!config.maps[mapid].hasOwnProperty("sub")) console.error("no subdomains configured for map "+mapid) || process.exit(1);
		if (typeof config.maps[mapid].sub === "string") config.maps[mapid].sub = config.maps[mapid].sub.split("");
		if (!(config.maps[mapid].sub instanceof Array)) console.error("invalid 'sub' option for map "+mapid) || process.exit(1);
	} else {
		config.maps[mapid].sub = false;
	}
	
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

// generate global queue
var q = queue(function(t,n){ t(n); }, 20);

// statistics
var statistics = { hit: 0, fetch: 0, err: 0 };

// create http server
var server = http.createServer(function (req, res) {
	
	// only GET is allowed
	if (req.method !== "GET") {
		debug("invalid method: %s", req.method);
		res.statusCode = 405;
		res.end();
		return;
	}

	// only tile requests are allowed
	if (!(/\/(([a-z0-9\-\_\.]+)\/([0-9]+)\/([0-9]+)\/([0-9]+)(@2x)?\.([a-z0-9]+))$/.exec(url.parse(req.url).pathname.toLowerCase()))) {
		debug("invalid request: %s", url.parse(req.url).pathname);
		res.statusCode = 404;
		res.end();
		return;
	}

	var p = RegExp.$1;
	var map = RegExp.$2;
	var z = parseInt(RegExp.$3,10);
	var x = parseInt(RegExp.$4,10);
	var y = parseInt(RegExp.$5,10);
	var r = (RegExp.$6 === "@2x");
	var ext = RegExp.$7;

	// check if map exists
	if (!config.maps.hasOwnProperty(map)) {
		debug("requested invalid map: %s", map)
		res.statusCode = 404;
		res.end();
		statistics.err++
		return;
	}
	
	// check requested tile
	check(map, z, x, y, ext, function(err){
		if (err) {
			debug("invalid tile '%s': %s", p, err);
			res.statusCode = 404;
			res.end();
			statistics.err++
			return;
		}
		
		// get tile
		tile(map, z, x, y, r, ext, function(err, stream){
			if (err) {
				debug("error getting tile '%s': %s", p, err);
				res.statusCode = 404;
				res.end();
				statistics.err++
				return;
			}

			debug("delivering tile %s", p);

			// set status and content type
			res.writeHead(200, { "Content-Type": mime(ext) });

			// pipe tile to response
			stream.pipe(res);

			// count hit
			statistics.hit++;

		});
		
	});

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
		server.listen(config.socket, function(err) {
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

// mime type by extension; FIXME: find better solution
function mime(ext){
	switch (ext) {
		case "mvt":
			return "application/vnd.mapbox-vector-tile";
		break;
		case "pbf":
			return "application/x-protobuf";
		break;
		case "json": 
		case "geojson": 
			return "application/vnd.geo+json"; 
		break;
		case "jpg": 
			return "image/jpeg"; 
		break;
		case "svg": 
			return "image/svg+xml"; 
		break;
		default: 
			return "image/"+ext; 
		break;
	}
};

// get a tile
function tile(mapid, z, x, y, r, e, fn){
	var tile_file = tilefile(mapid, z, x, y, r, e);
	
	// check if tile is known 404 and was recorded less than 5 minutes ago
	if (config.missing.hasOwnProperty(tile_file) && config.missing[tile_file].added > (Date.now()-300000)) {
		config.missing[tile_file].hits++;
		fn(new Error("tile is known 404"));
		return; 
	}
	
	var file = path.resolve(config.tiles, tile_file);
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
					if (resp.statusCode !== 200) {

						// if 404, record as known missing
						if (resp.statusCode === 404) config.missing[tile_file] = { added: Date.now(), hits: 1 };

						debug("status code for tile '%s' is %d", tile_url, resp.statusCode);
						fn(new Error("status code is not 200"));
						return;
					}

					if (resp.headers.hasOwnProperty("content-type") && !/^(image\/|application\/vnd\.(mapbox-vector-tile|geo\+json|x-protobuf)$)/.test(resp.headers["content-type"])) return debug("content type for tile '%s' is %s", tile_url, resp.headers["content-type"]) || fn(new Error("unsupported content-type"));
					if (resp.headers.hasOwnProperty("content-length") && parseInt(resp.headers["content-length"],10) === 0) {
						config.missing[tile_file] = { added: Date.now(), hits: 1 };
						debug("content lenght for tile '%s' is 0", tile_url);
						fn(new Error("content-length is 0"));
						return
					}

					// create passthrough stream for painless multiplexing
					var mux = new stream.PassThrough;
					
					// creat file writer stres,
					var savestream = fs.createWriteStream(file);

					// return multiplexer stream to route handler and pipe it to savestream
					fn(null, mux);
					mux.pipe(savestream)

					// do some post-save-operations
					savestream.on("finish", function(){
						debug("saved tile %s", tile_url);

						(function(next){
							// experimental: check if cached file has the right size, otherwise delete.
							if (resp.headers.hasOwnProperty("content-length")) {
								debug("checking if file is corrupt")
								fs.stat(file, function(err, stats){
									if (err) return debug("could not get stats for file %s", file);
									if (stats.size !== parseInt(resp.headers["content-length"],10)) {
										debug("oh shit: got just half a file: %s", file);
										fs.unlink(file, function(err){
											if (err) return debug("could not unlink broken file: %s", file);
											debug("unlinked broken file %s", file);
										});
									} else {
										debug("file is clean");
										next();
									}
								});
							} else {
								next();
							}
						})(function(){
							// experimental: create static gzip
							if (config.gzip === true || ((config.gzip instanceof Array) && config.gzip.indexOf(e) >= 0)) {
								debug("creating gz of tile");
								fs.createReadStream(file).pipe(zlib.createGzip()).pipe(fs.createWriteStream(file+".gz"));
							}
						});
					});
					
					// finally pipe data to multiplexer stream
					this.pipe(mux);

				}).on("error", function(err){
					done();
					fn(err);
				});
			});
		});
	});
};

// transform parameters to url
function tileurl(mapid, z, x, y, r, e){
	return config.maps[mapid].url
		.replace("{s}", (config.maps[mapid].sub !== false) ? config.maps[mapid].sub[Math.floor(Math.random()*config.maps[mapid].sub.length)] : "")
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

// clean up known missing tiles
setInterval(function(){
	var missing = [];
	var result = {};
	var tot = 0;
	var reqc = 0;
	var resc = 0;

	// filter out any records older than 5m
	Object.keys(config.missing).forEach(function(k){
		reqc++;
		if (config.missing[k].added > (Date.now()-300000)) {
			missing.push({
				key: k,
				added: config.missing[k].added,
				hits: config.missing[k].hits
			});
			tot += config.missing[k].hits;
		}
	});
	
	// check for quick way out
	if (tot === 0) {
		config.missing = {};
		return;
	}
	
	// calculate average number of hits
	var avg = (tot / missing.length);

	// add above average tiles to result, keep average value as hit counter for reasonable head start on new tiles
	missing.sort(function(a,b){ return a.hits-b.hits }).filter(function(v){ return (v.hits > avg) }).forEach(function(v){
		result[v.key] = { added: v.added, hits: Math.floor(avg) };
		resc++;
	});
	
	config.missing = result;
	debug("reduced cache of missing tiles from %d to %d entries");
	
},60000).unref();