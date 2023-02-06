// bare bones example plugin
module.exports = function({ req, res }, next){
	console.log("I'm a plugin!");
	next();
};
