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
		app.logger.silly('app.init()');
		app.logger.verbose('initializing application');
		app.cache.init()
		.then(app.peripherals.init)
		// .then(app.tasks.init)
		.then(result => {
			app.logger.info('application initialized');
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
			app.logger.silly('app.cache.init()');
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
				app.logger.silly('app.cache.exposure.set()');
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
			app.logger.silly('app.tasks.init()');
			app.logger.verbose('initializing tasks');
			return new Promise((resolve, reject) => {
resolve('tasks initialized');
				app.tasks.settings.init()
				app.tasks.exposure.init()
				.then(result => {
					app.logger.info('tasks initialized');
					resolve('tasks initialized');
				})
				.catch(error => {
					app.logger.error(error);
				});
			});
		},
		settings: {
			init: function(){
				app.logger.silly('app.tasks.settings.init()');
				app.logger.verbose('initializing settings');
				return new Promise((resolve, reject) => {
					// app.tasks.settings.disable();
					app.peripherals.leds.leds.exposureOff.on();
					app.peripherals.lcdScreen.update.top('Welcome!')
					.then(app.peripherals.lcdScreen.update.bottom(app.date.getDate()))
					.then(app.peripherals.lcdScreen.update.top('Exposure'))
					.then(app.peripherals.lcdScreen.update.bottom(app.cache.exposure.get()))
					.then(result => {
// app.tasks.settings.enable();
						app.logger.info('settings initialized');
						resolve('settings initialized');
					});
				});
			},
/* enable: function(){
	app.logger.silly('app.tasks.settings.enable()');
	app.tasks.settings.enabled = true;
},
disable: function(){
	app.logger.silly('app.tasks.settings.disable()');
	app.tasks.settings.enabled = false;
}, */
			exposure: {
				up: function(){
					app.logger.silly('app.tasks.settings.exposure.up()');
					var exposure = app.cache.exposure.get();
					exposure = exposure + app.config.get('tasks.settings.exposure.increments');
					if(exposure > app.config.get('tasks.settings.exposure.max')){
						app.peripherals.buzzer.buzzLong();
					}else{
						app.cache.exposure.set(exposure);
						app.peripherals.lcdScreen.update.bottom(exposure).then(result => {
							// asdf
						});
					}
				},
				down: function(){
					app.logger.silly('app.tasks.settings.exposure.down()');
					var exposure = app.cache.exposure.get();
					exposure = exposure - app.config.get('tasks.settings.exposure.increments');
					if(exposure <= app.config.get('tasks.settings.exposure.min')){
						app.peripherals.buzzer.buzzLong();
					}else{
						app.cache.exposure.set(exposure);
						app.peripherals.lcdScreen.update.bottom(exposure).then(result => {
							// asdf
						});
					}
				},
			},
		},
		exposure: {
			enabled: false,
			lcdInterval: null,
			init: function(){
				app.logger.silly('app.tasks.exposure.init()');
				app.logger.verbose('initializing exposure');
				return new Promise((resolve, reject) => {
// app.tasks.exposure.disable();
					app.logger.info('exposure initialized');
					resolve('exposure initialized');
				});
			},
/* enable: function(){
	app.logger.silly('app.tasks.exposure.enable()');
	app.tasks.exposure.enabled = true;
},
disable: function(){
	app.logger.silly('app.tasks.exposure.disable()');
	app.tasks.exposure.enabled = false;
}, */
			start: function(){
				app.logger.silly('app.tasks.exposure.start()');
				app.peripherals.leds.leds.exposureOn.flash();
				app.peripherals.leds.leds.exposureOff.off();
				app.peripherals.buzzer.beep();
				app.peripherals.relays.relays.expose.on();
				app.peripherals.relays.relays.idle.off();
				app.peripherals.photoResistor.exposure.reset();
				app.tasks.exposure.updateLcd();
			},
			stop: function(){
				app.logger.silly('app.tasks.exposure.stop()');
				app.peripherals.leds.leds.exposureOn.off();
				app.peripherals.leds.leds.exposureOff.on();
				app.peripherals.buzzer.off();
				app.peripherals.relays.relays.expose.off();
				app.peripherals.relays.relays.idle.on();
				app.peripherals.lcdScreen.reset().then(result => {
// clearInterval(app.tasks.exposure.lcdInterval);
// app.logger.verbose('light: ' + app.peripherals.photoResistor.exposure.get().light + 's|dark: ' + app.peripherals.photoResistor.exposure.get().dark + 's');
				});
			},
			updateLcd: function(){
				app.logger.silly('app.tasks.exposure.updateLcd()');
				var exposureMax = app.cache.exposure.get();
				app.peripherals.lcdScreen.update.top('Exposing ' + exposureMax + 's');
				app.tasks.exposure.lcdInterval = setInterval(function(){
					var exposureCurrent = app.peripherals.photoResistor.exposure.get().light;
					if(exposureCurrent >= exposureMax){
						app.tasks.exposure.stop();
					}else{
						app.peripherals.lcdScreen.update.bottom(exposureCurrent + 's');
					}
				}, 1000);
			}
		},
	},
	peripherals: {
		init: function(){
			app.logger.silly('app.peripherals.init()');
			app.logger.verbose('initializing peripherals');
			return new Promise((resolve, reject) => {
				app.peripherals.buttons.init()
				.then(app.peripherals.leds.init)
				.then(app.peripherals.buzzer.init)
				.then(app.peripherals.relays.init)
				.then(app.peripherals.photoResistor.init)
				.then(app.peripherals.lcdScreen.init)
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
				app.logger.silly('app.peripherals.buttons.init()');
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
			callbacks: {
				_click: function(){
					app.logger.silly('app.peripherals.buttons.callbacks._click()');
					app.peripherals.leds.leds.peripheralFeedback.blip();
				},
				exposureUp: function(){
					app.logger.silly('app.peripherals.buttons.callbacks.exposureUp()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.up();
				},
				exposureDown: function(){
					app.logger.silly('app.peripherals.buttons.callbacks.exposureDown()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.down();
				},
				exposureStart: function(){
					app.logger.silly('app.peripherals.buttons.callbacks.exposureStart()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.exposure.start();
				},
				exposureStop: function(){
					app.logger.silly('app.peripherals.buttons.callbacks.exposureStop()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.exposure.stop();
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
				app.logger.silly('app.peripherals.leds.init()');
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
				app.logger.silly('app.peripherals.buzzer.init()');
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
				app.logger.silly('app.peripherals.buzzer.buzz()');
				this.buzzer.buzz(100);
			},
			buzzLong: function(){
				app.logger.silly('app.peripherals.buzzer.buzzLong()');
				this.buzzer.buzz(500);
			},
			beep: function(){
				app.logger.silly('app.peripherals.buzzer.beep()');
				this.buzzer.beep(250);
			},
			off: function(){
				app.logger.silly('app.peripherals.buzzer.off()');
				this.buzzer.off();
			}
		},
		relays: {
			relays: {
				expose: null,
				idle: null,
			},
			init: function(){
				app.logger.silly('app.peripherals.relays.init()');
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
		photoResistor: {
			photoResistor: null,
			init: function(){
				app.logger.silly('app.peripherals.photoResistor.init()');
				app.logger.verbose('initializing photoResistor');
				app.logger.warn('Rebuild via Johnny-Five');
				return new Promise((resolve, reject) => {
					app.peripherals.photoResistor.photoResistor = require('gpioPhotoResistor');
					app.peripherals.photoResistor.photoResistor.init(app._logger, app.config.get('peripherals.photoResistor.config')).then(result => {
						app.logger.info('photoResistor initialized');
						resolve('photoResistor initialized');
					});
				});
			},
			exposure: {
				reset: function(){
					app.logger.silly('app.peripherals.photoResistor.exposure.reset()');
					app.peripherals.photoResistor.photoResistor.exposure.reset();
				},
				get: function(){
					app.logger.silly('app.peripherals.photoResistor.exposure.get()');
					return app.peripherals.photoResistor.photoResistor.exposure.get();
				}
			}
		},
		lcdScreen: {
			lcdScreen: null,
			init: function(){
				app.logger.silly('app.peripherals.lcdScreen.init()');
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
				app.logger.silly('app.peripherals.lcdScreen.reset()');
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
		},
	},
	date: {
		getDate: function(){
			app.logger.silly('app.date.getDate()');
			var dateObject = new Date();
			var d = ('0' + dateObject.getDate()).slice(-2);
			var m = ('0' + (dateObject.getMonth() + 1)).slice(-2);
			var y = dateObject.getFullYear();
			return y + '-' + m + '-' + d;
		},
		getTime: function(){
			app.logger.silly('app.date.getTime()');
			var dateObject = new Date();
			var h = ('0' + dateObject.getHours()).slice(-2);
			var m = ('0' + dateObject.getMinutes()).slice(-2);
			var s = ('0' + dateObject.getSeconds()).slice(-2);
			return h + ':' + m + ':' + s;
		}
	},
}
app.init();