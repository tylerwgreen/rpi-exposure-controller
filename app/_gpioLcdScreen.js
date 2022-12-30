const LCD = require('@oawu/lcd1602');

// For LCD1602 LCD board
var gpioLcdScreen = {
	_logger: null,
	_i2cAddress: null,
	_lcdScreen: null,
	init: function(logger, config){
		gpioLcdScreen._logger = logger.getLogger('gpioLcdScreen', 'silly');
gpioLcdScreen._logger.debug(['init()', config]);
		gpioLcdScreen._i2cAddress = config.i2cAddress;
		return new Promise((resolve, reject) => {
			gpioLcdScreen._lcdScreen = new LCD(gpioLcdScreen._i2cAddress);
			gpioLcdScreen.lines.reset().then(result => {
				resolve();
			});
		});
	},
	lines: {
		reset: function(){
			return new Promise((resolve, reject) => {
				gpioLcdScreen._lcdScreen.clear(function(){
					resolve();
				});
			});
		},
		top: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcdScreen._writeText(0, 0, text).then(result => {
						resolve();
					});
				});
			}
		},
		bottom: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcdScreen._writeText(1, 0, text).then(result => {
						resolve();
					});
				});
			}
		}
	},
	// writes the text and enques a callback to resolve the promise afte the text is actually written
	_writeText: function(row, col, str, closure = null){
		return new Promise((resolve, reject) => {
			gpioLcdScreen._lcdScreen.text(row, col, str);
			gpioLcdScreen._lcdScreen._queue.enqueue(next => {
				next();
				resolve();
			});
		});
	}
}
module.exports = gpioLcdScreen;
