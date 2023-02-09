// parse path into params

module.exports = function({ req, res, opts, data }, next){

	// examine some headers for capabilities
	data.capabilities = {
		webp: (req.headers.accept||"").includes("image/webp"),
		avif: (req.headers.accept||"").includes("image/avif"),
		br: (req.headers["accept-encoding"]||"").includes("br"),
		gz: (req.headers["accept-encoding"]||"").includes("gzip"),
		languages: (!!req.headers["accept-language"]) ? req.headers["accept-language"].split(",").map(function(lang){
			return lang.split(";").shift().trim();
		}) : null,
	};

	// patch in override parse function
	if (opts.hasOwnProperty("parse") && typeof opts.parse === "function") return opts.parse(req, function(err, params){
		if (err) return next(err);
		data.params = { ...data.params, params };
		next();
	});

	// get params from steps FIXME: defaults from opts
	data.params = {
		...data.params,
		m: data.map,
		z: parseInt(data.steps[1],10), // zoom
		x: parseInt(data.steps[2],10), // lon
		y: parseInt(data.steps[3],10), // lat
		r: data.steps[3].includes("@") ? data.steps[3].slice(data.steps[3].indexOf("@"), data.steps[3].indexOf("x")+1) : null, // density marker ("@2x")
		f: data.steps[3].includes(".") ? data.steps[3].slice(data.steps[3].indexOf(".")) : null, // extension, including dot
	};

	// compat
	data.params.d = data.params.r && parseFloat(data.params.r.slice(1,-1)); // density as float
	data.params.e = data.params.f && data.params.f.slice(1); // extension without dot

	// destination template for cache
	data.dest = "/"+data.params.map+"/{z}/{x}/{y}{r}{e}{z}";

	next();
};
