#!/usr/bin/env node

var fs = require("fs");
var url = require("url");
var path = require("path");
var http = require("http");
var zlib = require("zlib");
var util = require("util");
var stream = require("stream");

var debug = require("debug")("tileblaster");
var request = require("request");
var mkdirp = require("mkdirp");
var queue = require("quu");
var glob = require("glob");
var dur = require("dur");

// optional dependencies; if only 
try { var optipng = require("optipng"); } catch (err) { var optipng = null; }
try { var mozjpeg = require("mozjpeg"); } catch (err) { var mozjpeg = null; }

// load package
var pckg = require("../package.json");

function tileblaster(config){
	return (this instanceof tileblaster) ? this.init(config) : new tileblaster(config);
};

// mime types
tileblaster.prototype.mime = {
	// raster
	png:      'image/png',
	jpg:      'image/jpeg',
	jpeg:     'image/jpeg',
	gif:      'image/gif',
	// vector
	svg:      'image/svg+xml',
	mvt:      'application/vnd.mapbox-vector-tile',
	pbf:      'application/x-protobuf',
	// data
	json:     'application/json',
	geojson:  'application/vnd.geo+json',
	topojson: 'application/json',
	// obscure ones:
	arcjson:  'application/json',
	geobson:  'application/octet-stream',
	geoamf:   'application/octet-stream',
	arcamf:   'application/octet-stream',
};

// initialize
tileblaster.prototype.init = function(config){
	var self = this;

	debug("<init> inizializing");

	// server
	self.srvr = null;

	// keep config
	self.config = config || {};
	
	// socket
	self.config.socket = path.resolve(self.config.socket || "./tileblaster.socket");

	// expires (default: never)
	self.config.expires = (dur(self.config.expires) || Infinity);
	
	// cache
	self.errcache = {};

	// extend mime types
	if (!!self.config.mime) Object.keys(self.config.mime).map(function(ext){ self.mime[ext] = self.config.mime[ext] });
	
	// queue
	self.queue = queue(20);
	
	// have maps with active expires?
	self.expiration = false;
	
	// check configured maps
	self.maps = Object.keys(self.config.maps).reduce(function(maps, id){
	
		return maps[id] = (function(map,id){
			
			// default zoom
			if (!map.zoom) map.zoom = [0,20];
			
			// check for subdomain feature
			if (map.url.indexOf("{s}") >= 0) {
				if (!map.sub) throw new Error("no subdomains configured for map "+mapid);
				if (typeof map.sub === "string") map.sub = map.sub.split("");
				if (!(map.sub instanceof Array)) throw new Error("invalid 'sub' option for map "+mapid);
			} else {
				map.sub = false;
			}
			
			// resolutions
			if (!map.res) map.res = [];
			if (!(map.res instanceof Array)) map.res = [ map.res ];
			map.res = map.res.filter(function(res){
				return /^@[1-9][0-9]*(\.[0-9]+)?x$/.test(res);
			});
		
			// precalculate bbox for zoom levels
			map.bounds = false;
			if (!!map.bbox) {

				// check if bbox and zoom are valid
				if (!(map.bbox instanceof Array) || map.bbox.length !== 4 || !self._checklnglat([map.bbox[0],map.bbox[1]]) || !self._checklnglat([map.bbox[2],map.bbox[3]])) throw new Error("invalid bounding box: "+JSON.stringify(map.bbox));
		
				// sort bbox to ensure wsen
				map.bbox = [
					Math.min(map.bbox[0], map.bbox[2]),
					Math.min(map.bbox[1], map.bbox[3]),
					Math.max(map.bbox[0], map.bbox[2]),
					Math.max(map.bbox[1], map.bbox[3]),
				];
		
				map.bounds = [];
				self._range(map.zoom).forEach(function(z){
					map.bounds[z] = { 
						"w": self._lngid(map.bbox[0],z), 
						"s": self._latid(map.bbox[1],z), 
						"e": self._lngid(map.bbox[2],z), 
						"n": self._latid(map.bbox[3],z) 
					};
				});
	
			};
			
			// ensure extension list is array
			map.ext = (!!map.ext) ? (map.ext instanceof Array) ? map.ext : [map.ext] : false;
			
			// expires
			if (!!map.expires) map.expires = dur(map.expires);
			if (!!map.expires) self.expiration = true;
			
			return map;
			
		})(self.config.maps[id],id), maps;
	
	},{});
	
	// build user agent
	if (!self.config.useragent) self.config.useragent = util.format("%s/%s (+)", pckg.name, pckg.version, pckg.homepage);

	// cleanup timer
	self.config.cleanup = (!!config.cleanup) ? dur(config.cleanup) : false;
	if (self.config.cleanup && self.expiration) self.cleaner = setInterval(function(){ self.cleanup(); }, self.config.cleanup).unref();

	return this;
};

// return server
tileblaster.prototype.server = function(){
	var self = this;
	
	self.srvr = http.createServer(function (req, res) {
	
		// check http method
		if (req.method !== "GET") return debug("<server> invalid method: %s", req.method), res.statusCode = 405, res.end();

		// only tile requests are allowed
		if (!(/\/(([a-z0-9\-\_\.]+)\/([0-9]+)\/([0-9]+)\/([0-9]+)(@[0-9]+(\.[0-9]+)?x)?\.([a-z0-9]+))$/.exec(url.parse(req.url).pathname.toLowerCase()))) return debug("<server> invalid request: %s", url.parse(req.url).pathname), res.statusCode = 404, res.end();

		// asselmble information
		var p = RegExp.$1;
		var mapid = RegExp.$2;
		
		if (!self.maps[mapid]) return debug("<server> invalid mapid: %s", mapid), res.statusCode = 404, res.end();

		var z = parseInt(RegExp.$3,10);
		var x = parseInt(RegExp.$4,10);
		var y = parseInt(RegExp.$5,10);
		var r = ((self.maps[mapid].res.indexOf(RegExp.$6) >= 0) ? RegExp.$6 : false);
		var ext = RegExp.$8;

		debug("<server> [%s] requested", p);

		// check if map exists
		if (!self.maps.hasOwnProperty(mapid)) return debug("<server> requested invalid map: %s", mapid), res.statusCode = 404, res.end();

		self.tile(mapid, z, x, y, r, ext, function(err, stream, meta){
			if (err) return debug("<server> [%s] error: %s", p, err), res.statusCode = 204, res.end();
			
			var headers = { "Content-Type": meta['content-type'] };
			
			// check if client supportg gzip (not very elegant, but most clients do)
			if (!!req.headers["accept-encoding"] && req.headers["accept-encoding"].split(/,^s*/).indexOf('gzip') >= 0){
				debug("<server> [%s] decompressing", p);
				stream = stream.pipe(zlib.createGunzip());
			} else {
				headers["Content-Encoding"] = "gzip";
			}
				
			// send headers
			res.writeHead(200, headers);
			
			stream.on("end", function(){
				debug("<server> [%s] done", p);
			});
			
			// pipe stream to http client
			stream.pipe(res);
			
		});
		
	});
	
	// in case self.listen() was called before self.server();
	if (self.listentome) self.listen();
	
	return this;
	
};

// listen on socket
tileblaster.prototype.listen = function(){
	var self = this;
	
	// wait for server to be ready
	if (!self.srvr) return (self.listentome = true), this;

	// listen on socket
	(function(fn){
		(function(next){
			fs.exists(self.config.socket, function(x){
				if (!x) return next();
				fs.unlink(self.config.socket, function(err){
					if (err) return fn(err);
					next();
				});
			});
		})(function(){
			self.srvr.listen(self.config.socket, function(err) {
				if (err) return fn(err);
				fs.chmod(self.config.socket, 0777, fn);
			});
		});
	})(function(err){
		if (err) debug("<listen> unable to listen on socket %s", self.config.socket), process.exit(1);
		debug("<listen> listening on socket %s", self.config.socket);
	});
	
	return this;

};

// start heartbeat server
tileblaster.prototype.heartbeat = function(){
	var self = this;
		
	if (!!config.heartbeat) self.statistics = { hits: 0, errs: 0, served: 0 }, self.heartbeat = require("nsa")({
		server: config.heartbeat,
		service: "tileblaster",
		interval: "10s"
	}).start(function(){
		// send stats every five minutes
		setInterval(function(){
			heartbeat.send(self.statistics);
		},300000).unref();
	});

	(function(terminate){
		
		process.on("SIGTERM", function(){ terminate("SIGTERM"); });
		process.on("SIGINT", function(){ terminate("SIGINT"); });
		
	})(function(signal){
		debug("<terminate> %s", signal);
		debug("<heartbeat> statistics: %j", self.statistics);
		self.heartbeat.end(function(){
			process.exit(0);
		});
	});

	return this;
};

// delete expired tiles
tileblaster.prototype.cleanup = function(){
	var self = this;
	
	// 
	Object.keys(self.maps).filter(function(mapid){ 
		return (!!self.maps[mapid].expires);
	}).forEach(function(mapid){
		self.queue.push(function(done){
			debug("<cleanup> [%s] start", mapid);
			glob(path.resolve(self.config.tiles, mapid, '**/*.gz'), function(err, files){
				if (err) return debug("<cleanup> [%s] err: %s", mapid, err), done();
				if (files.length === 0) return debug("<cleanup> [%s] empty", mapid), done();

				var d = 0;
				var q = queue(5).done(function(n){
					return debug("<cleanup> [%s] checked %d files, deleted %d", mapid, n, d), done();
				});
				
				files.forEach(function(f){
					q.push(function(next){
						fs.stat(f, function(err, stat){
							if (err) return debug("<cleanup> [%s] err: %s", mapid, err), next();
							// debug("<cleanup> [%s] %d <> %d", f, (Date.now() - (stat.birthtimeMs || stat.ctimeMs)), self.maps[mapid].expires);
							if ((Date.now() - (stat.birthtimeMs || stat.ctimeMs)) < self.maps[mapid].expires) return next();
							fs.unlink(f, function(err){
								if (err) return debug("<cleanup> [%s] err: %s", mapid, err), next();
								d++;
								next();
							});
						});
					});
				});
			});
		});
	});
	
	return this;
};

// get tile
tileblaster.prototype.tile = function(mapid, z, x, y, r, e, fn){
	var self = this;
	
	// optionalize r and e
	if (typeof r === 'function') var e = r, r = false;
	if (typeof e === 'function') var fn = e, e = null;

	// generate tile filename
	var tilefile = self._tilefile(mapid, z, x, y, r, e);

	debug("<tile> [%s] requested", tilefile);
	
	// check tile
	self._checktile(mapid, z, x, y, r, e, function(err){
		if (err) return fn(err);

		debug("<tile> [%s] valid", tilefile);
	
		// check for cached 404 tiles
		if (!!self.errcache[tilefile] && self.errcache[tilefile] > (Date.now()-self.config.expires)) return fn(new Error("Known bad tile"), null);
	
		// resolve tile path
		var tilepath = path.resolve(self.config.tiles, tilefile);
	
		// construct upstream tile url
		var tileurl = self._tileurl(mapid, z, x, y, r, e);

		self.fetchtile(tileurl, mapid, function(err, stream, meta){

			// locally cache 404 and 204
			if (!!err && (stream === 404 || stream === 204)) self.errcache[tilefile] = Date.now();

			// error or no stream
			if (!!err || !stream || typeof stream === 'number') return fn(err, stream);

			debug("<tile> [%s] fetched", tilefile);

			// strem mux
			stream.pipe(self.optimize(mapid, e)).pipe(self._mux(function(stream){

				// call back with stream
				fn(null, stream, {
					'content-type': (self.mime[e])
				});

			}, function(stream){
				
				mkdirp(path.dirname(tilepath), function(err){
					if (err) debug("<tile> [%s] -- %s", tilefile, err);

					// save to tmp file, rename when done
					stream.pipe(fs.createWriteStream(tilepath+".tmp").on('finish', function(){
						fs.rename(tilepath+".tmp", tilepath, function(){
							debug("<tile> [%s] saved", tilefile);
						});
					})); 

				});

			}));

		});
		
	});
	
	return this;
};

// fetch tile from remote
tileblaster.prototype.fetchtile = function(tileurl, mapid, fn){
	var self = this;

	self.queue.push(function(done){

		debug("<fetchtile> [%s] requested", tileurl);

		request({
			method: "GET",
			url: tileurl,
			encoding: null, // no conversion to string
			gzip: true, // some tileservers enforce gzip, so better expect it
			headers: { 'user-agent': self.config.useragent }, // be nice and tell who we are
		}).on('response', function(resp){

			// check mime type, status code, content-length, FIXME: cache!
			if (resp.statusCode !== 200) return fn(new Error("status code "+resp.statusCode), resp.statusCode);
			if (!resp.headers['content-type']||(!!self.maps[mapid].mime&&self.maps[mapid].mime.indexOf(resp.headers['content-type'])<0)) return fn(new Error("invalid content type "+resp.headers['content-type']), resp.statusCode);
			if (!!resp.headers['content-length']&&parseInt(resp.headers['content-type'],10)===0) return fn(new Error("no content"), resp.statusCode);

			// signal queue when read stream has finished
			this.on('finish', done);

			debug("<fetchtile> [%s] received", tileurl);
		
			return fn(null, this, {
				date: (new Date(resp.headers.date||Date.now()).valueOf()),
				size: (parseInt(resp.headers['content-length'],10)||null),
				mime: (resp.headers['content-type']||'apllication/octet-stream'),
			});
	
		}).on('error', function(err){
			return debug("<fetchtile> error fetching '%s': %s", tileurl, err), fn(err, null), done();
		});
	});
	
};

// optimization
tileblaster.prototype.optimize = function(mapid, ext){
	var self = this;
	
	var strm = new stream.PassThrough;
		
	if (self.maps[mapid].optimize) switch (ext) {
		case "png": 
			if (!optipng) break;
			debug("<optimize> [%s] png", mapid);
			strm = strm.pipe(new optipng(['-zc8','-zm8','-f5']));
		break;
		case "jpg": 
		case "jpeg": 
			if (!mozjpeg) break;
			debug("<optimize> [%s] jpg", mapid);
			strm = strm.pipe(mozjpeg());
		break;
	}
	
	return strm.pipe(zlib.createGzip({ level: 9 }));
		
};

// stream multiplexer
tileblaster.prototype._mux = function(fn){
	var self = this;
		
	// create a passthrough stream for every callback argument
	// call back with created stream
	var streams = Array.from(arguments).map(function(f){
		return (function(s,f){
			return f(s),s;
		})(new stream.PassThrough,f);
	});
	
	// multiplex to streams
	return (new stream.Writable({
		write: function(chunk, encoding, done) {
			streams.forEach(function(stream){
				stream.write(chunk);
			});
			done();
		},
		final: function(done) {
			streams.forEach(function(stream){
				stream.end();
			});
			done();
		}
	}));
	
};

// get all integer steps including start and end
tileblaster.prototype._range = function(z){
	var zooms = [], z = Array.from(z.sort()); // ensure order and deref
	while (z[0]<=z[1]) zooms.push(z[0]++);
	return zooms;
};

// convert lng to tile x
tileblaster.prototype._lngid = function(lng,z){
	return (Math.floor((lng+180)/360*Math.pow(2,z)));
};

// convert lat to tile y
tileblaster.prototype._latid = function(lat,z){
	return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,z)));
};

// check lonlat
tileblaster.prototype._checklnglat = function(lnglat) {
	if (!(lnglat instanceof Array) || lnglat.length !== 2) return false;
	lnglat = lnglat.map(parseFloat);
	return (!isNaN(lnglat[0]) && !isNaN(lnglat[1]) && lnglat[0] >= -180 && lnglat[0] <= 180 && lnglat[1] >= -90 && lnglat[1] <= 90);
};

// check if a tile meets specifications
tileblaster.prototype._checktile = function(mapid, z, x, y, r, ext, fn){
	var self = this;

	// check map identifier
	if (!/^[A-Za-z0-9\-\_]+$/.test(mapid)) return debug("<check> invalid map '%s'", mapid), fn(new Error("Invalid map identifier"));
	if (!self.maps[mapid]) return debug("<check> unknown map '%s'", mapid), fn(new Error("Unknown map identifier"));

	// check extension
	if (!!self.maps[mapid].ext && self.maps[mapid].ext.indexOf(ext) < 0) return debug("<check> disallowed extension '%s' for map '%s'", ext, mapid), fn(new Error("Disallowed extension"));

	// FIXME: check retina support?

	// check zoom level
	var zf = parseFloat(z,10);
	if (zf%1!==0) return debug("<check> invalid zoom float %d", zf), fn(new Error("Disallowed zoom factor"));
	if (zf < self.maps[mapid].zoom[0]) return debug("<check> invalid zoom %d < %d for map '%s'", zf, self.maps[mapid].zoom[0], mapid), fn(new Error("Disallowed zoom factor"));
	if (zf > self.maps[mapid].zoom[1]) return debug("<check> invalid zoom %d > %d for map '%s'", zf, self.maps[mapid].zoom[1], mapid), fn(new Error("Disallowed zoom factor"));

	// check bbox
	if (!!self.maps[mapid].bbox && (x < self.maps[mapid].bounds[z].w || x > self.maps[mapid].bounds[z].e)) return debug("<check> invalid tile x %d <> [%d-%d@%d] for map '%s'", x, self.maps[mapid].bounds[z].e, self.maps[mapid].bounds[z].w, z, mapid), fn(new Error("Disallowed tile x"));
	if (!!self.maps[mapid].bbox && (y < self.maps[mapid].bounds[z].n || y > self.maps[mapid].bounds[z].s)) return debug("<check> invalid tile y %d <> [%d-%d@%d] for map '%s'", y, self.maps[mapid].bounds[z].n, self.maps[mapid].bounds[z].s, z, mapid), fn(new Error("Disallowed tile y"));
	
	fn(null);

};

// transform parameters to url
tileblaster.prototype._tileurl = function(mapid, z, x, y, r, e){
	var self = this;
	return self.maps[mapid].url
		.replace("{s}", (self.maps[mapid].sub !== false) ? self.maps[mapid].sub[Math.floor(Math.random()*self.maps[mapid].sub.length)] : "")
		.replace("{x}", x.toFixed(0))
		.replace("{y}", y.toFixed(0))
		.replace("{z}", z.toFixed(0))
		.replace("{r}", (r) ? (self.maps[mapid].retina||"@2x") : "")
		.replace("{e}", (e) ? e : "");
};

// transform parameters to filename
tileblaster.prototype._tilefile = function(mapid, z, x, y, r, e){
	var self = this;
	return (mapid+"/"+z.toFixed(0)+"/"+x.toFixed(0)+"/"+y.toFixed(0)+((r) ? (self.maps[mapid].retina||"@2x") : "")+"."+((e) ? e : "")+".gz");
};

module.exports = tileblaster;
