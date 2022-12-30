// var J5 = require('johnny-five');
const {Board, Led, Pin, Button} = require('johnny-five');
const Raspi = require('raspi-io').RaspiIO;

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
app.peripherals.init()
		// app.cache.init()
		// .then(app.peripherals.init)
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
						app.tasks.settings.enable();
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
			app.logger.silly('app.peripherals.init()');
			app.logger.verbose('initializing peripherals');
			return new Promise((resolve, reject) => {
				this.board.init()
				.then(this.leds.init)
				.then(this.buzzer.init)
				.then(this.relays.init)
				// .then(this.photoResistor.init)
				// .then(this.lcdScreen.init)
				.then(this.buttons.init)
				.then(result => {
					app.logger.info('peripherals initialized');
					resolve('peripherals initialized');
				})
				.catch(error => {
					app.logger.error(error);
				});
			});
		},
		board: {
			_board: null,
			init: function(){
				app.logger.silly('app.peripherals.board.init()');
				app.logger.verbose('initializing board');
				return new Promise((resolve, reject) => {
					this._board = new Board({
						io: new Raspi(),
						debug: app.config.get('peripherals.board.debug'),
					});
					this._board.on('ready', () => {
						// for whatever reason, >> is printed to the console after the board is ready, add a new line to keep the conole log pretty
						console.log();
						// ==========
						// Use the board's `samplingInterval(ms)` to
						// control the actual MCU sampling rate.
						//
						// This will limit sampling of all Analog Input
						// and I2C sensors to once per second (1000 milliseconds)
						//
						// Keep in mind that calling this method
						// will ALWAYS OVERRIDE any per-sensor
						// interval/rate/frequency settings.
						// ==========
						// board.samplingInterval(1000);
						this._board.on('exit', () => {
							this._exit();
						});
						app.logger.info('board initialized');
						resolve('board initialized');
					});
				});
			},
			getBoard: function(){
				app.logger.silly('app.peripherals.board.getBoard()');
				return this._board;
			},
			_exit: function(){
				app.logger.silly('app.peripherals.board._exit()');
			},
		},
		leds: {
			_leds: {
				exposureOn: null,
				exposureOff: null,
				peripheralFeedback: null,
			},
			init: function(){
				app.logger.silly('app.peripherals.leds.init()');
				app.logger.verbose('initializing leds');
				return new Promise((resolve, reject) => {
					app.peripherals.leds._leds.exposureOn = new Led('GPIO' + app.config.get('peripherals.leds.exposureOn.gpioPin'));
					app.peripherals.leds._leds.exposureOff = new Led('GPIO' + app.config.get('peripherals.leds.exposureOff.gpioPin'));
					app.peripherals.leds._leds.peripheralFeedback = new Led('GPIO' + app.config.get('peripherals.leds.peripheralFeedback.gpioPin'));
					app.logger.info('leds initialized');
					resolve('leds initialized');
				});
			},
			exposure: {
				on: function(){
					app.logger.silly('app.peripherals.leds.exposure.on()');
					app.peripherals.leds._leds.exposureOff.off();
					app.peripherals.leds._leds.exposureOn.pulse({
						easing: 'inOutSine', // linear, inOutSine, outSine, inSine
						duration: 500,
					});
				},
				off: function(){
					app.logger.silly('app.peripherals.leds.exposure.off()');
					app.peripherals.leds._leds.exposureOff.on();
					app.peripherals.leds._leds.exposureOn.stop().off();
				},
			},
			peripheralFeedback: {
				blip: function(){
					app.logger.silly('app.peripherals.leds.peripheralFeedback.blip()');
					app.peripherals.leds._leds.peripheralFeedback.off();
					app.peripherals.leds._leds.peripheralFeedback.pulse({
						easing: 'inSine', // linear, inOutSine, outSine, inSine
						duration: 250,
						onstop: () => {
							app.peripherals.leds._leds.peripheralFeedback.off();
						}
					}, () => {
						app.peripherals.leds._leds.peripheralFeedback.stop();
					});
				}
			},
		},
		buzzer: {
			_buzzer: null,
			_isBeeping: false,
			_beepInterval: null,
			init: function(){
				app.logger.silly('app.peripherals.buzzer.init()');
				app.logger.verbose('initializing buzzer');
				return new Promise((resolve, reject) => {
					app.peripherals.buzzer._buzzer = new Pin('GPIO' + app.config.get('peripherals.buzzer.config.gpioPin'));
					app.logger.info('buzzer initialized');
					resolve('buzzer initialized');
				});
			},
			_reset: function(){
				app.logger.silly('app.peripherals.buzzer._reset()');
				this._isBeeping = false;
				clearInterval(this._beepInterval);
				this._buzzer.low();
			},
			_buzz: function(durationMilliseconds = 100){
				app.logger.silly('app.peripherals.buzzer._buzz()');
				this._reset();
				this._buzzer.high();
				setTimeout(() => {
					this._buzzer.low();
				}, durationMilliseconds);
			},
			_beep: function(milliseconds = 500){
				app.logger.silly('app.peripherals.buzzer._beep()');
				this._reset();
				this._beepInterval = setInterval(() => {
					if(this._isBeeping){
						this._buzzer.low();
						this._isBeeping = false;
					}else{
						this._buzzer.high();
						this._isBeeping = true;
					}
				}, milliseconds);
			},
			buzz: function(){
				app.logger.silly('app.peripherals.buzzer.buzz()');
				app.peripherals.buzzer._buzz();
			},
			buzzLong: function(){
				app.logger.silly('app.peripherals.buzzer.buzzLong()');
				app.peripherals.buzzer._buzz(750);
			},
			beep: function(){
				app.logger.silly('app.peripherals.buzzer.beep()');
				app.peripherals.buzzer._beep();
			},
			beepFast: function(){
				app.logger.silly('app.peripherals.buzzer.beepFast()');
				app.peripherals.buzzer._beep(100);
			},
			off: function(){
				app.logger.silly('app.peripherals.buzzer.off()');
				app.peripherals.buzzer._reset();
			},
		},
		relays: {
			_relays: {
				expose: null,
				idle: null,
			},
			init: function(){
				app.logger.silly('app.peripherals.relays.init()');
				app.logger.verbose('initializing relays');
				return new Promise((resolve, reject) => {
					// var gpioRelay = require('gpioRelay');
					// gpioRelay.init(app._logger, app.config.get('peripherals.relays.config')).then(result => {
						// app.peripherals.relays.relays.expose = gpioRelay.build('expose', app.config.get('peripherals.relays.relays.expose.gpioPin'));
						// app.peripherals.relays.relays.idle = gpioRelay.build('idle', app.config.get('peripherals.relays.relays.idle.gpioPin'));
					// });
					app.logger.info('relays initialized');
					resolve('relays initialized');
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
		buttons: {
			_buttons: {
				exposureDecrease: null,
				exposureIncrease: null,
				exposureStart: null,
				exposureStop: null,
			},
			init: function(){
				app.logger.silly('app.peripherals.buttons.init()');
				app.logger.verbose('initializing buttons');
				return new Promise((resolve, reject) => {
					app.peripherals.buttons._build();
					app.logger.info('buttons initialized');
					resolve('buttons initialized');
				});
			},
			_build: function(){
				app.logger.silly('app.peripherals.buttons._build()');
				// exposureDecrease
				this._buttons.exposureDecrease = new Button({pin: 'GPIO' + app.config.get('peripherals.buttons.exposureDecrease.gpioPin'), pullup: true});
				this._buttons.exposureDecrease.on('down', () => (app.peripherals.buttons._callbacks.exposureDecrease()));
				this._buttons.exposureDecrease.on('hold', () => (app.peripherals.buttons._callbacks.exposureDecrease(false)));
				// exposureIncrease
				this._buttons.exposureIncrease = new Button({pin: 'GPIO' + app.config.get('peripherals.buttons.exposureIncrease.gpioPin'), pullup: true});
				this._buttons.exposureIncrease.on('down', () => (app.peripherals.buttons._callbacks.exposureIncrease()));
				this._buttons.exposureIncrease.on('hold', () => (app.peripherals.buttons._callbacks.exposureIncrease(false)));
				// exposureStart
				this._buttons.exposureStart = new Button({pin: 'GPIO' + app.config.get('peripherals.buttons.exposureStart.gpioPin'), pullup: true});
				this._buttons.exposureStart.on('down', this._callbacks.exposureStart);
				// exposureStop
				this._buttons.exposureStop = new Button({pin: 'GPIO' + app.config.get('peripherals.buttons.exposureStop.gpioPin'), pullup: true});
				this._buttons.exposureStop.on('down', this._callbacks.exposureStop);
			},
			_callbacks: {
				_click: function(){
					app.logger.silly('app.peripherals.buttons._callbacks._click()');
					app.peripherals.leds.peripheralFeedback.blip();
// app.peripherals.buzzer.buzz();
				},
				exposureDecrease: function(click = true){
					app.logger.silly('app.peripherals.buttons._callbacks.exposureDecrease()', click);
					if(click)
						app.peripherals.buttons._callbacks._click();
					// app.tasks.settings.exposure.decrease();
app.peripherals.buzzer.buzzLong();
				},
				exposureIncrease: function(click = true){
					app.logger.silly('app.peripherals.buttons._callbacks.exposureIncrease()');
					if(click)
						app.peripherals.buttons._callbacks._click();
					// app.tasks.settings.exposure.increase();
app.peripherals.buzzer.beepFast();
				},
				// exposureStart
				exposureStart: function(){
					app.logger.silly('app.peripherals.buttons._callbacks.exposureStart()');
					app.peripherals.buttons._callbacks._click();
					// app.tasks.exposure.start();
app.peripherals.leds.exposure.on();
app.peripherals.buzzer.beep();
				},
				// exposureStop
				exposureStop: function(){
					app.logger.silly('app.peripherals.buttons._callbacks.exposureStop()');
					app.peripherals.buttons._callbacks._click();
					// app.tasks.exposure.stop();
app.peripherals.leds.exposure.off();
app.peripherals.buzzer.buzz();
				},
			}
		},
// var lcd = new five.LCD({
	// controller: 'LCM1602'
// });
// lcd.cursor(2, 0);
// var i = 0;
// setInterval(function(){
	// lcd.cursor(0, 0).print(('' + i).repeat(8)).cursor(1, 0).print(('' + i).repeat(8)).cursor(2, 0);
	// i++;
// }, 1000);
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
			/* reset: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen.lines.reset().then(result => {
						resolve();
					});
				});
			},
			update: {
				top: function(text){
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.top.update(app.peripherals.lcdScreen._trimText(text))
						.then(result => {
							resolve();
						});
					});
				},
				bottom: function(text){
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.bottom.update(app.peripherals.lcdScreen._trimText(text))
						.then(result => {
							resolve();
						});
					});
				},
			},
			_trimText: function(text){
				text = '' + text;
				text = text + '                ';
				text = text.slice(0, 16);
				return text;
			}, */
		},
		/* lcdScreen: {
			lcdScreen: null,
			init: function(){
				return new Promise((resolve, reject) => {
					app.peripherals.lcdScreen.lcdScreen = require('gpioLcdScreen');
					app.peripherals.lcdScreen.lcdScreen.init(app._logger, app.config.get('peripherals.lcdScreen.config')).then(result => {
						resolve('gpioLcdScreen initialized');
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
						app.peripherals.lcdScreen.lcdScreen.lines.top.update(app.peripherals.lcdScreen._trimText(text))
						.then(result => {
							resolve();
						});
					});
				},
				bottom: function(text){
					return new Promise((resolve, reject) => {
						app.peripherals.lcdScreen.lcdScreen.lines.bottom.update(app.peripherals.lcdScreen._trimText(text))
						.then(result => {
							resolve();
						});
					});
				},
			},
			_trimText: function(text){
				text = '' + text;
				text = text + '                ';
				text = text.slice(0, 16);
				return text;
			},
		}, */
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