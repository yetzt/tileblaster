const req = require("./req");
const format = require("util").format;

// load debug if available, otherwise emulate with console.error
module.exports = (req.exists("debug")) ? require("debug") : function(id){
	return ([id,"*"].includes(process.env.DEBUG)) ? function(){
		console.error("%s | %s", id, format(...arguments));
	} : function(){};
};
