// minimalistic string tempate, no regex
const types = { string: true, number: true, boolean: true };
const strtpl = module.exports = function strtpl(str, params){
	let out = "", j = 0;
	for (let i = 0; i < str.length; i++) {
		j = i+1;
		if (str[i] === "{" && str[i+2] === "}" && str[j] >= "a" && str[j] <= "z") {
			if (types[typeof params[str[j]]]) out += params[str[j]];
			i+= 2;
		} else {
			out += str[i];
		}
	}
	return out;
};
