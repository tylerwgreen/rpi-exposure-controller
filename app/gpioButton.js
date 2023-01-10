const Gpio = require('pigpio').Gpio;

var gpioButton = {
	_logger: null,
	_debounceMs: null,
	_holdDelay: null,
	_holdRepeat: null,
	init: function(logger, config){
		gpioButton._logger = logger.getLogger('gpioButton', config.consoleLoggingLevel);
		gpioButton._logger.debug('gpioButton.init()');
		gpioButton._logger.verbose('initializing gpioButton');
		gpioButton._debounceMs = config.debounceMs;
		gpioButton._holdDelay = config.holdDelay;
		gpioButton._holdRepeat = config.holdRepeat;
		return new Promise((resolve, reject) => {
			gpioButton._logger.info('gpioButton initialized');
			resolve('gpioButton initialized');
		});
	},
	build: function(name, gpioPin, callbackPress, callbackHold = null, callbackOnPress = true){
		gpioButton._logger.debug('gpioButton.build()');
		var button = {
			name: name,
			_enabled: false,
			_gpioPin: gpioPin,
			_holdInterval: null,
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
				button.holdRelease();
			},
			hold: function(callbackHold){
				gpioButton._logger.debug('gpioButton ' + button.name + ' button.hold()');
				if(false == button.isEnabled()){
					button.holdRelease();
				}else{
					callbackHold();
					clearInterval(button._holdInterval);
					button._holdInterval = setInterval(function(){
						callbackHold();
					}, gpioButton._holdRepeat);
				}
			},
			holdRelease: function(){
				gpioButton._logger.debug('gpioButton ' + button.name + ' button.holdRelease()');
				clearInterval(button._holdInterval);
			},
		};
		// Level must be stable for xx ms before an alert event is emitted
		button._button.glitchFilter(gpioButton._debounceMs);
		button._button.on('alert', (level, tick) => {
			gpioButton._logger.silly('gpioButton button alert()');
			if(button.isEnabled()){
				if(callbackOnPress){
					if(level === 0){
						callbackPress();
					}
				// callbackOnRelease
				}else{
					if(level === 1){
						callbackPress();
					}
				}
				// button hold
				if(level === 0){
					if(typeof callbackHold === 'function'){
						button._holdInterval = setInterval(function(){
							button.hold(callbackHold);
						}, gpioButton._holdDelay);
					};
				}else{
					button.holdRelease();
				}
			}
		});
		return button;
	},
}
module.exports = gpioButton;