const {Board, LCD} = require('johnny-five');
var Raspi = require('raspi-io').RaspiIO;

var gpioLcdScreen = {
	_logger: null,
	// _i2cAddress: null,
	_lcd: null,
	init: function(logger, config){
		gpioLcdScreen._logger = logger.getLogger('gpioLcdScreen', config.consoleLoggingLevel);
		gpioLcdScreen._logger.silly('gpioLcdScreen.init()');
		gpioLcdScreen._logger.verbose('initializing gpioLcdScreen');
		// gpioLcdScreen._i2cAddress = config.i2cAddress;
		return new Promise((resolve, reject) => {
			var board = new Board({
				io: new Raspi()
			});
			board.on('ready', function() {
				gpioLcdScreen._lcd = new LCD({
					controller: 'LCM1602'
				});
				gpioLcdScreen._logger.info('gpioLcdScreen initialized');
				resolve('gpioLcdScreen initialized');
			});
		});
	},
	_trimText: function(text){
		gpioLcdScreen._logger.silly('gpioLcdScreen._trimText()');
		text = '' + text;
		text = text + '                ';
		text = text.slice(0, 16);
		return text;
	},
	lines: {
		reset: function(){
			gpioLcdScreen._logger.silly('gpioLcdScreen.lines.reset()');
			return new Promise((resolve, reject) => {
				gpioLcdScreen._lcd.clear();
				resolve();
			});
		},
		top: {
			update: function(text){
				gpioLcdScreen._logger.silly('gpioLcdScreen.lines.top.update()');
				return new Promise((resolve, reject) => {
					gpioLcdScreen._lcd.cursor(0, 0).print(gpioLcdScreen._trimText(text));
					resolve();
				});
			}
		},
		bottom: {
			update: function(text){
				gpioLcdScreen._logger.silly('gpioLcdScreen.lines.bottom.update()');
				return new Promise((resolve, reject) => {
					gpioLcdScreen._lcd.cursor(1, 0).print(gpioLcdScreen._trimText(text));
					resolve();
				});
			}
		}
	},
}
module.exports = gpioLcdScreen;
