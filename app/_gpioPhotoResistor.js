const Gpio = require('pigpio').Gpio;

var gpioPhotoResistor = {
	_logger: null,
	_gpioPin: null,
	_photoResistor: null,
	_readIntervalMs: null,
	_gpioReadInterval: null,
	init: function(logger, config){
		gpioPhotoResistor._logger = logger.getLogger('gpioPhotoResistor', config.consoleLoggingLevel);
		gpioPhotoResistor._logger.silly('gpioPhotoResistor.init()');
		gpioPhotoResistor._logger.verbose('initializing gpioPhotoResistor');
		gpioPhotoResistor._gpioPin = config.gpioPin;
		gpioPhotoResistor._readIntervalMs = config.readIntervalMs;
		return new Promise((resolve, reject) => {
			gpioPhotoResistor.exposure.reset();
			gpioPhotoResistor._gpioReadInterval = setInterval(gpioPhotoResistor._tick.update, gpioPhotoResistor._readIntervalMs);
			gpioPhotoResistor._photoResistor = new Gpio(gpioPhotoResistor._gpioPin, {mode: Gpio.INPUT, pullUpDown: Gpio.PUD_DOWN});
			gpioPhotoResistor._logger.info('gpioPhotoResistor initialized');
			resolve('gpioPhotoResistor initialized');
		});
	},
	_tick: {
		tickPrevious: 0,
		reset: function(){
			gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.reset()');
			gpioPhotoResistor._tick.tickPrevious = Date.now();
			gpioPhotoResistor._tick.light.reset();
			gpioPhotoResistor._tick.dark.reset();
		},
		update: function(){
			// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.update()');
			var level = gpioPhotoResistor._photoResistor.digitalRead();
				// is light
				if(level == 0){
					gpioPhotoResistor._tick.light.update();
				// is dark
				}else{
					gpioPhotoResistor._tick.dark.update();
				}
		},
		getDurationMs: function(tick){
			// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.getDurationMs()');
			var durationMs = Date.now() - gpioPhotoResistor._tick.tickPrevious;
			gpioPhotoResistor._tick.tickPrevious = Date.now();
			return durationMs;
		},
		light: {
			durationMs: 0,
			reset: function(){
				gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.light.reset()');
				this.durationMs = 0;
			},
			update: function(){
				// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.light.update()');
				this.durationMs += gpioPhotoResistor._tick.getDurationMs();
			},
			get: function(){
				// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.light.get()');
				return this.durationMs;
			}
		},
		dark: {
			durationMs: 0,
			reset: function(){
				gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.dark.reset()');
				this.durationMs = 0;
			},
			update: function(){
				// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.dark.update()');
				this.durationMs += gpioPhotoResistor._tick.getDurationMs();
			},
			get: function(){
				// gpioPhotoResistor._logger.silly('gpioPhotoResistor._tick.dark.get()');
				return this.durationMs;
			}
		},
	},
	exposure: {
		reset: function(){
			gpioPhotoResistor._logger.silly('gpioPhotoResistor.exposure.reset()');
			gpioPhotoResistor._tick.reset();
		},
		get: function(){
			gpioPhotoResistor._logger.silly('gpioPhotoResistor.exposure.get()');
			return {
				light: Math.round(gpioPhotoResistor._tick.light.get() / 1000),
				dark: Math.round(gpioPhotoResistor._tick.dark.get() / 1000),
				lightMs: gpioPhotoResistor._tick.light.get(),
				darkMs: gpioPhotoResistor._tick.dark.get(),
			};
		}
	}
}
module.exports = gpioPhotoResistor;