// parse client request

module.exports = function({ req, res, opts, data }, next){

	data.req = {};

	data.req.path = req.path;

	// cache things
	data.req.etag = req.headers["if-none-match"] || null;
	data.req.last = req.headers["if-modified-since"] || null;

	// examine some headers for capabilities
	data.req.supports = {
		webp: (req.headers.accept||"").includes("image/webp"),
		avif: (req.headers.accept||"").includes("image/avif"),
		br: (req.headers["accept-encoding"]||"").includes("br"),
		gz: (req.headers["accept-encoding"]||"").includes("gzip"),
	};

	// languages
	data.req.lang = ((!!req.headers["accept-language"]) ? req.headers["accept-language"].split(",").map(function(lang){
		return lang.split(";").shift().trim();
	}) : []).map(function(lang){
		return lang.slice(0,2).toLowerCase();
	}).filter(function(lang,i,languages){
		return languages.indexOf(lang) === i;
	});

	// patch in override parse function
	if (opts.hasOwnProperty("parse") && typeof opts.parse === "function") return opts.parse(req, function(err, params){
		if (err) return next(err);
		data.params = { ...data.params, params };
		next();
	});

	// get params from steps
	data.req.params = {
		m: data.map,
		x: parseInt(req.steps[2],10), // lon
		y: parseInt(req.steps[3],10), // lat
		z: parseInt(req.steps[1],10), // zoom
		r: req.steps[3].includes("@") ? req.steps[3].slice(req.steps[3].indexOf("@"), req.steps[3].indexOf("x")+1) : "", // raw density marker ("@2x")
		e: req.steps[3].includes(".") ? req.steps[3].slice(req.steps[3].indexOf(".", Math.max(0,req.steps[3].indexOf("x")))+1) : null, // extension
	};

	// density options
	data.req.params.d = data.req.params.r ? parseFloat(data.req.params.r.slice(1,-1)) : 1;
	data.req.params.w = Math.round(data.req.params.d * 256);

	next();
};
