// convert a date object into a rfc 822 date

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

module.exports = function(date){
	let tzo = date.getTimezoneOffset();
	return days[date.getDay()] + ", " + date.getDate().toString().padStart(2,"0") + " " + months[date.getMonth()] + " " + date.getFullYear() + " " + date.getHours().toString().padStart(2,"0") + ":" + date.getMinutes().toString().padStart(2,"0") + ":" + date.getSeconds().toString().padStart(2,"0") + " " + (tzo > 0 ? "-" : "+") + Math.abs(Math.floor(tzo/60)).toString().padStart(2,"0") + Math.abs(tzo%60).toString().padStart(2,"0");
};
