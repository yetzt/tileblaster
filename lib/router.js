const normalize = require("node:path").normalize;
const tasks = require("./tasks");

// unfancy router, good enough for tileblaster
const router = module.exports = function router({ mountpoint }) {
	if (!(this instanceof router)) return new router(...arguments);
	const self = this;

	self.routes = {};
	self.uses = [];

	// mountpoint, without trailing slash
	self.mountpoint = self.fixpath(mountpoint || "");

	// default default route, very bare bones
	self.routes[""] = function(req, res){
		res.statusCode = 404, res.end(), res.used = true;
	};

	return self;
};

// route handler, pass to server
router.prototype.serve = function(req, res) {
	const self = this

	// prepare
	let path = req.url

	// if url get path only
	if (path.charCodeAt(0) !== 47) path = path.replace(/^https?:\/\/.*?\//,"/");

	// trim query string and fragment
	if (path.includes("?")) path = path.slice(0, path.indexOf("?"));
	if (path.includes("#")) path = path.slice(0, path.indexOf("#"));

	// trim mountpoint
	if (self.mountpoint && path.slice(0,self.mountpoint.length) === self.mountpoint) path = path.slice(self.mountpoint.length);

	// fix path
	path = self.fixpath(path);

	// FIXME some header prep? other things?

	// find route
	let route = path;
	// while (!self.routes.hasOwnProperty(route)) route = route.slice(0, route.lastIndexOf("/")); // in case we need it later
	if (!self.routes.hasOwnProperty(route)) route = ""; // good for now

	// apply to req
	req.path = path;
	req.route = route;

	// apply uses
	tasks(self.uses).run(req, res, function(err, req, res){

		// very unglamourous server error
		if (err) return res.statusCode = 500, res.end();

		// call route
		self.routes[req.route](req, res);

	});

};

// add route
router.prototype.route = function(path, route) { // function(req, res){}
	return this.routes[path] = route, this;
};

// add middleware
router.prototype.use = function(use) { // function(req, res, next){}
	return this.uses.push(use), this;
};

// set default route
router.prototype.default = function(route) {
	return this.routes[""] = route, this;
};

// fix path
router.prototype.fixpath = function(path) {

	// ensure leadin slash
	if (path.charCodeAt(0) !== 47) path = "/"+path;

	// remove trailing slashes
	while (path.length > 1 && path.charCodeAt(path.length-1) === 47) path = path.slice(0, -1);

	// normalize path
	path = normalize(path);

	return path;
};
