// Vishay Semiconductors VEML6075 UVA and UVB Light Sensor
// i2c bus help from: https://github.com/xoblite/BreakoutGardener
const i2c = require('i2c-bus');

var gpioUvSensor = {
	_lowLightDebug: false,
	_bus: null,
	_busNumber: null,
	_busAddress: null,
	_integrationTimeMs: null,
	_logReadingsToConsoleFlag: null,
	_sensorReadings: {
		uva: null,
		uvb: null,
		uvcomp1: null,
		uvcomp2: null,
	},
	init: function(logger, config){
		gpioUvSensor._lowLightDebug = config.lowLightDebug;
		gpioUvSensor._busNumber = config.bus.number;
		gpioUvSensor._busAddress = config.bus.address;
		gpioUvSensor._integrationTimeMs = config.integrationTimeMs;
		gpioUvSensor._logReadingsToConsoleFlag = config.logReadingsToConsole;
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
						// determine comand code for specified integrationTimeMs [Longer Integration Time: Ideal for situations where the light levels are low or the signal is weak. Provides better sensitivity by allowing more time to accumulate photons, leading to a higher SNR. Suitable for applications where precision and accuracy are more critical than speed.]
						// bit 3 (HD Setting) is set to 1 for High Dynamic setting [Higher Bit Depth (HD Bit): A higher bit depth allows for a wider dynamic range, enabling the photodiode to capture a broader range of light intensities with greater precision. This is important in applications where the light levels vary significantly, as it ensures that both dim and bright signals can be accurately detected and quantified.]
						var integrationTimeCommandCode = null;
						switch(gpioUvSensor._integrationTimeMs){
							case 50:	integrationTimeCommandCode = 0b00001000;	break;
							case 100:	integrationTimeCommandCode = 0b00011000;	break;
							case 200:	integrationTimeCommandCode = 0b00101000;	break;
							case 400:	integrationTimeCommandCode = 0b00111000;	break;
							case 800:	integrationTimeCommandCode = 0b01001000;	break;
							default:
								reject('Bad _integrationTimeMs: ' + gpioUvSensor._integrationTimeMs);
						}
						// Configure the device...
						bus.writeByte(gpioUvSensor._busAddress, 0x00, 0b00000001) // Power off ("shut down")
						.then(bus.writeByte(gpioUvSensor._busAddress, 0x00, integrationTimeCommandCode)) // Power on, normal (continuous) mode, normal dynamic range
						.then(result => {
							gpioUvSensor._bus = bus;
							gpioUvSensor.exposure._tick.init(gpioUvSensor._integrationTimeMs);
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
	/** Because the i2c reading is promisified, data readings from get() are not exact to time of function call */
	get: function(){
		gpioUvSensor._logger.silly('gpioUvSensor.get()');
		// read data (read errors are reduced when there is less traffic on the i2c bus ie: less writes to the LCD means better uv read stability)
		// Uncalibrated UVA (peak sensitivity at 365 nm, in a range of about 350 nm to 375 nm)
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x07).then(word => {
			if(word >= 0)
				gpioUvSensor._sensorReadings.uva = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uva read error', err);
		});
		// Uncalibrated UVB (peak sensitivity at 330 nm, in a range of about 315 nm to 340 nm)
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x09).then(word => {
			if(word >= 0)
				gpioUvSensor._sensorReadings.uvb = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvb read error', err);
		});
		// UV compensation value 1 (peak sensitivity at about 450 nm) [information about the whole received light within the visible wavelength area, allows only visible noise to pass through]
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x0a).then(word => {
			if(word >= 0)
				gpioUvSensor._sensorReadings.uvcomp1 = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvcomp1 read error', err);
		});
		// UV compensation value 2 (peak sensitivity at about 510 nm) [strength of the infrared content within the received light, allows only infrared noise to pass through]
		gpioUvSensor._bus.readWord(gpioUvSensor._busAddress, 0x0b).then(word => {
			if(word >= 0)
				gpioUvSensor._sensorReadings.uvcomp2 = word;
		}).catch(err => {
			gpioUvSensor._logger.verbose('uvcomp2 read error', err);
		});
		// VIS and IR coefficients for a non-covered (i.e. open-air, non-diffused -> no glass or teflon filter) designs like the Adafruit breakout, as per the VEML6075 datasheet:
		var uva_a_coef = 2.22; // Default value for the UVA VIS coefficient ("a")
		var uva_b_coef = 1.33; // Default value for the UVA IR coefficient ("b")
		var uvb_c_coef = 2.95; // Default value for the UVB VIS coefficient ("c")
		var uvb_d_coef = 1.74; // Default value for the UVB IR coefficient ("d")
		var uva_resp = 0.001461; // UVA responsivity
		var uvb_resp = 0.002591; // UVB responsivity
		// correct responsivity for _integrationTimeMs (it is most likely that the default 50ms Integration Time was used to calculate the UVA & UVB responsivity)
		uva_resp = uva_resp / (gpioUvSensor._integrationTimeMs / 50);
		uvb_resp = uva_resp / (gpioUvSensor._integrationTimeMs / 50);
		// adusted uva/uvb (for light outside the UVa/UVb spectrums, UVcomp1 and UVcomp2 should be low under LEDs) [These gain calibration factors, α, β, γ, δ, correct the output ratios of each channel for the device under test (DUT) in reference to the golden sample under a solar simulator, such as the Newport LCS100.]
		var uvaAdjusted = Math.round(gpioUvSensor._sensorReadings.uva - (uva_a_coef * gpioUvSensor._sensorReadings.uvcomp1) - (uva_b_coef * gpioUvSensor._sensorReadings.uvcomp2));
		var uvbAdjusted = Math.round(gpioUvSensor._sensorReadings.uvb - (uvb_c_coef * gpioUvSensor._sensorReadings.uvcomp1) - (uvb_d_coef * gpioUvSensor._sensorReadings.uvcomp2));
		// uv index (if uvb is less than 10% of uva, it is likely the sensor is reading 365nm LEDs [overcast outside light readings indicated adjusted UVb is about 20% less than adjusted UVa])
		if(uvbAdjusted < uvaAdjusted / 10){
			var uvIndex = +(uvaAdjusted * uva_resp).toFixed(2);
		}else{
			var uvIndex = +(((uvaAdjusted * uva_resp) + (uvbAdjusted * uvb_resp)) / 2).toFixed(2);
		}
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
		// gpioUvSensor._logger.verbose(JSON.stringify({'readings': gpioUvSensor._sensorReadings, 'adjusted': data}));
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
				gpioUvSensor.exposure._data.uvIndex.index = data.uvIndex;
				gpioUvSensor.exposure._data.uvIndex.level = data.uvIndexLevel;
				gpioUvSensor.exposure._data.uvIndex.text = data.uvIndexText;
				// elapsed time
				gpioUvSensor.exposure._data.elapsedMs += gpioUvSensor.exposure._tick.intervalMs;
				gpioUvSensor.exposure._data.elapsedSec = Math.floor(gpioUvSensor.exposure._data.elapsedMs / 1000);
				gpioUvSensor.exposure._data.elapsedMin = Math.floor((gpioUvSensor.exposure._data.elapsedMs / 1000) / 60);
				// uva
				gpioUvSensor.exposure._data.uva.read = data.uva < 0 ? 0 : data.uva;
				gpioUvSensor.exposure._data.uva.readPerMin = Math.floor((gpioUvSensor.exposure._data.uva.read / gpioUvSensor._integrationTimeMs) * 1000 * 60);
				gpioUvSensor.exposure._data.uva.accumulated += gpioUvSensor.exposure._data.uva.read;
				// uvb
				gpioUvSensor.exposure._data.uvb.read = data.uvb < 0 ? 0 : data.uvb;
				gpioUvSensor.exposure._data.uvb.readPerMin = Math.floor((gpioUvSensor.exposure._data.uvb.read / gpioUvSensor._integrationTimeMs) * 1000 * 60);
				gpioUvSensor.exposure._data.uvb.accumulated += gpioUvSensor.exposure._data.uvb.read;
				gpioUvSensor.exposure._logDataToConsole();
			},
		},
		_logDataToConsole: function(){
			if(!gpioUvSensor._logReadingsToConsoleFlag)
				return;
			console.log(
				'elapMs'	.padStart(7),	gpioUvSensor.exposure._data.elapsedMs										.toString().padStart(7),
				'elapSec'	.padStart(8),	gpioUvSensor.exposure._data.elapsedSec										.toString().padStart(4),
				'elapMin'	.padStart(8),	gpioUvSensor.exposure._data.elapsedMin										.toString().padStart(2),
				'uvaRead'	.padStart(7),	(!gpioUvSensor._sensorReadings.uva ? 0 : gpioUvSensor._sensorReadings.uva)	.toString().padStart(7), // raw reading
				'uvaReadAd'	.padStart(10),	gpioUvSensor.exposure._data.uva.read										.toString().padStart(6), // adjusted
				'uvaPerMin'	.padStart(10),	gpioUvSensor.exposure._data.uva.readPerMin									.toString().padStart(8),
				'uvaAcum'	.padStart(9),	gpioUvSensor.exposure._data.uva.accumulated									.toString().padStart(8),
			);
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