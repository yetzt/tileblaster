// bare bones example builtin
module.exports = function({ req, res, opts, data }, next){
	console.log("I'm a plugin! my opts are: %s", JSON.stringify(opts));
	next();
};
