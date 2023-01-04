const Gpio = require('pigpio').Gpio;

var gpioLed = {
	_logger: null,
	init: function(logger, config){
		gpioLed._logger = logger.getLogger('gpioLed', config.consoleLoggingLevel);
		gpioLed._logger.debug('gpioLed.init()');
		gpioLed._logger.verbose('initializing gpioLed');
		return new Promise((resolve, reject) => {
			gpioLed._logger.info('gpioLed initialized');
			resolve('gpioLed initialized');
		});
	},
	build: function(name, gpioPin){
		gpioLed._logger.debug('gpioLed.build()');
		var led = {
			name: name,
			_gpioPin: gpioPin,
			_flashBrighten: true,
			_flashDutyCycle: 0,
			_flashInterval: null,
			_led: new Gpio(gpioPin, {mode: Gpio.OUTPUT}),
			_reset: function(){
				gpioLed._logger.debug('led._reset()');
				clearInterval(this._flashInterval);
				this._flashDutyCycle = 0;
				this._led.digitalWrite(0);
			},
			on: function(){
				gpioLed._logger.debug('led.on()');
				this._reset();
				this._led.digitalWrite(1);
			},
			off: function(){
				gpioLed._logger.debug('led.off()');
				this._reset();
			},
			flash: function(stepMilliseconds = 10){
				gpioLed._logger.debug('led.flash()');
				this._reset();
				this._flashInterval = setInterval(() => {
					if(this._flashBrighten){
						this._flashDutyCycle += 5;
						if(this._flashDutyCycle >= 255){
							this._flashBrighten = false;
							this._flashDutyCycle = 255;
						}
					}else{
						this._flashDutyCycle -= 5;
						if(this._flashDutyCycle <= 0){
							this._flashBrighten = true;
							this._flashDutyCycle = 0;
						}
					}
					this._led.pwmWrite(this._flashDutyCycle);
				}, stepMilliseconds);
			},
			blip: function(durationMilliseconds = 200){
				gpioLed._logger.debug('led.blip()');
				this._reset();
				this._led.digitalWrite(1);
				setTimeout(() => {
					this._led.digitalWrite(0);
				}, durationMilliseconds);
			},
		};
		led._reset();
		return led;
	},
}
module.exports = gpioLed;
