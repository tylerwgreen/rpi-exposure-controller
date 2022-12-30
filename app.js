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
		.then(result => {
			app.logger.info('cache initialized');
		})
		.then(app.peripherals.init)
		.then(result => {
			app.logger.info('peripherals initialized');
		})
		.then(app.tasks.init)
		.then(result => {
			app.logger.info('tasks initialized');
		})
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
			return new Promise((resolve, reject) => {
				app.cache.flatCache = flatCache = require('flat-cache');
				app.cache.cacheId = app.config.get('cache.id');
				app.cache.cache = app.cache.flatCache.load(app.cache.cacheId, process.env['APP_CACHE_DIR']);
				resolve();
			});
		},
		exposure: {
			set: function(value){
				if(typeof value !== 'number')
					throw new Error('exposure must be typeof number');
				app.cache.cache.setKey('exposure', value);
				app.cache.cache.save(noPrune = true);
			},
			get: function(){
				return app.cache.cache.getKey('exposure');
			},
		}
	},
	tasks: {
		init: function(){
			return new Promise((resolve, reject) => {
				app.tasks.settings.init()
				app.tasks.exposure.init()
				.then(result => {
					resolve();
				})
				.catch(error => {
					app.logger.error(error);
				});
			});
		},
		settings: {
			init: function(){
				return new Promise((resolve, reject) => {
					app.tasks.settings.disable();
					app.peripherals.leds.leds.exposureOff.on();
					app.peripherals.lcdScreen.update.top('Welcome!')
					.then(app.peripherals.lcdScreen.update.bottom(app.date.getDate()))
					.then(app.peripherals.lcdScreen.update.top('Exposure'))
					.then(app.peripherals.lcdScreen.update.bottom(app.cache.exposure.get()))
					.then(result => {
						// app.tasks.settings.enable();
						resolve();
					});
				});
			},
enable: function(){
	app.tasks.settings.enabled = true;
},
disable: function(){
	app.tasks.settings.enabled = false;
},
			exposure: {
				up: function(){
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
				return new Promise((resolve, reject) => {
					app.tasks.exposure.disable();
					resolve();
				});
			},
enable: function(){
	app.tasks.exposure.enabled = true;
},
disable: function(){
	app.tasks.exposure.enabled = false;
},
			start: function(){
				app.peripherals.leds.leds.exposureOn.flash();
				app.peripherals.leds.leds.exposureOff.off();
				app.peripherals.buzzer.beep();
				app.peripherals.relays.relays.expose.on();
				app.peripherals.relays.relays.idle.off();
				app.peripherals.photoResistor.exposure.reset();
				app.tasks.exposure.updateLcd();
			},
			stop: function(){
				app.peripherals.leds.leds.exposureOn.off();
				app.peripherals.leds.leds.exposureOff.on();
				app.peripherals.buzzer.off();
				app.peripherals.relays.relays.expose.off();
				app.peripherals.relays.relays.idle.on();
				app.peripherals.lcdScreen.reset().then(result => {
clearInterval(app.tasks.exposure.lcdInterval);
app.logger.verbose('light: ' + app.peripherals.photoResistor.exposure.get().light + 's|dark: ' + app.peripherals.photoResistor.exposure.get().dark + 's');
				});
			},
			updateLcd: function(){
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
			return new Promise((resolve, reject) => {
				app.peripherals.buttons.init().then(result => {app.logger.info('buttons initialized');})
				.then(app.peripherals.leds.init).then(result => {app.logger.info('leds initialized');})
				.then(app.peripherals.buzzer.init).then(result => {app.logger.info('buzzer initialized');})
				.then(app.peripherals.relays.init).then(result => {app.logger.info('relays initialized');})
				.then(app.peripherals.photoResistor.init).then(result => {app.logger.info('photoResistor initialized');})
				.then(app.peripherals.lcdScreen.init).then(result => {app.logger.info('lcdScreen initialized');})
				.then(result => {
					resolve();
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
				return new Promise((resolve, reject) => {
					var gpioButton = require('gpioButton');
					gpioButton.init(app._logger, app.config.get('peripherals.buttons.config')).then(result => {
						app.peripherals.buttons.buttons.exposureUp = gpioButton.build('exposureUp', app.config.get('peripherals.buttons.buttons.exposureUp.gpioPin'), app.peripherals.buttons.callbacks.exposureUp);
						app.peripherals.buttons.buttons.exposureDown = gpioButton.build('exposureDown', app.config.get('peripherals.buttons.buttons.exposureDown.gpioPin'), app.peripherals.buttons.callbacks.exposureDown);
						app.peripherals.buttons.buttons.exposureStart = gpioButton.build('exposureStart', app.config.get('peripherals.buttons.buttons.exposureStart.gpioPin'), app.peripherals.buttons.callbacks.exposureStart);
						app.peripherals.buttons.buttons.exposureStop = gpioButton.build('exposureStop', app.config.get('peripherals.buttons.buttons.exposureStop.gpioPin'), app.peripherals.buttons.callbacks.exposureStop);
						resolve('buttons initialized');
					});
				});
			},
			callbacks: {
				_click: function(){
					app.peripherals.leds.leds.peripheralFeedback.blip();
				},
				exposureUp: function(){
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.up();
				},
				exposureDown: function(){
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.down();
				},
				exposureStart: function(){
					app.peripherals.buttons.callbacks._click();
					app.tasks.exposure.start();
				},
				exposureStop: function(){
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
				return new Promise((resolve, reject) => {
					var gpioLed = require('gpioLed');
					gpioLed.init(app._logger, app.config.get('peripherals.leds.config')).then(result => {
						app.peripherals.leds.leds.exposureOn = gpioLed.build('exposureOn', app.config.get('peripherals.leds.leds.exposureOn.gpioPin'));
						app.peripherals.leds.leds.exposureOff = gpioLed.build('exposureOff', app.config.get('peripherals.leds.leds.exposureOff.gpioPin'));
						app.peripherals.leds.leds.peripheralFeedback = gpioLed.build('peripheralFeedback', app.config.get('peripherals.leds.leds.peripheralFeedback.gpioPin'));
						resolve('leds initialized');
					});
				});
			},
		},
		buzzer: {
			buzzer: null,
			init: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.buzzer.buzzer = require('gpioBuzzer');
					app.peripherals.buzzer.buzzer.init(app._logger, app.config.get('peripherals.buzzer.config')).then(result => {
						resolve('buzzer initialized');
					});
				});
			},
			buzz: function(){
				this.buzzer.buzz(100);
			},
			buzzLong: function(){
				this.buzzer.buzz(500);
			},
			beep: function(){
				this.buzzer.beep(250);
			},
			off: function(){
				this.buzzer.off();
			}
		},
		relays: {
			relays: {
				expose: null,
				idle: null,
			},
			init: function(){
				return new Promise((resolve, reject) => {
					var gpioRelay = require('gpioRelay');
					gpioRelay.init(app._logger, app.config.get('peripherals.relays.config')).then(result => {
						app.peripherals.relays.relays.expose = gpioRelay.build('expose', app.config.get('peripherals.relays.relays.expose.gpioPin'));
						app.peripherals.relays.relays.idle = gpioRelay.build('idle', app.config.get('peripherals.relays.relays.idle.gpioPin'));
						resolve('relays initialized');
					});
				});
			},
		},
		photoResistor: {
			photoResistor: null,
			init: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.photoResistor.photoResistor = require('gpioPhotoResistor');
					app.peripherals.photoResistor.photoResistor.init(app._logger, app.config.get('peripherals.photoResistor.config')).then(result => {
						resolve('photoResistor initialized');
					});
				});
			},
			exposure: {
				reset: function(){
					app.peripherals.photoResistor.photoResistor.exposure.reset();
				},
				get: function(){
					return app.peripherals.photoResistor.photoResistor.exposure.get();
				}
			}
		},
		lcdScreen: {
			lcdScreen: null,
			init: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen = require('gpioLcd');
					app.peripherals.lcdScreen.lcdScreen.init(app._logger, app.config.get('peripherals.lcdScreen.config')).then(result => {
						resolve('gpioLcd initialized');
					});
				});
			},
			reset: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen.lines.reset().then(result => {
						resolve();
					});
				});
			},
			update: {
				top: function(text){
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.top.update(text)
						.then(result => {
							resolve();
						});
					});
				},
				bottom: function(text){
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
			var dateObject = new Date();
			var d = ('0' + dateObject.getDate()).slice(-2);
			var m = ('0' + (dateObject.getMonth() + 1)).slice(-2);
			var y = dateObject.getFullYear();
			return y + '-' + m + '-' + d;
		},
		getTime: function(){
			var dateObject = new Date();
			var h = ('0' + dateObject.getHours()).slice(-2);
			var m = ('0' + dateObject.getMinutes()).slice(-2);
			var s = ('0' + dateObject.getSeconds()).slice(-2);
			return h + ':' + m + ':' + s;
		}
	},
}
app.init();