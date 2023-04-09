
// placeholder debug module

const colrz = require("colrz");
const path = require("node:path");
const format = require("node:util").format;

// enabled if env.DEBUG has tileblaster or *
const enabled = (process.env.DEBUG && process.env.DEBUG.split(/, ?/).find(function(debug){ return debug === "*" || debug.slice(0,11) === "tileblaster"; }) && true);

// time between outputs helper
let time = Date.now();
function since(){
	let since = Date.now()-time;
	time = Date.now();
	if (since > 300000) return "+"+Math.round(since/60000)+"m";
	if (since > 1000) return "+"+(since/1000).toFixed(1)+"s";
	return "+"+since.toFixed(0)+"ms";
}

function prefix(){
	if (!process.env.workerid) return "";
	return format("#%s".magenta+" | ".grey, process.env.workerid.magenta);
};

// default: just print with since
module.exports = function(){
	if (enabled) console.error(prefix()+"%s %s", format(...arguments), since());
}

// warnings with a yellow label
module.exports.warn = function(){
	if (enabled) console.error(prefix()+"Warning:".yellow+" %s %s", format(...arguments), since().brightYellow);
};

// info with a blue label
module.exports.info = function(){
	if (enabled) console.error(prefix()+"Info:".cyan+" %s %s", format(...arguments), since().brightBlue);
};

// errors with a red label and fancy printing of Error instances FIXME refactor
module.exports.error = function(){
	if (!enabled) return;

	let stacks = [];
	arguments = Array.from(arguments).map(function(arg){
		if (arg instanceof Error) {
			if (arg.stack) stacks.push(arg.stack);
			return arg.message;
		}
		return arg;
	});

	console.error(prefix()+"Error:".red+" %s %s", format(...arguments), since().brightRed);

	// format and prettify stack (a little overkill)
	stacks.forEach(function(stack){
		const lines = stack.split("\n").slice(1);
		if (lines.length === 0) return;
		console.error("┏┉┉┉ ".brightRed+"Stack".red+" ┉┉┉".brightRed);
		console.error("┋".brightRed);
		lines.forEach(function(line){
			console.error("┋".brightRed+" %s", line.trim());
		});
		console.error("┋".brightRed);
		console.error("┗┉┉┉".brightRed);
	});
};
