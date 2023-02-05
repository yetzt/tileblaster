
const tileblaster = module.exports = function tileblaster(config){
	if (!(this instanceof tileblaster)) return new tileblaster(...arguments);
	const self = this;


	return this;
};

// run if called directly
if (require.main === module) {
	tileblaster({
		port: 8080,
		...require("./config"),
	});
};
