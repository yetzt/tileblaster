const phin = require("phin");

// prepare agents with keepalive enabled
const agents = {
	http: new require("node:http").Agent({ keepAlive: true }),
	https: new require("node:https").Agent({ keepAlive: true }),
};

// agentify phin
const retrieve = module.exports = async function retrieve(opts, fn) {
	if (typeof opts === "string") opts = { url: opts }; // ensure opts is object
	if (!opts.hasOwnProperty("core")) opts.core = {}; // ensure core is present
	if (!opts.core.hasOwnProperty("agent")) opts.core.agent = agents[opts.url.slice(0,opts.url.indexOf(":"))]; // set agent by protocol
	return phin(opts, fn);
};
