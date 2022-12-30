const {Board, LCD} = require('johnny-five');
var Raspi = require('raspi-io').RaspiIO;

var gpioLcd = {
	_logger: null,
	// _i2cAddress: null,
	_lcd: null,
	init: function(logger, config){
		gpioLcd._logger = logger.getLogger('gpioLcd', 'silly');
gpioLcd._logger.debug(['init()', config]);
		// gpioLcd._i2cAddress = config.i2cAddress;
		return new Promise((resolve, reject) => {
			var board = new Board({
				io: new Raspi()
			});
			board.on('ready', function() {
				gpioLcd._lcd = new LCD({
					controller: 'LCM1602'
				});
				resolve();
			});
		});
	},
	_trimText: function(text){
		text = '' + text;
		text = text + '                ';
		text = text.slice(0, 16);
		return text;
	},
	lines: {
		reset: function(){
			return new Promise((resolve, reject) => {
				gpioLcd._lcd.clear();
				resolve();
			});
		},
		top: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcd._lcd.cursor(0, 0).print(gpioLcd._trimText(text));
					resolve();
				});
			}
		},
		bottom: {
			update: function(text){
				return new Promise((resolve, reject) => {
					gpioLcd._lcd.cursor(1, 0).print(gpioLcd._trimText(text));
					resolve();
				});
			}
		}
	},
}
module.exports = gpioLcd;
