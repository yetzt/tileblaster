const phn = require("phn");

// prepare agents with keepalive enabled
const agents = {
	http: new require("node:http").Agent({ keepAlive: true }),
	https: new require("node:https").Agent({ keepAlive: true }),
};

// agentify phn
const retrieve = module.exports = async function retrieve(opts) {
	if (typeof opts === "string") opts = { url: opts }; // ensure opts is object
	if (!opts.hasOwnProperty("core")) opts.core = {}; // ensure core is present
	if (!opts.core.hasOwnProperty("agent")) opts.core.agent = agents[opts.url.slice(0,opts.url.indexOf(":"))]; // set agent by protocol
	return phn(opts);
};
