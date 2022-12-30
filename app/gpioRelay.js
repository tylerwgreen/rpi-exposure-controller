const Gpio = require('pigpio').Gpio;

var gpioRelay = {
	_logger: null,
	init: function(logger, config){
		gpioRelay._logger = logger.getLogger('gpioRelay', 'silly');
		return new Promise((resolve, reject) => {
			resolve();
		});
	},
	build: function(name, gpioPin){
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
