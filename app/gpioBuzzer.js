const Gpio = require('pigpio').Gpio;

var gpioBuzzer = {
	_logger: null,
	_gpioPin: null,
	_buzzer: null,
	_isBuzzing: false,
	_buzzInterval: null,
	init: function(logger, config){
		gpioBuzzer._logger = logger.getLogger('gpioBuzzer', config.consoleLoggingLevel);
		gpioBuzzer._logger.silly('gpioBuzzer.init()');
		gpioBuzzer._logger.verbose('initializing gpioBuzzer');
		gpioBuzzer._gpioPin = config.gpioPin;
		return new Promise((resolve, reject) => {
			gpioBuzzer._buzzer = new Gpio(gpioBuzzer._gpioPin, {mode: Gpio.OUTPUT}),
			gpioBuzzer._reset();
			gpioBuzzer._logger.info('gpioBuzzer initialized');
			resolve('gpioBuzzer initialized');
		});
	},
	_reset: function(){
		gpioBuzzer._logger.silly('gpioBuzzer._reset()');
		this._isBuzzing = false;
		clearInterval(this._buzzInterval);
		this._buzzer.digitalWrite(0);
	},
	beep: function(milliseconds = 250){
		gpioBuzzer._logger.silly('gpioBuzzer.beep()');
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
		gpioBuzzer._logger.silly('gpioBuzzer.buzz()');
		this._reset();
		this._buzzer.digitalWrite(1);
		setTimeout(() => {
			this._buzzer.digitalWrite(0);
		}, durationMilliseconds);
	},
	off: function(){
		gpioBuzzer._logger.silly('gpioBuzzer.off()');
		this._reset();
	},
}
module.exports = gpioBuzzer;
