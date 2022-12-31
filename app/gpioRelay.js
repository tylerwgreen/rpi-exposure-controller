const Gpio = require('pigpio').Gpio;

var gpioRelay = {
	_logger: null,
	init: function(logger, config){
		gpioRelay._logger = logger.getLogger('gpioRelay', config.consoleLoggingLevel);
		gpioRelay._logger.silly('gpioRelay.init()');
		gpioRelay._logger.verbose('initializing gpioRelay');
		return new Promise((resolve, reject) => {
			gpioRelay._logger.info('gpioRelay initialized');
			resolve('gpioRelay initialized');
		});
	},
	build: function(name, gpioPin){
		gpioRelay._logger.silly('gpioRelay.build()');
		var relay = {
			name: name,
			_gpioPin: gpioPin,
			_relay: new Gpio(gpioPin, {mode: Gpio.OUTPUT}),
			_reset: function(){
				this._relay.digitalWrite(1);
			},
			on: function(){
				this._relay.digitalWrite(0);
			},
			off: function(){
				this._relay.digitalWrite(1);
			},
		};
		relay._reset();
		return relay;
	},
}
module.exports = gpioRelay;
