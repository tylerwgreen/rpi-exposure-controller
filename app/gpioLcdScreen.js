const {Board, LCD} = require('johnny-five');
const RaspiIO = require('raspi-io').RaspiIO;

var gpioLcdScreen = {
	_logger: null,
	_board: null,
	_lcd: null,
	init: function(logger, config){
		gpioLcdScreen._logger = logger.getLogger('gpioLcdScreen', config.consoleLoggingLevel);
		gpioLcdScreen._logger.debug('gpioLcdScreen.init()');
		gpioLcdScreen._logger.verbose('initializing gpioLcdScreen');
		return new Promise((resolve, reject) => {
			gpioLcdScreen._board = new Board({
				io: new RaspiIO(),
				debug: config.boardDebug,
			});
			gpioLcdScreen._board.on('ready', () => {
				// for whatever reason, >> is printed to the console after the board is ready, add a new line to keep the conole log pretty
				console.log();
				// ==========
				// Use the board's `samplingInterval(ms)` to
				// control the actual MCU sampling rate.
				//
				// This will limit sampling of all Analog Input
				// and I2C sensors to once per second (1000 milliseconds)
				//
				// Keep in mind that calling this method
				// will ALWAYS OVERRIDE any per-sensor
				// interval/rate/frequency settings.
				// ==========
				// gpioLcdScreen._board.samplingInterval(1000);
				gpioLcdScreen._board.i2cConfig();
				gpioLcdScreen._lcd = new LCD({
					controller: config.lcdType,
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
			gpioLcdScreen._logger.debug('gpioLcdScreen.lines.reset()');
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
