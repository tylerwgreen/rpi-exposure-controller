const Gpio = require('pigpio').Gpio;

var gpioButton = {
	_logger: null,
	_debounceMs: null,
	init: function(logger, config){
		gpioButton._logger = logger.getLogger('gpioButton', config.consoleLoggingLevel);
		gpioButton._logger.silly('gpioButton.init()');
		gpioButton._logger.verbose('initializing gpioButton');
		gpioButton._debounceMs = config.debounceMs;
		return new Promise((resolve, reject) => {
			gpioButton._logger.info('gpioButton initialized');
			resolve('gpioButton initialized');
		});
	},
	build: function(name, gpioPin, callback, callbackOnPress = true){
		gpioButton._logger.silly('gpioButton.build()');
		var button = {
			name: name,
			_gpioPin: gpioPin,
			_button: new Gpio(gpioPin, {
				mode: Gpio.INPUT,
				pullUpDown: Gpio.PUD_UP,
				alert: true
			})
		};
		// Level must be stable for xx ms before an alert event is emitted
		button._button.glitchFilter(gpioButton._debounceMs);
		button._button.on('alert', (level, tick) => {
			if(callbackOnPress){
				if(level === 0)
					callback();
			// callbackOnRelease
			}else{
				if(level === 1)
					callback();
			}
		});
		return button;
	},
}
module.exports = gpioButton;