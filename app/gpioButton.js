const Gpio = require('pigpio').Gpio;

var gpioButton = {
	_logger: null,
	_debounceMs: null,
	init: function(logger, config){
		gpioButton._logger = logger.getLogger('gpioButton', 'silly');
		gpioButton._debounceMs = config.debounceMs;
		return new Promise((resolve, reject) => {
			resolve();
		});
	},
	build: function(name, gpioPin, callback, callbackOnPress = true){
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