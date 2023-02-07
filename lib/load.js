
// require wrapper that doesn't throw errors
const load = function load(r){
	return (r && typeof r === "string" && (load.has(r) || load.exists(r))) ? require(r) : undefined;
};

// cache
load.modules = {};

// check if module is known
load.has = function(r){
	return load.modules.hasOwnProperty(r) ? load.modules[r] : false;
};

// check if module exists
load.exists = function(r){
	try {
		require.resolve(r);
	} catch(err) {
		return load.modules[r] = false;
	}
	return load.modules[r] = true;
};

// export
module.exports = load;
