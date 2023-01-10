var time = Date.now();
var processTime = function(processText = ''){
	// console.log('processTime: ' + ((Date.now() - time)/1000) + ' | ' + processText);
	time = Date.now();
}
processTime('app.js');

/*
process.on('SIGINT', (code) => {
    StopAll();
});
process.on('SIGTERM', (code) => {
    StopAll();
});
*/

var app = {
	config: null,
	logger: null,
	_logger: null, // configured logger object
	init: function(){
		// setup app environment
		module.paths.push(__dirname + '/app');
		process.env['APP_ROOT_DIR'] = __dirname;
		process.env['NODE_CONFIG_DIR'] = __dirname + '/app/config';
		process.env['APP_CACHE_DIR'] = __dirname + '/app/cache';
		// setup config module
		app.config = require('config');
		// setup logger module
		app._logger = require('logger');
		app._logger.init(app.config.get('logger'));
		app.logger = app._logger.getLogger('app', 'error'); // set log level for the app
		// initialize app
// app.logger.warn('Pause before light read on expose init');
app.logger.warn('Speed up boot, bootup feedback?');
app.logger.warn('Set up sigint/sigterm/shutdown functions');
		app.logger.debug('app.init()');
		app.logger.verbose('initializing application');
		app.cache.init()
		.then(app.peripherals.init)
		.then(app.tasks.init)
		.then(result => {
// processTime('application initialized');
			app.logger.info('application initialized');
			app.tasks.start();
		})
		.catch(error => {
			app.logger.error(error);
		});
	},
	cache: {
		flatCache: null,
		cacheId: null,
		cache: null,
		init: function(){
			app.logger.debug('app.cache.init()');
			app.logger.verbose('initializing cache');
			return new Promise((resolve, reject) => {
				app.cache.flatCache = flatCache = require('flat-cache');
				app.cache.cacheId = app.config.get('cache.id');
				app.cache.cache = app.cache.flatCache.load(app.cache.cacheId, process.env['APP_CACHE_DIR']);
				app.logger.info('cache initialized');
				resolve('cache initialized');
			});
		},
		exposure: {
			set: function(value){
				app.logger.debug('app.cache.exposure.set()');
				if(typeof value !== 'number')
					throw new Error('exposure must be typeof number');
				app.cache.cache.setKey('exposure', value);
				app.cache.cache.save(noPrune = true);
			},
			get: function(){
				app.logger.silly('app.cache.exposure.get()');
				return app.cache.cache.getKey('exposure');
			},
		}
	},
	tasks: {
		init: function(){
			app.logger.debug('app.tasks.init()');
			app.logger.verbose('initializing tasks');
			return new Promise((resolve, reject) => {
				app.tasks.settings.init()
				.then(app.tasks.exposure.init)
				.then(result => {
					app.tasks.disableAll();
					app.logger.info('tasks initialized');
					resolve('tasks initialized');
				})
				.catch(error => {
					app.logger.error(error);
				});
			});
		},
		start: function(){
			app.logger.debug('app.tasks.start()');
			app.peripherals.lcdScreen.update.top('Welcome!')
			.then(app.peripherals.lcdScreen.update.bottom(app.date.getDate()))
			.then(result => {
				var i = 3;
				var interval = setInterval(function(){
					// animate leds while waiting for CPU to calm down
					if(i == 3){
						app.peripherals.leds.leds.exposureOn.on();
					}else if(i == 2){
						app.peripherals.leds.leds.exposureOff.on();
					}else if(i == 1){
						app.peripherals.leds.leds.peripheralFeedback.on();
					}
					if(i <= 0){
						app.peripherals.leds.leds.exposureOn.off();
						app.peripherals.leds.leds.exposureOff.off();
						app.peripherals.leds.leds.peripheralFeedback.off();
						clearInterval(interval);
						app.tasks.settings.enable();
					}
					i--;
				}, 600);
			});
		},
		disableAll: function(){
			app.logger.debug('app.tasks.disableAll()');
			app.peripherals.buttons.disableAll();
			app.tasks.settings.disable();
			app.tasks.exposure.disable();
		},
		settings: {
			init: function(){
				app.logger.debug('app.tasks.settings.init()');
				app.logger.verbose('initializing settings');
				return new Promise((resolve, reject) => {
					app.tasks.settings._lcd.init();
					app.logger.info('settings initialized');
					resolve('settings initialized');
				});
			},
			enable: function(){
				app.logger.debug('app.tasks.settings.enable()');
				app.tasks.disableAll();
				app.peripherals.uvSensor.exposure.reset();
				app.tasks.settings._lcd.enable();
				app.peripherals.leds.leds.exposureOff.on();
				app.peripherals.buttons.buttons.exposureUp.enable();
				app.peripherals.buttons.buttons.exposureDown.enable();
				app.peripherals.buttons.buttons.exposureStart.enable();
			},
			disable: function(){
				app.logger.debug('app.tasks.settings.disable()');
				app.tasks.settings._lcd.disable();
			},
			_lcd: {
				padding: {
					uva: 8,
					exposure: 12,
				},
				intervalMs: null,
				interval: null,
				init: function(){
					app.logger.debug('app.tasks.settings._lcd.init()');
					app.tasks.settings._lcd.intervalMs = app.config.get('tasks.settings.lcdInterval');
				},
				enable: function(){
					app.logger.debug('app.tasks.settings._lcd.enable()');
					app.peripherals.lcdScreen.update.top(
						'UVA/Min:' + app.peripherals.lcdScreen.padTextLeft('0', app.tasks.settings._lcd.padding.uva)
					);
					app.tasks.settings._lcd._updateExposure(app.cache.exposure.get());
					app.tasks.settings._lcd.interval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
						// console.log(data);
						// console.log('a|' + data.uva.read + '|' + data.uva.accumulated + '|b|' + data.uvb.read + '|' + data.uvb.accumulated + '|s|' + data.elapsedSec);
						app.peripherals.lcdScreen.update.top(
							'UVA/Min:' + app.peripherals.lcdScreen.padTextLeft(
								app.peripherals.lcdScreen.shortenNumber(data.uva.readPerMin, 1)
							, app.tasks.settings._lcd.padding.uva)
						);
						app.tasks.settings._lcd._updateExposure(app.cache.exposure.get());
					}, app.tasks.settings._lcd.intervalMs);
				},
				disable: function(){
					app.logger.debug('app.tasks.settings._lcd.disable()');
					clearInterval(app.tasks.settings._lcd.interval);
				},
				_updateExposure: function(exposure){
					app.logger.silly('app.tasks.settings._lcd._updateExposure()');
					app.peripherals.lcdScreen.update.bottom(
						'Exp:' + app.peripherals.lcdScreen.padTextLeft(
							app.peripherals.lcdScreen.shortenNumber(exposure, 0)
							+ ' ' + app.tasks.settings._lcd._getExposureTime(exposure)
						, app.tasks.settings._lcd.padding.exposure)
					);
				},
				_getExposureTime: function(exposure){
					app.logger.silly('app.tasks.settings._lcd._getExposureTime()');
					var data = app.peripherals.uvSensor.exposure.get();
					if(data.uva.readPerMin <= 0){
						return '00:00';
					}
					var expPerMs = ((data.uva.readPerMin / 60) / 60) / 1000;
					var expMins = (((exposure / expPerMs) / 1000) / 60) / 60;
					var expSecs = (((exposure / expPerMs) / 1000) / 60);
					if(expMins >= 1){
						expSecs = expSecs - (Math.floor(expMins) * 60);
					}
					// console.log(exposure + '|' + data.uva.readPerMin + '|' + parseFloat(expPerMs).toFixed(4) + '|' + parseFloat(expMins).toFixed(4) + '|' + parseFloat(expSecs).toFixed(4));
					expMins = app.peripherals.lcdScreen.padTextLeft(Math.floor(expMins), 2, '0');
					expSecs = app.peripherals.lcdScreen.padTextLeft(Math.floor(expSecs), 2, '0');
					return expMins + ':' + expSecs;
				},
			},
			exposure: {
				up: function(){
					app.logger.debug('app.tasks.settings.exposure.up()');
					var exposure = app.cache.exposure.get();
					exposure = exposure + app.config.get('tasks.settings.exposure.increments');
					if(exposure > app.config.get('tasks.settings.exposure.max')){
						app.peripherals.buzzer.buzzLong();
					}else{
						app.cache.exposure.set(exposure);
						app.tasks.settings._lcd._updateExposure(exposure);
					}
				},
				down: function(){
					app.logger.debug('app.tasks.settings.exposure.down()');
					var exposure = app.cache.exposure.get();
					exposure = exposure - app.config.get('tasks.settings.exposure.increments');
					if(exposure < app.config.get('tasks.settings.exposure.min')){
						app.peripherals.buzzer.buzzLong();
					}else{
						app.cache.exposure.set(exposure);
						app.tasks.settings._lcd._updateExposure(exposure);
					}
				},
			},
		},
		exposure: {
			_exposureInterval: null,
			init: function(){
				app.logger.debug('app.tasks.exposure.init()');
				app.logger.verbose('initializing exposure');
				return new Promise((resolve, reject) => {
					app.tasks.exposure._lcd.init();
					app.logger.info('exposure initialized');
					resolve('exposure initialized');
				});
			},
			enable: function(){
				app.logger.debug('app.tasks.exposure.enable()');
				app.tasks.disableAll();
				app.peripherals.relays.relays.expose.on();
				app.peripherals.relays.relays.idle.off();
				setTimeout(function(){
					var data = app.peripherals.uvSensor.exposure.get();
					if(data.uva.read <= 0){
						app.logger.warn('No UVA reading');
						app.tasks.settings.enable();
						return;
					}
					app.tasks.exposure._lcd.enable();
					app.peripherals.leds.leds.exposureOff.off();
					app.peripherals.leds.leds.exposureOn.flash();
					app.peripherals.buzzer.beep();
					app.peripherals.buttons.buttons.exposureStop.enable();
					var maxExp = app.cache.exposure.get();
					app.tasks.exposure._exposureInterval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
console.log(data.uva.accumulated + '|' + maxExp);
						if(data.uva.read <= 0){
							app.logger.error('Lost UVA reading');
							app.tasks.settings.enable();
						}
						if(data.uva.accumulated >= maxExp){
							app.tasks.settings.enable();
						}
					}, 1000);
				}, 1000);
			},
			disable: function(){
				app.logger.debug('app.tasks.exposure.disable()');
				clearInterval(app.tasks.exposure._exposureInterval);
				app.tasks.exposure._lcd.disable();
				app.peripherals.leds.leds.exposureOn.off();
				app.peripherals.buzzer.off();
				app.peripherals.relays.relays.expose.off();
				app.peripherals.relays.relays.idle.on();
			},
			// enable alias
			start: function(){
				app.logger.debug('app.tasks.exposure.start()');
				app.tasks.exposure.enable();
			},
			// disable alias
			/* stop: function(){
				app.logger.debug('app.tasks.exposure.stop()');
				app.tasks.exposure.disable();
			}, */
			_lcd: {
				intervalMs: null,
				interval: null,
				init: function(){
					app.logger.debug('app.tasks.exposure._lcd.init()');
					app.tasks.exposure._lcd.intervalMs = app.config.get('tasks.exposure.lcdInterval');
				},
				enable: function(){
					app.logger.debug('app.tasks.exposure._lcd.enable()');
					app.peripherals.lcdScreen.reset();
					app.peripherals.uvSensor.exposure.reset();
					app.tasks.exposure._lcd.interval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
						// console.log(data);
						// console.log('a|' + data.uva.read + '|' + data.uva.accumulated + '|b|' + data.uvb.read + '|' + data.uvb.accumulated + '|s|' + data.elapsedSec);
						app.peripherals.lcdScreen.update.top(
							'UVA:' + app.peripherals.lcdScreen.padTextLeft(app.peripherals.lcdScreen.shortenNumber(data.uva.accumulated), 12)
						);
						app.peripherals.lcdScreen.update.bottom(
							'Exp:' + app.peripherals.lcdScreen.padTextLeft(
								app.peripherals.lcdScreen.shortenNumber(app.cache.exposure.get(), 0)
								+ ' ' + app.tasks.exposure._lcd._getExposureTime()
							, 12)
						);
					}, app.tasks.exposure._lcd.intervalMs);
				},
				disable: function(){
					app.logger.debug('app.tasks.exposure._lcd.disable()');
					clearInterval(app.tasks.exposure._lcd.interval);
				},
				_getExposureTime: function(exposure){
					app.logger.silly('app.tasks.settings._lcd._getExposureTime()');
					var data = app.peripherals.uvSensor.exposure.get();
					var mins = data.elapsedMin;
					var secs = data.elapsedSec;
					if(mins >= 1){
						secs = secs - (mins * 60);
					}
					return app.peripherals.lcdScreen.padTextLeft(mins, 2, '0') + ':' + app.peripherals.lcdScreen.padTextLeft(secs, 2, '0');
				},
			},
		},
	},
	peripherals: {
		init: function(){
			app.logger.debug('app.peripherals.init()');
			app.logger.verbose('initializing peripherals');
			return new Promise((resolve, reject) => {
				// new Promise((resolve, reject) => {resolve();})
				app.peripherals.lcdScreen.init() // must be first b/c Johnny-Five does something to trigger the gpio's to be High
				.then(app.peripherals.buttons.init)
				.then(app.peripherals.leds.init)
				.then(app.peripherals.buzzer.init)
				.then(app.peripherals.relays.init)
				.then(app.peripherals.uvSensor.init)
				.then(result => {
					app.logger.info('peripherals initialized');
					resolve('peripherals initialized');
				})
				.catch(error => {
					app.logger.error(error);
				});
			});
		},
		buttons: {
			buttons: {
				exposureUp: null,
				exposureDown: null,
				exposureStart: null,
				exposureStop: null,
			},
			init: function(){
				app.logger.debug('app.peripherals.buttons.init()');
				app.logger.verbose('initializing buttons');
				return new Promise((resolve, reject) => {
					var gpioButton = require('gpioButton');
					gpioButton.init(app._logger, app.config.get('peripherals.buttons.config')).then(result => {
						app.peripherals.buttons.buttons.exposureUp = gpioButton.build('exposureUp', app.config.get('peripherals.buttons.buttons.exposureUp.gpioPin'), app.peripherals.buttons.callbacks.exposureUp);
						app.peripherals.buttons.buttons.exposureDown = gpioButton.build('exposureDown', app.config.get('peripherals.buttons.buttons.exposureDown.gpioPin'), app.peripherals.buttons.callbacks.exposureDown);
						app.peripherals.buttons.buttons.exposureStart = gpioButton.build('exposureStart', app.config.get('peripherals.buttons.buttons.exposureStart.gpioPin'), app.peripherals.buttons.callbacks.exposureStart);
						app.peripherals.buttons.buttons.exposureStop = gpioButton.build('exposureStop', app.config.get('peripherals.buttons.buttons.exposureStop.gpioPin'), app.peripherals.buttons.callbacks.exposureStop);
						app.logger.info('buttons initialized');
						resolve('buttons initialized');
					});
				});
			},
			disableAll: function(){
				app.logger.debug('app.peripherals.buttons.disableAll()');
				app.peripherals.buttons.buttons.exposureUp.disable();
				app.peripherals.buttons.buttons.exposureDown.disable();
				app.peripherals.buttons.buttons.exposureStart.disable();
				app.peripherals.buttons.buttons.exposureStop.disable();
			},
			callbacks: {
				_click: function(){
					app.logger.silly('app.peripherals.buttons.callbacks._click()');
					app.peripherals.leds.leds.peripheralFeedback.blip();
				},
				exposureUp: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureUp()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.up();
				},
				exposureDown: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureDown()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.down();
				},
				exposureStart: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureStart()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.exposure.start();
				},
				exposureStop: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureStop()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.enable();
					// app.tasks.exposure.stop();
				},
			}
		},
		leds: {
			leds: {
				exposureOn: null,
				exposureOff: null,
				peripheralFeedback: null,
			},
			init: function(){
				app.logger.debug('app.peripherals.leds.init()');
				app.logger.verbose('initializing leds');
				return new Promise((resolve, reject) => {
					var gpioLed = require('gpioLed');
					gpioLed.init(app._logger, app.config.get('peripherals.leds.config')).then(result => {
						app.peripherals.leds.leds.exposureOn = gpioLed.build('exposureOn', app.config.get('peripherals.leds.leds.exposureOn.gpioPin'));
						app.peripherals.leds.leds.exposureOff = gpioLed.build('exposureOff', app.config.get('peripherals.leds.leds.exposureOff.gpioPin'));
						app.peripherals.leds.leds.peripheralFeedback = gpioLed.build('peripheralFeedback', app.config.get('peripherals.leds.leds.peripheralFeedback.gpioPin'));
						app.logger.info('leds initialized');
						resolve('leds initialized');
					});
				});
			},
		},
		buzzer: {
			buzzer: null,
			init: function(){
				app.logger.debug('app.peripherals.buzzer.init()');
				app.logger.verbose('initializing buzzer');
				return new Promise((resolve, reject) => {
					app.peripherals.buzzer.buzzer = require('gpioBuzzer');
					app.peripherals.buzzer.buzzer.init(app._logger, app.config.get('peripherals.buzzer.config')).then(result => {
						app.logger.info('buzzer initialized');
						resolve('buzzer initialized');
					});
				});
			},
			buzz: function(){
				app.logger.debug('app.peripherals.buzzer.buzz()');
				this.buzzer.buzz(100);
			},
			buzzLong: function(){
				app.logger.debug('app.peripherals.buzzer.buzzLong()');
				this.buzzer.buzz(500);
			},
			beep: function(){
				app.logger.debug('app.peripherals.buzzer.beep()');
				this.buzzer.beep(250);
			},
			off: function(){
				app.logger.debug('app.peripherals.buzzer.off()');
				this.buzzer.off();
			}
		},
		relays: {
			relays: {
				expose: null,
				idle: null,
			},
			init: function(){
				app.logger.debug('app.peripherals.relays.init()');
				app.logger.verbose('initializing relays');
				return new Promise((resolve, reject) => {
					var gpioRelay = require('gpioRelay');
					gpioRelay.init(app._logger, app.config.get('peripherals.relays.config')).then(result => {
						app.peripherals.relays.relays.expose = gpioRelay.build('expose', app.config.get('peripherals.relays.relays.expose.gpioPin'));
						app.peripherals.relays.relays.idle = gpioRelay.build('idle', app.config.get('peripherals.relays.relays.idle.gpioPin'));
						app.logger.info('relays initialized');
						resolve('relays initialized');
					});
				});
			},
		},
		uvSensor: {
			_uvSensor: null,
			init: function(){
				app.logger.debug('app.peripherals.uvSensor.init()');
				app.logger.verbose('initializing uvSensor');
				return new Promise((resolve, reject) => {
					app.peripherals.uvSensor._uvSensor = require('gpioUvSensor');
					app.peripherals.uvSensor._uvSensor.init(app._logger, app.config.get('peripherals.uvSensor.config')).then(result => {
						app.logger.info('uvSensor initialized');
						resolve('uvSensor initialized');
					});
				});
			},
			exposure: {
				reset: function(){
					app.logger.debug('app.peripherals.uvSensor.exposure.reset()');
					app.peripherals.uvSensor._uvSensor.exposure.reset();
				},
				get: function(){
					app.logger.silly('app.peripherals.uvSensor.exposure.get()');
					return app.peripherals.uvSensor._uvSensor.exposure.get();
				}
			}
		},
		lcdScreen: {
			lcdScreen: null,
			init: function(){
				app.logger.debug('app.peripherals.lcdScreen.init()');
				app.logger.verbose('initializing lcdScreen');
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen = require('gpioLcdScreen');
					app.peripherals.lcdScreen.lcdScreen.init(app._logger, app.config.get('peripherals.lcdScreen.config')).then(result => {
						app.logger.info('lcdScreen initialized');
						resolve('lcdScreen initialized');
					});
				});
			},
			reset: function(){
				app.logger.debug('app.peripherals.lcdScreen.reset()');
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen.lines.reset().then(result => {
						resolve();
					});
				});
			},
			update: {
				top: function(text){
					app.logger.silly('app.peripherals.lcdScreen.update.top()');
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.top.update(text)
						.then(result => {
							resolve();
						});
					});
				},
				bottom: function(text){
					app.logger.silly('app.peripherals.lcdScreen.update.bottom()');
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.bottom.update(text)
						.then(result => {
							resolve();
						});
					});
				},
			},
			shortenNumber: function(num, decimals = 2){
				if(num >= 1000000){
					return (Math.round((num / 1000000) * 100) / 100).toFixed(decimals) + 'm';
				}else if(num >= 1000){
					return (Math.round((num / 1000) * 100) / 100).toFixed(decimals) + 'k';
				}
				return num;
			},
			padTextLeft: function(text, spaces, filler = ' '){
				return String(text).padStart(spaces, filler);
			},
			/* padTextRight: function(text, spaces, filler = ' '){
				return String(text).padEnd(spaces, filler);
			}, */
		},
	},
	date: {
		getDate: function(){
			app.logger.debug('app.date.getDate()');
			var dateObject = new Date();
			var d = ('0' + dateObject.getDate()).slice(-2);
			var m = ('0' + (dateObject.getMonth() + 1)).slice(-2);
			var y = dateObject.getFullYear();
			return y + '-' + m + '-' + d;
		},
		getTime: function(){
			app.logger.debug('app.date.getTime()');
			var dateObject = new Date();
			var h = ('0' + dateObject.getHours()).slice(-2);
			var m = ('0' + dateObject.getMinutes()).slice(-2);
			var s = ('0' + dateObject.getSeconds()).slice(-2);
			return h + ':' + m + ':' + s;
		}
	},
}
app.init();