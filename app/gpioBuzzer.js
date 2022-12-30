const Gpio = require('pigpio').Gpio;

var gpioBuzzer = {
	_logger: null,
	_gpioPin: null,
	_buzzer: null,
	_isBuzzing: false,
	_buzzInterval: null,
	init: function(logger, config){
		gpioBuzzer._logger = logger.getLogger('gpioBuzzer', 'silly');
		gpioBuzzer._gpioPin = config.gpioPin;
		return new Promise((resolve, reject) => {
			gpioBuzzer._buzzer = new Gpio(gpioBuzzer._gpioPin, {mode: Gpio.OUTPUT}),
			gpioBuzzer._reset();
			resolve();
		});
	},
	_reset: function(){
		this._isBuzzing = false;
		clearInterval(this._buzzInterval);
		this._buzzer.digitalWrite(0);
	},
	beep: function(milliseconds = 250){
		this._reset();
		this._buzzInterval = setInterval(() => {
			if(this._isBuzzing){
				this._buzzer.digitalWrite(0);
				this._isBuzzing = false;
			}else{
				this._buzzer.digitalWrite(1);
				this._isBuzzing = true;
			}
		}, milliseconds);
	},
	buzz: function(durationMilliseconds = 100){
		this._reset();
		this._buzzer.digitalWrite(1);
		setTimeout(() => {
			this._buzzer.digitalWrite(0);
		}, durationMilliseconds);
	},
	off: function(){
		this._reset();
	},
}
module.exports = gpioBuzzer;
