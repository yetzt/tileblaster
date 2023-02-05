// recursive task queue
const tasks = module.exports = function tasks(jobs){
	if (!(this instanceof tasks)) return new tasks(...arguments);
	const self = this;
	self.stack = [];
	if (jobs) self.push(jobs);
	return this;
};

// add jobs to stack
tasks.prototype.push = function(jobs){
	const self = this;
	if (!Array.isArray(jobs)) jobs = [ jobs ];
	jobs.forEach(function(fn){
		if (typeof fn === "function") self.stack.push(fn);
	});
	return this;
};

// recursively run stack until empty
tasks.prototype.run = function(){
	const self = this;
	let args = Array.from(arguments);
	let fn = args.pop(); // callback should always be last argument
	if (typeof fn !== "function") throw new Error("tasks.run needs a function argument");
	if (typeof args === "function") fn = args, args = {};
	if (self.stack.length === 0) return fn(null, ...args);
	try {
		self.stack.shift()(...args, function(err){
			if (err) return fn(err, ...args);
			return self.run(...args, fn);
		});
	} catch (err) {
		return fn(err, ...args);
	}
	return this;
};
