// Vishay Semiconductors VEML6075 UVA and UVB Light Sensor
// i2c bus help from: https://github.com/xoblite/BreakoutGardener
const i2c = require('i2c-bus');

var gpioUvSensor = {
	_lowLightDebug: false,
	_bus: null,
	_busNumber: null,
	_busAddress: null,
	_readings: {
		uva: null,
		uvb: null,
		uvcomp1: null,
		uvcomp2: null,
	},
	init: function(logger, config){
		gpioUvSensor._lowLightDebug = config.lowLightDebug;
		gpioUvSensor._busNumber = config.bus.number;
		gpioUvSensor._busAddress = config.bus.address;
		gpioUvSensor._logger = logger.getLogger('gpioUvSensor', config.consoleLoggingLevel);
		gpioUvSensor._logger.debug('gpioUvSensor.init()');
		gpioUvSensor._logger.verbose('initializing gpioUvSensor');
		return new Promise((resolve, reject) => {
			var bus = i2c.openPromisified(gpioUvSensor._busNumber, {
				forceAccess: false
			})
			.then(bus => {
				// Identify using the device ID (0x26) of the VEML6075 device...
				bus.readWord(gpioUvSensor._busAddress, 0x0c)
				.then(deviceId => {
					if((deviceId & 0xff) == 0x26){
						// Configure the device...
						bus.writeByte(gpioUvSensor._busAddress, 0x00, 0b00000001) // Power off ("shut down")
						.then(bus.writeByte(gpioUvSensor._busAddress, 0x00, 0b00000000)) // Power on, normal (continuous) mode, 50 ms integration time, normal dynamic range
						.then(result => {
							gpioUvSensor._bus = bus;
							gpioUvSensor.exposure._tick.init(config.readIntervalMs);
							var msg = 'gpioUvSensor initialized';
							gpioUvSensor._logger.debug(msg);
							resolve(msg);
						});
					}else{
						var errMsg = 'Bad deviceId: ' + deviceId;
						gpioUvSensor._logger.error(errMsg);
						reject(errMsg);
					}
				});
				
			});
		});
	},
	get: function(){
		gpioUvSensor._logger.silly('gpioUvSensor.get()');
		// VIS and IR coefficients for a non-covered (i.e. open-air, non-diffused -> no glass or teflon filter) designs like the Adafruit breakout, as per the VEML6075 datasheet:
		var uva_a_coef = 2.22; // Default value for the UVA VIS coefficient ("a")
		var uva_b_coef = 1.33; // Default value for the UVA IR coefficient ("b")
		var uvb_c_coef = 2.95; // Default value for the UVB VIS coefficient ("c")
		var uvb_d_coef = 1.74; // Default value for the UVB IR coefficient ("d")
		var uva_resp = 0.001461; // UVA response
		var uvb_resp = 0.002591; // UVB response
		// read data
		// Uncalibrated UVA
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x07)
		.then(word => {
			gpioUvSensor._readings.uva = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uva read error', err);
		});
		// Uncalibrated UVB
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x09)
		.then(word => {
			gpioUvSensor._readings.uvb = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvb read error', err);
		});
		// UV compensation value 1
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x0a)
		.then(word => {
			gpioUvSensor._readings.uvcomp1 = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvcomp1 read error', err);
		});
		// UV compensation value 2
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x0b)
		.then(word => {
			gpioUvSensor._readings.uvcomp2 = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvcomp2 read error', err);
		});
		gpioUvSensor._logger.debug(JSON.stringify(gpioUvSensor._readings));
		// adusted uva/uvb
		var uvaAdjusted = Math.round(gpioUvSensor._readings.uva - (uva_a_coef * gpioUvSensor._readings.uvcomp1) - (uva_b_coef * gpioUvSensor._readings.uvcomp2));
		var uvbAdjusted = Math.round(gpioUvSensor._readings.uvb - (uvb_c_coef * gpioUvSensor._readings.uvcomp1) - (uvb_d_coef * gpioUvSensor._readings.uvcomp2));
		// uv index
		var uvIndex = ((uvaAdjusted * uva_resp) + (uvbAdjusted * uvb_resp)) / 2;
		if(uvIndex < 0){
			uvIndex = 0;
		}
		// uv index level
		var uvIndexLevel = 0;
		var uvIndexLevelText = 'Very Low';
		if (uvIndex > 10.9){
			uvIndexLevel = 5;
			uvIndexLevelText = 'Extreme';
		}else if(uvIndex > 7.9){
			uvIndexLevel = 4;
			uvIndexLevelText = 'Very High';
		}else if(uvIndex > 5.9){
			uvIndexLevel = 3;
			uvIndexLevelText = 'High';
		}else if(uvIndex > 2.9){
			uvIndexLevel = 2;
			uvIndexLevelText = 'Moderate';
		}else{
			uvIndexLevel = 1;
			uvIndexLevelText = 'Low';
		}
		var data = {
			uva: uvaAdjusted,
			uvb: uvbAdjusted,
			uvIndex: uvIndex,
			uvIndexLevel: uvIndexLevel,
			uvIndexText: uvIndexLevelText
		};
		return data;
	},
	stop: function(callback){
		gpioUvSensor._logger.debug('gpioUvSensor.stop()');
		// Soft reset applicable I2C devices upon exit? (in my experience, e.g. the SGP30 becomes more reliable across restarts with this enabled)
		// Soft reset all [supporting/applicable] devices using the I2C General Call address (0x00)...
		gpioUvSensor._bus.sendByte(gpioUvSensor._busAddress, 0x06)
		.then(result => {
			gpioUvSensor._bus.close()
			.then(result => {
				gpioUvSensor._logger.debug('gpioUvSensor bus closed');
				callback();
			});
		});
	},
	exposure: {
		_data: {
			elapsedMs: 0,
			elapsedSec: 0,
			elapsedMin: 0,
			uva: {
				read: 0,
				accumulated: 0,
			},
			uvb: {
				read: 0,
				accumulated: 0,
			},
			uvIndex: {
				index: 0,
				level: 0,
				text: '',
			}
		},
		_tick: {
			intervalMs: null,
			interval: null,
			init: function(intervalMs){
				gpioUvSensor._logger.debug('gpioUvSensor.exposure._tick.init()');
				gpioUvSensor.exposure._tick.intervalMs = intervalMs;
				gpioUvSensor.exposure._tick.interval = setInterval(gpioUvSensor.exposure._tick.update, gpioUvSensor.exposure._tick.intervalMs);
			},
			reset: function(){
				gpioUvSensor._logger.debug('gpioUvSensor.exposure._tick.reset()');
				gpioUvSensor.exposure._data.elapsedMs = 0;
				gpioUvSensor.exposure._data.elapsedSec = 0;
				gpioUvSensor.exposure._data.elapsedMin = 0;
				gpioUvSensor.exposure._data.uva.read = 0;
				gpioUvSensor.exposure._data.uva.accumulated = 0;
				gpioUvSensor.exposure._data.uvb.read = 0;
				gpioUvSensor.exposure._data.uvb.accumulated = 0;
			},
			update: function(){
				gpioUvSensor._logger.silly('gpioUvSensor.exposure._tick.update()');
				data = gpioUvSensor.get();
				// uv index
				gpioUvSensor.exposure._data.uvIndex.index = data.uvIndex.toFixed(2);
				gpioUvSensor.exposure._data.uvIndex.level = data.uvIndexLevel;
				gpioUvSensor.exposure._data.uvIndex.text = data.uvIndexText;
				// elapsed time
				gpioUvSensor.exposure._data.elapsedMs = gpioUvSensor.exposure._data.elapsedMs += gpioUvSensor.exposure._tick.intervalMs;
				gpioUvSensor.exposure._data.elapsedSec = Math.floor(gpioUvSensor.exposure._data.elapsedMs / 1000);
				gpioUvSensor.exposure._data.elapsedMin = Math.floor(gpioUvSensor.exposure._data.elapsedSec / 60);
				// uva
				if(data.uva < 0){
					if(gpioUvSensor._lowLightDebug){
						data.uva = data.uva * -120;
					}else{
						data.uva = 0;
					}
				}
				gpioUvSensor.exposure._data.uva.read = data.uva;
				gpioUvSensor.exposure._data.uva.readPerMin = data.uva * ((60 * 1000) / gpioUvSensor.exposure._tick.intervalMs);
				gpioUvSensor.exposure._data.uva.accumulated = gpioUvSensor.exposure._data.uva.accumulated + data.uva;
				// uvb
				if(data.uvb < 0){
					if(gpioUvSensor._lowLightDebug){
						data.uvb = data.uvb * -40;
					}else{
						data.uvb = 0;
					}
				}
				gpioUvSensor.exposure._data.uvb.read = data.uvb;
				gpioUvSensor.exposure._data.uvb.readPerMin = data.uvb * ((60 * 1000) / gpioUvSensor.exposure._tick.intervalMs);
				gpioUvSensor.exposure._data.uvb.accumulated = gpioUvSensor.exposure._data.uvb.accumulated + data.uvb;
			},
		},
		reset: function(){
			gpioUvSensor._logger.debug('gpioUvSensor.exposure.reset()');
			gpioUvSensor.exposure._tick.reset();
		},
		get: function(){
			gpioUvSensor._logger.silly('gpioUvSensor.exposure.get()');
			return gpioUvSensor.exposure._data;
		}
	},
}
module.exports = gpioUvSensor;