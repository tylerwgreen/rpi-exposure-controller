const Gpio = require('pigpio').Gpio;

var gpioReset = {
	_logger: null,
	init: function(logger, config){
		gpioReset._logger = logger.getLogger('gpioReset', config.consoleLoggingLevel);
		gpioReset._logger.debug('gpioReset.init()');
		gpioReset._logger.verbose('initializing gpioReset');
		return new Promise((resolve, reject) => {
			gpioReset._reset(result => {
				gpioReset._logger.info('gpioReset initialized');
				resolve('gpioReset initialized');
			});
		});
	},
	_reset: function(){
		gpioReset._logger.debug('gpioReset._reset()');
		return new Promise((resolve, reject) => {
			var gpioPin = 4;
			var gpioPinMax = 27;
			while(gpioPin <= gpioPinMax){
				gpioReset._logger.silly('gpioReset._reset()' + gpioPin);
				var led = new Gpio(gpioPin, {mode: Gpio.OUTPUT});
				led.digitalWrite(0);
				if(gpioPin > gpioPinMax){
					resolve();
				}else{
					gpioPin++;
				}
			}
		});
	},
}
module.exports = gpioReset;
