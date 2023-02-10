
// placeholder debug module

const colrz = require("colrz");
const path = require("path");
const format = require("util").format;

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

// default: just print with since
module.exports = function(){
	if (enabled) console.error("%s %s", format(...arguments), since());
}

// warnings with a yellow label
module.exports.warn = function(){
	if (enabled) console.error("Warning:".yellow+" %s %s", format(...arguments), since().brightYellow);
};

// info with a blue label
module.exports.info = function(){
	if (enabled) console.error("Info:".cyan+" %s %s", format(...arguments), since().brightBlue);
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

	console.error("Error:".red+" %s %s", format(...arguments), since().brightRed);

	// format and prettify stack (a little overkill)
	stacks.forEach(function(stack){
		const lines = stack.split("\n").slice(1);
		if (lines.length === 0) return;
		console.error("┏┉┉┉ ".brightRed+"Stack".red+" ┉┉┉".brightRed);
		console.error("┋".brightRed);
		lines.forEach(function(line){
			console.error("┋".brightRed+" %s", line.trim());

			/*
			line = line.trim().split(" ").slice(1);
			let file = line.pop();
			let at = line.join(" ");
			file = file.replace(/^\(|\)$/g,"").split(":");
			let pos = file.pop();
			let num = file.pop();
			file = file.join(":");
			file = path.relative(path.resolve(__dirname,".."), file);

			if (file.slice(0,5) === "node:") {
				console.error("┋".brightRed+"  %s "+"→".grey+" %s", file.grey, at.red);
			} else {
				if (at) {
					console.error("┋".brightRed+"  %s"+(":".grey)+"%s "+"→".grey+" %s", file.white.underline, num.white, at.brightRed);
				} else {
					console.error("┋".brightRed+"  %s"+(":".grey)+"%s", file.white.underline, num.white);
				}
			}
			*/
		});
		console.error("┋".brightRed);
		console.error("┗┉┉┉".brightRed);
	});
};
