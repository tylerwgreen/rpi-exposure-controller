# rpi_exposure_controller

## Dependencies

### Operating System

[DietPi](https://dietpi.com/)

#### Additional Software

OpenSSH Client: Feature-rich SSH, SFTP and SCP client
Node.js: JavaScript runtime environment
Build-Essential: GNU C/C++ compiler, development libraries and headers
Git: Clone and manage Git repositories locally
Vim-Tiny: compact release of vim
DietPi-RAMlog: Makes /var/log a RAM disk, preserves file structure on reboot
OpenSSH Server: Feature-rich SSH server with SFTP and SCP support
Python 3: Runtime system, pip package installer and development headers

#### DietPi config
DietPi auto update uses a lot of CPU on boot, this caused poor performance on the Raspberry Pi Zero
```
/boot/dietpi.txt
```
```
CONFIG_CHECK_DIETPI_UPDATES=0
CONFIG_CHECK_APT_UPDATES=0
```

#####Advanced Options
```dietpi-config```
I2C Frequency:	10kHz

## pigpio

```
shell
pigpiod -v
sudo apt-get update
sudo apt-get install pigpio
```

## gpio

### TL;DR

This is a 3.3V device.
Using 5V peripherals requires a [logic level converter](https://www.adafruit.com/product/757).

### Output

Maximum total of all pins 50 mA.
Default 8 mA max per pin. (Returns to this configuration after reset.)
Software configurable from 2 mA to 16 mA. Do not source or sink more than what you've configured.
Don't drive capacitive loads.

### Input

Threshold of 1.8V
Maximum 0.5 mA
Use a 6Kohm resistor to ensure that current from a 3.3V source cannot exceed 0.5 mA
( 3.3V / 6000Ω = .00055A )

## crontab
```
0 1 * * * sudo bash ~/rpi-exposure-controller/shell/cron.sh
```

## autostart
```
/var/lib/dietpi/dietpi-autostart/custom.sh
```
```
~/rpi-exposure-controller/shell/autostart.sh
exit 0
```

## UV Measurements taken with VEML6074
Uvindex | uvaread | uvbread | uvarpm | uvbrpm
--- | --- | --- | --- | ---
4 | 2400 | 1760 | 575000 | 424000
3 | 2090 | 1080 | 495000 | 244000
2 | 1780 | 0500 | 420000 | 121000
1 | 1100 | 0190 | 260000 | 039000

## Wiring / Hardware
![Breadboard](https://github.com/tylerwgreen/rpi-exposure-controller/blob/production/schematics/breadboard.png)
![Schematic](https://github.com/tylerwgreen/rpi-exposure-controller/blob/production/schematics/schematic.png)
