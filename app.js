var app = {
	config: null,
	logger: null,
	_logger: null, // configuledRed logger object
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
		app.logger.debug('app.init()');
		app.logger.verbose('initializing application');
		// new Promise((resolve, reject) => {resolve();})
		app.cache.init()
		.then(app.peripherals.init)
		.then(app.tasks.init)
		.then(result => {
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
		_currentTask: null,
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
				var i = 2;
				app.peripherals.leds.leds.ledGreen.on();
				var interval = setInterval(function(){
					// animate leds while waiting for CPU to calm down
					if(i == 2){
						app.peripherals.leds.leds.ledYellow.on();
					}else if(i == 1){
						app.peripherals.leds.leds.ledRed.on();
					}
					if(i <= 0){
						app.peripherals.leds.leds.ledGreen.off();
						app.peripherals.leds.leds.ledYellow.off();
						app.peripherals.leds.leds.ledRed.off();
						clearInterval(interval);
						app.tasks.settings.enable();
					}
					i--;
				}, 500);
			});
		},
		disableAll: function(){
			app.logger.debug('app.tasks.disableAll()');
			app.tasks._currentTask = null;
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
				app.peripherals.leds.leds.ledRed.on();
				app.peripherals.buttons.buttons.exposureUp.enable();
				app.peripherals.buttons.buttons.exposureDown.enable();
				app.peripherals.buttons.buttons.exposureStart.enable();
				app.peripherals.buttons.buttons.exposureStop.enable();
				app.tasks._currentTask = 'settings';
			},
			disable: function(){
				app.logger.debug('app.tasks.settings.disable()');
				app.tasks.settings._lcd.disable();
			},
			_lcd: {
				textPadding: {
					uva: 9,
					exposure: 14,
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
						'UVA/Min' + app.peripherals.lcdScreen.padTextLeft('0', app.tasks.settings._lcd.textPadding.uva)
					);
					app.tasks.settings._lcd._updateExposure(app.cache.exposure.get());
					app.tasks.settings._lcd.interval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
						// console.log(data);
						// console.log('a|' + data.uva.read + '|' + data.uva.accumulated + '|b|' + data.uvb.read + '|' + data.uvb.accumulated + '|s|' + data.elapsedSec);
						app.peripherals.lcdScreen.update.top(
							'UVA/Min' + app.peripherals.lcdScreen.padTextLeft(
								app.peripherals.lcdScreen.shortenNumber(data.uva.readPerMin)
							, app.tasks.settings._lcd.textPadding.uva)
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
						'Xp' + app.peripherals.lcdScreen.padTextLeft(
							app.peripherals.lcdScreen.shortenNumber(exposure)
							+ ' ' + app.tasks.settings._lcd._getExposureTime(exposure)
						, app.tasks.settings._lcd.textPadding.exposure)
					);
				},
				_getExposureTime: function(exposure){
					app.logger.silly('app.tasks.settings._lcd._getExposureTime()');
					var data = app.peripherals.uvSensor.exposure.get();
					if(data.uva.readPerMin <= 0){
						return '00:00';
					}
					var expPerMs = ((data.uva.readPerMin / 60) / 60) / 1000;
					var expHrs = (((exposure / expPerMs) / 1000) / 60) / 60 / 60;
					var expMins = (((exposure / expPerMs) / 1000) / 60) / 60;
					var expSecs = (((exposure / expPerMs) / 1000) / 60);
					if(expHrs >= 1){
						expMins = expMins - (Math.floor(expHrs) * 60);
						expSecs = expSecs - (Math.floor(expHrs) * 60 * 60);
					}else if(expMins >= 1){
						expSecs = expSecs - (Math.floor(expMins) * 60);
					}
					// console.log(exposure + '|' + data.uva.readPerMin + '|' + parseFloat(expPerMs).toFixed(4) + '|' + parseFloat(expMins).toFixed(4) + '|' + parseFloat(expSecs).toFixed(4));
					// console.log(expHrs.toFixed(2) + ':' + expMins.toFixed(2) + ':' + expSecs.toFixed(2));
					if(expHrs >= 1){
						expHrs = app.peripherals.lcdScreen.padTextLeft(Math.floor(expHrs), 2, '0');
						expMins = app.peripherals.lcdScreen.padTextLeft(Math.floor(expMins), 2, '0');
						return expHrs + 'h' + expMins;
					}else{
						expMins = app.peripherals.lcdScreen.padTextLeft(Math.floor(expMins), 2, '0');
						expSecs = app.peripherals.lcdScreen.padTextLeft(Math.floor(expSecs), 2, '0');
						return expMins + ':' + expSecs;
					}
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
			relayOverride: {
				enable: function(){
					app.logger.debug('app.tasks.settings.relayOverride.enable()');
					app.peripherals.relays.relays.relayA.on();
					app.peripherals.relays.relays.relayB.on();
				},
				disable: function(){
					app.logger.debug('app.tasks.settings.relayOverride.disable()');
					app.peripherals.relays.relays.relayA.off();
					app.peripherals.relays.relays.relayB.off();
				}
			}
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
				app.peripherals.relays.relays.relayA.on();
				app.peripherals.relays.relays.relayB.on();
				app.peripherals.leds.leds.ledRed.off();
				app.peripherals.leds.leds.ledYellow.flash();
				app.tasks.exposure._lcd.wait();
				app.tasks._currentTask = 'exposure';
				// wait for UV light to turn on
				setTimeout(function(){
					app.peripherals.leds.leds.ledYellow.off();
					var data = app.peripherals.uvSensor.exposure.get();
					// this is the initial power on, verify UVA is being read
					if(data.uva.read <= 0){
						app.logger.warn('No UVA reading');
						app.tasks.settings.enable();
						return;
					}
					app.tasks.exposure._lcd.enable();
					app.peripherals.leds.leds.ledRed.off();
					app.peripherals.leds.leds.ledGreen.flash();
					app.peripherals.buttons.buttons.exposureStop.enable();
					var maxExp = app.cache.exposure.get();
					var uvLostI = 0;
					var previousUvAccumulated = 0;
					var halfUvAccumulatedBuzz = true;
					// check the UV exposure amount
					app.tasks.exposure._exposureInterval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
						// console.log(data.uva.accumulated + '|' + maxExp);
						if(data.uva.accumulated >= maxExp){
							app.tasks.settings.enable();
						}else{
							// buzz at interval
							if(data.uva.accumulated - previousUvAccumulated >= app.config.get('tasks.exposure.buzzIncrement')){
								app.peripherals.buzzer.buzzLong();
								previousUvAccumulated = data.uva.accumulated;
								halfUvAccumulatedBuzz = true;
							}else if(
									(data.uva.accumulated - previousUvAccumulated >= (app.config.get('tasks.exposure.buzzIncrement') / 2))
								&&	true === halfUvAccumulatedBuzz
							){
								halfUvAccumulatedBuzz = false;
								app.peripherals.buzzer.buzz();
							}
							// check if UV data reading becomes innacurate
							if(data.uva.read <= 0){
								app.logger.warn('No UVA reading warning ' + uvLostI);
								if(uvLostI >= app.config.get('tasks.exposure.maxMissingUVReadings')){
									app.logger.error('Lost UVA reading');
									app.tasks.settings.enable();
								}
								uvLostI++;
							}else{
								uvLostI = 0;
							}
						}
					}, app.config.get('peripherals.uvSensor.config.readIntervalMs') + 100);
				}, 1000); // needs time for the transformer to warm up and stabilize current
			},
			disable: function(){
				app.logger.debug('app.tasks.exposure.disable()');
				clearInterval(app.tasks.exposure._exposureInterval);
				app.tasks.exposure._lcd.disable();
				app.peripherals.leds.leds.ledGreen.off();
				app.peripherals.buzzer.off();
				app.peripherals.relays.relays.relayA.off();
				app.peripherals.relays.relays.relayB.off();
			},
			// enable alias
			start: function(){
				app.logger.debug('app.tasks.exposure.start()');
				app.tasks.exposure.enable();
			},
			_lcd: {
				intervalMs: null,
				interval: null,
				init: function(){
					app.logger.debug('app.tasks.exposure._lcd.init()');
					app.tasks.exposure._lcd.intervalMs = app.config.get('tasks.exposure.lcdInterval');
				},
				wait: function(){
					app.logger.debug('app.tasks.exposure._lcd.wait()');
					app.peripherals.lcdScreen.update.top('Turning on LEDs');
					app.peripherals.lcdScreen.update.bottom('Reading UVA');
				},
				enable: function(){
					app.logger.debug('app.tasks.exposure._lcd.enable()');
					app.peripherals.lcdScreen.reset();
					app.peripherals.uvSensor.exposure.reset();
					app.tasks.exposure._lcd.interval = setInterval(function(){
						var data = app.peripherals.uvSensor.exposure.get();
						// console.log('a|' + data.uva.read + '|' + data.uva.accumulated + '|b|' + data.uvb.read + '|' + data.uvb.accumulated + '|s|' + data.elapsedSec);
						app.peripherals.lcdScreen.update.top(
								app.peripherals.lcdScreen.padTextLeft(app.peripherals.lcdScreen.shortenNumber(data.uva.readPerMin), 8)
							+	app.peripherals.lcdScreen.padTextLeft(app.peripherals.lcdScreen.shortenNumber(data.uva.accumulated), 8)
						);
						app.peripherals.lcdScreen.update.bottom(
							'Xp' + app.peripherals.lcdScreen.padTextLeft(
								app.peripherals.lcdScreen.shortenNumber(app.cache.exposure.get())
								+ ' ' + app.tasks.exposure._lcd._getExposureTime()
							, 14)
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
					// console.log(data.elapsedMin + '|' + data.elapsedSec);
					// data.elapsedMin = Math.floor(Math.random() * (120 - 0 + 1) + 0);
					// data.elapsedSec = (data.elapsedMin * 60) + Math.floor(Math.random() * (60 - 0 + 1) + 0);
					// console.log(data.elapsedMin + '|' + data.elapsedSec);
					var hrs = data.elapsedMin / 60;
					var mins = data.elapsedMin;
					var secs = data.elapsedSec;
					// console.log(hrs.toFixed(1) + ':' + mins.toFixed(1) + ':' + secs.toFixed(1));
					if(hrs >= 1){
						secs = secs - (Math.floor(mins) * 60);
						mins = mins - (Math.floor(hrs) * 60);
					}else if(mins >= 1){
						secs = secs - (Math.floor(mins) * 60);
					}
					// console.log(hrs.toFixed(1) + ':' + mins.toFixed(1) + ':' + secs.toFixed(1));
					if(hrs >= 1){
						return app.peripherals.lcdScreen.padTextLeft(Math.floor(hrs), 2, '0') + 'h' + app.peripherals.lcdScreen.padTextLeft(Math.floor(mins), 2, '0');
					}else{
						return app.peripherals.lcdScreen.padTextLeft(Math.floor(mins), 2, '0') + ':' + app.peripherals.lcdScreen.padTextLeft(Math.floor(secs), 2, '0');
					}
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
						app.peripherals.buttons.buttons.exposureUp = gpioButton.build('exposureUp', app.config.get('peripherals.buttons.buttons.exposureUp.gpioPin'), app.peripherals.buttons.callbacks.exposureUp, app.peripherals.buttons.callbacks.exposureUpHold);
						app.peripherals.buttons.buttons.exposureDown = gpioButton.build('exposureDown', app.config.get('peripherals.buttons.buttons.exposureDown.gpioPin'), app.peripherals.buttons.callbacks.exposureDown, app.peripherals.buttons.callbacks.exposureDownHold);
						app.peripherals.buttons.buttons.exposureStart = gpioButton.build('exposureStart', app.config.get('peripherals.buttons.buttons.exposureStart.gpioPin'), app.peripherals.buttons.callbacks.exposureStart);
						app.peripherals.buttons.buttons.exposureStop = gpioButton.build(
							'exposureStop',
							app.config.get('peripherals.buttons.buttons.exposureStop.gpioPin'),
							app.peripherals.buttons.callbacks.exposureStop,
							app.peripherals.buttons.callbacks.exposureStopHold,
							app.peripherals.buttons.callbacks.exposureStopHoldRelease
						);
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
					app.peripherals.leds.leds.ledYellow.blip();
				},
				exposureUp: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureUp()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.up();
				},
				exposureUpHold: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureUpHold()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.up();
				},
				exposureDown: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureDown()');
					app.peripherals.buttons.callbacks._click();
					app.tasks.settings.exposure.down();
				},
				exposureDownHold: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureDownHold()');
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
					if(app.tasks._currentTask == 'exposure'){
						app.tasks.settings.enable();
					}
				},
				_exposureStopHoldStarted: false,
				_exposureStopHoldClearInverval: null,
				exposureStopHold: function(){
					app.logger.debug('app.peripherals.buttons.callbacks.exposureStopHold()');
					app.peripherals.buttons.callbacks._click();
					if(app.tasks._currentTask == 'settings'){
						if(app.peripherals.buttons.buttons.exposureStop.isHeld()){
							clearTimeout(app.peripherals.buttons.callbacks._exposureStopHoldClearInverval);
							app.peripherals.buttons.callbacks._exposureStopHoldClearInverval = setTimeout(function(){
								// exposureStopHold hold release
								app.tasks.settings.relayOverride.disable();
								app.peripherals.buttons.callbacks._exposureStopHoldStarted = false;
							}, 250);
							if(false === app.peripherals.buttons.callbacks._exposureStopHoldStarted){
								// exposureStopHold intial hold
								app.tasks.settings.relayOverride.enable();
								app.peripherals.buttons.callbacks._exposureStopHoldStarted = true;
							}
						}
					}
				},
			}
		},
		leds: {
			leds: {
				ledGreen: null,
				ledRed: null,
				ledYellow: null,
			},
			init: function(){
				app.logger.debug('app.peripherals.leds.init()');
				app.logger.verbose('initializing leds');
				return new Promise((resolve, reject) => {
					var gpioLed = require('gpioLed');
					gpioLed.init(app._logger, app.config.get('peripherals.leds.config')).then(result => {
						app.peripherals.leds.leds.ledGreen = gpioLed.build('ledGreen', app.config.get('peripherals.leds.leds.ledGreen.gpioPin'));
						app.peripherals.leds.leds.ledRed = gpioLed.build('ledRed', app.config.get('peripherals.leds.leds.ledRed.gpioPin'));
						app.peripherals.leds.leds.ledYellow = gpioLed.build('ledYellow', app.config.get('peripherals.leds.leds.ledYellow.gpioPin'));
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
				relayA: null,
				relayB: null,
			},
			init: function(){
				app.logger.debug('app.peripherals.relays.init()');
				app.logger.verbose('initializing relays');
				return new Promise((resolve, reject) => {
					var gpioRelay = require('gpioRelay');
					gpioRelay.init(app._logger, app.config.get('peripherals.relays.config')).then(result => {
						app.peripherals.relays.relays.relayA = gpioRelay.build('relayA', app.config.get('peripherals.relays.relays.relayA.gpioPin'));
						app.peripherals.relays.relays.relayB = gpioRelay.build('relayB', app.config.get('peripherals.relays.relays.relayB.gpioPin'));
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
					return (num / 1000000).toFixed(decimals) + 'm';
				}else if(num >= 1000){
					return (num / 1000).toFixed(decimals) + 'k';
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