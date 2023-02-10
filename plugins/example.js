// bare bones example plugin
module.exports = function({ req, res }, next){
	this.lib.debug.info("I'm a plugin!");
	next();
};
