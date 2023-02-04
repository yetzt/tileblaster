#!/usr/bin/env node

var fs = require("fs");
var url = require("url");
var path = require("path");
var http = require("http");
var util = require("util");
var zlib = require("zlib");
var stream = require("stream");

var debug = require("debug")("tileblaster");
var phin = require("phin");
var queue = require("quu");
var glob = require("glob");
var dur = require("dur");

// optional dependencies; if only
try { var pnck = require("pnck"); } catch (err) { var pnck = null; }
try { var jpck = require("jpck"); } catch (err) { var jpck = null; }
try { var zopfli = require("node-zopfli"); } catch (err) { var zopfli = null; }
try { var cloudtiles = require("cloudtiles"); } catch (err) { var cloudtiles = null; }

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
	json:     'text/json',
	geojson:  'text/json',
	topojson: 'text/json',
	// obscure ones:
	arcjson:  'text/json',
	geobson:  'application/octet-stream',
	geoamf:   'application/octet-stream',
	arcamf:   'application/octet-stream',
};

// compression formats
tileblaster.prototype.comp = [ "gz", "br" ];

// initialize
tileblaster.prototype.init = function(config){
	var self = this;

	debug("<init> inizializing");

	// server
	self.srvr = null;

	// statistics
	self.statistics = {
		hits: 0,
		phits: 0,
		served: 0,
		last: Date.now()
	};

	// http agents
	self.agents = {};

	// compression queue
	self.cqueue = queue(1);

	// have maps with active expires?
	self.expiration = false;

	// reconfigure
	self.reconfigure(config);

	return this;

};

// reconfigure
tileblaster.prototype.reconfigure = function(config){
	var self = this;

	debug("<init> reconfiguring");

	// cache
	self.errcache = {};

	// keep config
	self.config = config || {};

	// id
	self.config.id = (!!self.config.id) ? self.config.id : "tileblaster";

	// socket
	self.config.socket = path.resolve(self.config.socket || "./"+self.config.id+".socket");

	// tile path
	self.config.tiles = path.resolve(self.config.tiles || "./tiles");

	// expires (default: never)
	self.config.expires = (dur(self.config.expires) || Infinity);

	// queue size
	self.config.queue = Math.max(parseInt(self.config.queue,10)||100,1);

	// extend mime types
	if (!!self.config.mime) Object.keys(self.config.mime).map(function(ext){ self.mime[ext] = self.config.mime[ext] });

	// queue
	self.queue = queue(self.config.queue);

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
			if (!map.res) map.res = [ "" ];
			if (!(map.res instanceof Array)) map.res = [ map.res ];
			map.res = map.res.filter(function(res){
				return (res === "") || /^@[1-9][0-9]*(\.[0-9]+)?x$/.test(res);
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
			if (!map.expires) map.expires = Infinity;

			// cache
			map.cache = (!map.hasOwnProperty("cache")) ? true : (!!map.cache);

			// compression
			map.compress = map.compress.filter(function(c){ return (self.comp.indexOf(c) >= 0) });

			// is cloudtile
			map.cloudtiles = (map.cloudtiles === true);

			return map;

		})(self.config.maps[id],id), maps;

	},{});

	// build user agent
	if (!self.config.useragent) self.config.useragent = util.format("%s/%s (+%s)", pckg.name, pckg.version, pckg.homepage);

	// cleanup timer
	self.config.cleanup = (!!self.config.cleanup) ? dur(self.config.cleanup) : false;
	if (!!self.cleaner) clearInterval(self.cleaner);
	if (self.config.cleanup && self.expiration) self.cleaner = setInterval(function(){ self.cleanup(); }, self.config.cleanup).unref();

};

// return server
tileblaster.prototype.server = function(){
	var self = this;

	self.srvr = http.createServer(function (req, res) {

		self.statistics.hits++;

		// check http method
		if (req.method !== "GET") return debug("<server> invalid method: %s", req.method), (!!self.config.hints&&res.setHeader("x-err-hint","invalid method")), res.statusCode = 405, res.end();

		// parse request
		var t = self._tilepath(url.parse(req.url).pathname.toLowerCase());
		if (!t) return debug("<server> invalid request: %s", url.parse(req.url).pathname), (!!self.config.hints&&res.setHeader("x-err-hint","invalid request")), res.statusCode = 404, res.end();

		// check if map exists
		if (!self.maps.hasOwnProperty(t.mapid)) return debug("<server> requested invalid map: %s", t.mapid), (!!self.config.hints&&res.setHeader("x-err-hint","invalid map")), res.statusCode = 404, res.end();

		// deliver file if requested
		if (t.type === "file") {
			switch (t.file) {
				case "tile.json":
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(self._tilejson(t.mapid, ((req.headers["x-https"] === "on") ? "https://" : "http://")+req.headers["host"]));
				break;
				default:
					return debug("<server> requested invalid file: %s", t.p), (!!self.config.hints&&res.setHeader("x-err-hint","invalid file")), res.statusCode = 404, res.end();
				break;
			}
			return;
		}

		// res
		t.r = (!!t.r && (self.maps[t.mapid].res.indexOf(t.r) >= 0) ? t.r : false);

		debug("<server> [%s] requested", t.p);

		self.tile(t.mapid, t.z, t.x, t.y, t.r, t.ext, function(err, stream, meta){
			if (err) return debug("<server> [%s] error: %s", t.p, err.toString()), (!!self.config.hints&&res.setHeader("x-err-hint",err.toString())), res.statusCode = 204, res.end();

			// send headers
			res.writeHead(200, { "Content-Type": meta['content-type'] });

			stream.on("end", function(){
				debug("<server> [%s] done", t.p);
				self.statistics.served++;
			});

			// pipe stream to http client
			stream.pipe(res);

		});

	});

	// in case self.listen() was called before self.server();
	if (self.listentome) self.listen();
	if (!!self.config.heartbeat) self.heartbeat();

	return this;

};

// listen on socket
tileblaster.prototype.listen = function(){
	var self = this;

	// wait for server to be ready
	if (!self.srvr) return (self.listentome = true), this;

	// omit socket if port specified
	if (self.config.port) return self.srvr.listen(self.config.port, function(err){
		if (err) debug("<listen> unable to listen on port %d", self.config.port), process.exit(1);
		debug("<listen> listening on port %d", self.config.port);
	}), self;

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

	if (!!self.config.heartbeat) self.nsa = require("nsa")({
		server: self.config.heartbeat,
		service: self.config.id,
		interval: "10s"
	}).start(function(){
		// send stats every five minutes
		setInterval(function(){

			var h = self.statistics.hits - self.statistics.phits;
			var t = Date.now() - self.statistics.last;
			self.statistics.phits = self.statistics.hits;
			self.statistics.last = Date.now();
			var s = {
				"req/s": ((h/t)*1000).toFixed(2),
				"served": self.statistics.served
			};
			self.nsa.send(s);
			debug("<stat> %s req/s, %s served", s["req/s"], s.served);
		},60000).unref();

	});

	(function(terminate){

		process.on("SIGTERM", function(){ terminate("SIGTERM"); });
		process.on("SIGINT", function(){ terminate("SIGINT"); });

	})(function(signal){
		debug("<terminate> %s", signal);
		debug("<heartbeat> statistics: %j", self.statistics);
		self.nsa.end(function(){
			process.exit(0);
		});
	});

	return this;
};

// delete expired tiles
tileblaster.prototype.cleanup = function(){
	var self = this;

	// clean up error cache
	var d = Date.now();
	self.errcache = self.errcache.filter(function(e){
		return (e.until > d);
	});

	// FIXME: extra process

	// clean up map tiles
	Object.keys(self.maps).filter(function(mapid){
		return (!!self.maps[mapid].expires);
	}).forEach(function(mapid){
		self.queue.push(function(done){
			debug("<cleanup> [%s] start", mapid);
			glob(path.resolve(self.config.tiles, mapid, '**/*'), function(err, files){
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
		if (!!self.errcache[tilefile] && (self.errcache[tilefile].until > Date.now())) return fn(new Error("Known bad tile: "+self.errcache[tilefile].err), null);

		// resolve tile path
		var tilepath = path.resolve(self.config.tiles, tilefile);

		// construct upstream tile url
		var tileurl = self._tileurl(mapid, z, x, y, r, e);

		(function(next){

			// cloudtile branch
			if (self.maps[mapid].cloudtiles) return self.cloudtile(tileurl, mapid, z, x, y, next);
			self.fetchtile(tileurl, mapid, next);

		})(function(err, tilestream, meta){

			if (err) {
				if (stream !== null) {
					// cache error tile
					self.errcache[tilefile] = { until: (Date.now()+self.config.maps[mapid].expires), err: err, code: stream };

					// mark tile as erronous in file system
					fs.writeFile(tilepath+".err", JSON.stringify(self.errcache[tilefile]), function(err){
						if (err) return debug("<tile> [%s.err] error: %s", tilefile, err.toString());
					});
				}
				return debug("<tile> [%s] error: %s", tilefile, err.toString()), fn(err, stream);
			}

			debug("<tile> [%s] fetched", tilefile);

			var streams = [];

			streams.push(function(tilestream){
				// call back with stream
				fn(null, tilestream, {
					'content-type': (self.mime[e])
				});
			});

			if (!!self.config.maps[mapid].cache) streams.push(function(tilestream){

				// don't overwrite if tile exists
				fs.access(tilepath, fs.constants.F_OK, function(err){
					if (!err) return debug("<tile> [%s] exists", tilefile);

					fs.mkdir(path.dirname(tilepath), { recursive: true }, function(err){
						if (err) return debug("<tile> [%s] -- %s", tilefile, err);

						// save to tmp file, rename when done
						tilestream.pipe(fs.createWriteStream(tilepath+".tmp").on('finish', function(){
							fs.rename(tilepath+".tmp", tilepath, function(){

								// compress
								if (self.config.maps[mapid].compress instanceof Array && self.config.maps[mapid].compress.length > 0) self.compress(tilepath, self.config.maps[mapid].compress);

								debug("<tile> [%s] saved", tilefile);
							});
						}));

					});

				});

			});

			// stream mux
			tilestream.pipe(self.optimize(mapid, e)).pipe(self._mux.apply(self, streams));

		});

	});

	return this;
};

// fetch tile from remote
tileblaster.prototype.fetchtile = function(tileurl, mapid, fn){
	var self = this;

	self.queue.push(function(done){

		// create agent
		var proto = tileurl.substr(0,tileurl.indexOf(":"));
		if (!self.agents.hasOwnProperty(proto)) self.agents[proto] = new require(proto).Agent({ keepAlive: true });

		debug("<fetchtile> [%s] requested", tileurl);
		var d = 0;

		phin({
			url: tileurl,
			headers: {
				'user-agent': self.config.useragent, // be nice and tell who we are
				...(self.config.maps[mapid].headers||{}), // extra headers from config
			},
			parse: "none",
			stream: true,
			followRedirects: true,
			compression: true,
			timeout: 10000,
			core: { agent: self.agents[proto] },
		}).then(function(resp){

			// check mime type, status code, content-length, FIXME: cache!
			if (resp.statusCode !== 200) return resp.stream.destroy(), fn(new Error("status code "+resp.statusCode), resp.statusCode);

			// parse raw headers if not set
			if (!resp.headers) {
				let rawHeaders = [ ...resp.rawHeaders ];
				resp.headers = {};
				while (rawHeaders.length > 0) resp.headers[ rawHeaders.shift().toLowerCase() ] = rawHeaders.shift();
			};

			// check headers
			if (!resp.headers['content-type']||(!!self.maps[mapid].mime&&self.maps[mapid].mime.indexOf(resp.headers['content-type'])<0)) return resp.stream.destroy(), fn(new Error("invalid content type "+resp.headers['content-type']), resp.statusCode);
			if (!!resp.headers['content-length']&&parseInt(resp.headers['content-length'],10)===0) return resp.stream.destroy(), fn(new Error("no content"), resp.statusCode);

			// signal queue when read stream has finished
			resp.stream.once('end', function(){ (!d++)&&done(); });

			debug("<fetchtile> [%s] received", tileurl);

			return fn(null, resp.stream, {
				date: (new Date(resp.headers.date||Date.now()).valueOf()),
				size: (parseInt(resp.headers['content-length'],10)||null),
				mime: (resp.headers['content-type']||'application/octet-stream'),
			});

		}).catch(function(err){
			return debug("<fetchtile> error fetching '%s': %s", tileurl, err), fn(err, null), done();
		});

	});

};

// get cloudtile
tileblaster.prototype.cloudtile = function(tileurl, mapid, z, x, y, fn) {
	const self = this;
	if (!cloudtiles) return fn(new Error("Missing dependency: cloudtiles"));
	if (!self.maps[mapid].c) self.maps[mapid].c = cloudtiles(tileurl, { tms: !!self.maps[mapid].tms });
	self.maps[mapid].c.getTile(z,x,y, function(err, buffer){
		if (err) return fn(err);
		return fn(null, stream.Readable.from(buffer));
	});
	return self;
};

// optimization
tileblaster.prototype.optimize = function(mapid, ext){
	var self = this;

	var strm = new stream.PassThrough;

	if (self.maps[mapid].optimize) switch (ext) {
		case "png":
			if (!pnck) break;
			debug("<optimize> [%s] png", mapid);
			return strm.pipe(pnck(['-o7','-zc8','-zm8','-f5','-quiet','-fix']));
		break;
		case "jpg":
		case "jpeg":
			if (!jpck) break;
			debug("<optimize> [%s] jpg", mapid);
			strm = strm.pipe(jpck({
				optimize: true,
				copy: "none",
				fastcrush: true,
				limit: 102400
			}));
		break;
	}

	return strm;

};

// compression
tileblaster.prototype.compress = function(file, comp){
	var self = this;
	comp.forEach(function(c){
		self.cqueue.push(function(done){
			switch (c) {
				case "br":
					// use builtin brotli
					fs.createReadStream(file).pipe(zlib.createBrotliCompress({
						level: 6
					})).pipe(fs.createWriteStream(file+".br.tmp")).on("finish", function(){
						fs.rename(file+".br.tmp", file+".br", function(){
							debug("<tile> [%s] compressed with brotli", file);
							done();
						});
					});
				break;
				case "gz":
					if (zopfli !== null) {
						// use zopfli
						fs.createReadStream(file).pipe(zopfli.createGzip({
							numiterations: 5, // don't block the queue too long
						})).pipe(fs.createWriteStream(file+".gz.tmp")).on("finish", function(){
							fs.rename(file+".gz.tmp", file+".gz", function(){
								debug("<tile> [%s] compressed with zopfli", file);
								done();
							});
						});
					} else {
						// use builtin gzip
						fs.createReadStream(file).pipe(zlib.createGzip({
							level: 6
						})).pipe(fs.createWriteStream(file+".gz.tmp")).on("finish", function(){
							fs.rename(file+".gz.tmp", file+".gz", function(){
								debug("<tile> [%s] compressed with gzip", file);
								done();
							});
						});
					}
				break;
				default:
					done();
				break;
			}
		});
	});
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
	var zooms = [], z = Array.from(z.sort(function(a,b){ return a-b; })); // ensure order and deref
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

	// check density
	if (!!r && self.maps[mapid].res.indexOf(r) < 0) return debug("<check> disallowed density '%s' for map '%s'", res, mapid), fn(new Error("Disallowed density"));

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

	// when backend uses tms
	if (!!self.maps[mapid].tms) y = Math.pow(2,z)-y-1;

	return self.maps[mapid].url
		.replace("{s}", (self.maps[mapid].sub !== false) ? self.maps[mapid].sub[Math.floor(Math.random()*self.maps[mapid].sub.length)] : "")
		.replace("{x}", x.toFixed(0))
		.replace("{y}", y.toFixed(0))
		.replace("{z}", z.toFixed(0))
		.replace("{r}", (!!r) ? r : "")
		.replace("{e}", (e) ? e : "");
};

// transform parameters to filename
tileblaster.prototype._tilefile = function(mapid, z, x, y, r, e){
	var self = this;
	return (mapid+"/"+z.toFixed(0)+"/"+x.toFixed(0)+"/"+y.toFixed(0)+((!!r)?r:"")+"."+((e) ? e : ""));
};

// path parsing regular expression
tileblaster.prototype._pathregx = /\/(([a-z0-9\-\_\.]+)\/((tile\.json)|([0-9]+)\/([0-9]+)\/([0-9]+)(@([0-9]+(\.[0-9]+)?)x)?\.([a-z0-9\.]+)))$/;

// transform path to parameters
tileblaster.prototype._tilepath = function(p) {
	var r = (this._pathregx.exec(p));
	if (!r) return false;
	if (!r[4]) {
		return {
			type: "tile",
			p: r[1],
			mapid: r[2],
			z: parseInt(r[5],10),
			x: parseInt(r[6],10),
			y: parseInt(r[7],10),
			r: r[8],
			ext: r[11],
		};
	} else {
		return {
			type: "file",
			p: r[1],
			mapid: r[2],
			file: r[4],
		};
	}
};

// assemble tilejson (good enough)
tileblaster.prototype._tilejson = function(id, base) {
	var self = this;
	return JSON.stringify({
		tilejson: "2.2.0",
		minzoom: self.config.maps[id].zoom[0],
		maxzoom: self.config.maps[id].zoom[1],
		bounds: self.config.maps[id].bbox,
		tiles: [ (self.config.base||base)+"/"+id+"/{z}/{x}/{y}"+(self.config.maps[id].res[0]||"")+"."+self.config.maps[id].ext[0] ],
	});
};

module.exports = tileblaster;
