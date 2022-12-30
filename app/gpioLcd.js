var five = require('johnny-five');
var Raspi = require('raspi-io').RaspiIO;

var gpioLcd = {
	_logger: null,
	_i2cAddress: null,
	_lcd: null,
	init: function(logger, config){
		gpioLcd._logger = logger.getLogger('gpioLcd', 'silly');
gpioLcd._logger.debug(['init()', config]);
		gpioLcd._i2cAddress = config.i2cAddress;
		return new Promise((resolve, reject) => {
			var board = new five.Board({
				io: new Raspi()
			});
			board.on('ready', function() {
				// var led = new five.Led('P1-13');
				// var led = new five.Led('GPIO16');
				// led.blink();
				
				var lcd = new five.LCD({
					controller: "LCM1602"
				});
				lcd.cursor(2, 0);
				var i = 0;
				setInterval(function(){
					lcd.cursor(0, 0).print(('' + i).repeat(8)).cursor(1, 0).print(('' + i).repeat(8)).cursor(2, 0);
					i++;
				}, 1000);
			});
			resolve();
		});
	},
	/* lines: {
		reset: function(){
			return new Promise((resolve, reject) => {
				gpioLcd._lcd.clear(function(){
					resolve();
				});
			});
		},
		top: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcd._writeText(0, 0, text).then(result => {
						resolve();
					});
				});
			}
		},
		bottom: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcd._writeText(1, 0, text).then(result => {
						resolve();
					});
				});
			}
		}
	},
	// writes the text and enques a callback to resolve the promise afte the text is actually written
	_writeText: function(row, col, str, closure = null){
		return new Promise((resolve, reject) => {
			gpioLcd._lcd.text(row, col, str);
			gpioLcd._lcd._queue.enqueue(next => {
				next();
				resolve();
			});
		});
	} */
}
module.exports = gpioLcd;
