const {Board, LCD} = require('johnny-five');
const RaspiIO = require('raspi-io').RaspiIO;

var gpioLcdScreen = {
	_logger: null,
	_config: null,
	_board: null,
	_lcd: null,
	init: function(logger, config){
		gpioLcdScreen._logger = logger.getLogger('gpioLcdScreen', config.consoleLoggingLevel);
		gpioLcdScreen._logger.debug('gpioLcdScreen.init()');
		gpioLcdScreen._logger.verbose('initializing gpioLcdScreen');
		gpioLcdScreen._config = config;
		gpioLcdScreen._logger.info('gpioLcdScreen initialized');
		return new Promise((resolve, reject) => {
			gpioLcdScreen._board = new Board({
				io: new RaspiIO(),
				debug: gpioLcdScreen._config.boardDebug,
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
					controller: gpioLcdScreen._config.lcdType,
				});
				resolve('gpioLcdScreen configured');
			});
		});
	},
	_isResetting: false,
	_resetLCD: function(){
		gpioLcdScreen._logger.verbose('gpioLcdScreen._resetLCD()');
		return new Promise((resolve, reject) => {
			if(gpioLcdScreen._isResetting){
				gpioLcdScreen._logger.error('LCD is resetting');
				resolve();
			}else{
				gpioLcdScreen._isResetting = true;
				try{
					var i = setInterval(() => {
						// Helper function to pulse the EN bit on the LCM1602 layout
						// 0x30 is the reset nibble. We merge it with 0x08 to keep the backlight on.
						// EN high = data | 0x04. EN low = data & ~0x04.
						const pulseLcmEnable = (dataByte) => {
							gpioLcdScreen._board.i2cWrite(gpioLcdScreen._config.bus.address, [dataByte | 0x04]); // EN high
							gpioLcdScreen._board.i2cWrite(gpioLcdScreen._config.bus.address, [dataByte & ~0x04]); // EN low
						};
						// 1. Send the standard 3-pulse sequence to break out of an unaligned nibble state
						// 0x38 sets data lines high with backlight active, EN low
						pulseLcmEnable(0x38); 
						pulseLcmEnable(0x38);
						pulseLcmEnable(0x38);
						// 2. Send 0x20 to formally request 4-bit alignmentmode
						pulseLcmEnable(0x28);
						// 3. Let the hardware register the state transition, then bind Johnny-Five
						gpioLcdScreen._lcd = new LCD({
							controller: gpioLcdScreen._config.lcdType,
						});
						gpioLcdScreen._lcd.clear(); // This will now execute correctly on the hardware
						clearInterval(i);
						gpioLcdScreen._logger.warn('LCD resynced');
						gpioLcdScreen._isResetting = false;
						resolve();
					}, 100);
				}catch(e){
					if(e.code === 'EREMOTEIO'){
						gpioLcdScreen._logger.warn('trying to resync LCD');
					}else{
						gpioLcdScreen._logger.error('trying to resync LCD error|' + e);
					}
					resolve();
				}
			}
		});
	},
	_trimText: function(text){
		gpioLcdScreen._logger.silly('gpioLcdScreen._trimText()');
		text = String(text);
		text = text.padEnd(16, ' ');
		text = text.substring(0, 16);
		return text;
	},
	lines: {
		reset: function(){
			gpioLcdScreen._logger.debug('gpioLcdScreen.lines.reset()');
			return new Promise((resolve, reject) => {
				try{
					gpioLcdScreen._lcd.clear();
					resolve();
				}catch(e){
					gpioLcdScreen._logger.debug('reset error|' + e);
					gpioLcdScreen._resetLCD().then(() => {
						resolve();
					});
				}
			});
		},
		top: {
			update: function(text){
				gpioLcdScreen._logger.silly('gpioLcdScreen.lines.top.update()');
				return new Promise((resolve, reject) => {
					try{
						gpioLcdScreen._lcd.cursor(0, 0).print(gpioLcdScreen._trimText(text));
						resolve();
					}catch(e){
						gpioLcdScreen._logger.debug('top line print error|' + e);
						gpioLcdScreen._resetLCD().then(() => {
							resolve();
						});
					}
				});
			}
		},
		bottom: {
			update: function(text){
				gpioLcdScreen._logger.silly('gpioLcdScreen.lines.bottom.update()');
				return new Promise((resolve, reject) => {
					try{
						gpioLcdScreen._lcd.cursor(1, 0).print(gpioLcdScreen._trimText(text));
						resolve();
					}catch(e){
						gpioLcdScreen._logger.debug('bottom line print error|' + e);
						gpioLcdScreen._resetLCD().then(() => {
							resolve();
						});
					}
				});
			}
		}
	},
}
module.exports = gpioLcdScreen;