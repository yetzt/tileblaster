
// require wrapper that doesn't throw errors
const req = function req(r){
	return (r && typeof r === "string" && (req.has(r) || req.exists(r))) ? require(r) : undefined;
};

// cache
req.modules = {};

// check if module is known
req.has = function(r){
	return req.modules.hasOwnProperty(r) ? req.modules[r] : false;
};

// check if module exists
req.exists = function(r){
	try {
		require.resolve(r);
	} catch(err) {
		return req.modules[r] = false;
	}
	return req.modules[r] = true;
};

// export
module.exports = req;
