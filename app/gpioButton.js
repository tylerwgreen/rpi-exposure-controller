const Gpio = require('pigpio').Gpio;

var gpioButton = {
	_logger: null,
	_debounceMs: null,
	init: function(logger, config){
		gpioButton._logger = logger.getLogger('gpioButton', config.consoleLoggingLevel);
		gpioButton._logger.debug('gpioButton.init()');
		gpioButton._logger.verbose('initializing gpioButton');
		gpioButton._debounceMs = config.debounceMs;
		return new Promise((resolve, reject) => {
			gpioButton._logger.info('gpioButton initialized');
			resolve('gpioButton initialized');
		});
	},
	build: function(name, gpioPin, callback, callbackOnPress = true){
		gpioButton._logger.debug('gpioButton.build()');
		var button = {
			name: name,
			_enabled: false,
			_gpioPin: gpioPin,
			_button: new Gpio(gpioPin, {
				mode: Gpio.INPUT,
				pullUpDown: Gpio.PUD_UP,
				alert: true
			}),
			isEnabled: function(){
				gpioButton._logger.debug('gpioButton ' + button.name + ' button.isEnabled():' + button._enabled);
				return button._enabled;
			},
			enable: function(){
				gpioButton._logger.debug('gpioButton ' + button.name + ' button.enabled()');
				button._enabled = true;
			},
			disable: function(){
				gpioButton._logger.debug('gpioButton ' + button.name + ' button.disable()');
				button._enabled = false;
			}
		};
		// Level must be stable for xx ms before an alert event is emitted
		button._button.glitchFilter(gpioButton._debounceMs);
		button._button.on('alert', (level, tick) => {
			gpioButton._logger.silly('gpioButton button alert()');
			if(button.isEnabled()){
				if(callbackOnPress){
					if(level === 0)
						callback();
				// callbackOnRelease
				}else{
					if(level === 1)
						callback();
				}
			}
		});
		return button;
	},
}
module.exports = gpioButton;