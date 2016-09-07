/*jslint node:true,vars:true,bitwise:true,unparam:true */

/*jshint unused:true */

/*
The Local Temperature Node.js sample application distributed within Intel® XDK IoT Edition under the IoT with Node.js Projects project creation option showcases how to read analog data from a Grover Starter Kit Plus – IoT Intel® Edition Temperature Sensor, start a web server and communicate wirelessly using WebSockets.

MRAA - Low Level Skeleton Library for Communication on GNU/Linux platforms
Library in C/C++ to interface with Galileo & other Intel platforms, in a structured and sane API with port nanmes/numbering that match boards & with bindings to javascript & python.

Steps for installing MRAA & UPM Library on Intel IoT Platform with IoTDevKit Linux* image
Using a ssh client: 
1. echo "src maa-upm http://iotdk.intel.com/repos/1.1/intelgalactic" > /etc/opkg/intel-iotdk.conf
2. opkg update
3. opkg upgrade

Article: https://software.intel.com/en-us/html5/articles/iot-local-temperature-nodejs-and-html5-samples
*/

var B = 4275;
var mraa = require("mraa");
var http = require('http');
var express = require('express');
var app = express();

//GROVE Kit A0 Connector --> Aio(0)
var myAnalogPin = new mraa.Aio(0);

//Load i2clcd module
var LCD = require('jsupm_i2clcd');
//Initialize Jhd1313m1 at 0x62 (RGB_ADDRESS) and 0x3E (LCD_ADDRESS) 
var myLcd = new LCD.Jhd1313m1 (0, 0x3E, 0x62);
myLcd.setColor(34, 2, 55);

var a;
var resistance;
var celsius_temperature;
var fahrenheit_temperature;

// Schedule for when I'm home (isOpen() == true)
// Source: https://github.com/scryptmouse/weekly-schedule
var WeeklySchedule = require('./js/schedule.js');
var json_schedule = require('./js/schedule.json');
var schedule = new WeeklySchedule(json_schedule);
// testing
console.log("Currently open: " + schedule.isOpen());
console.log(schedule.toString());

// Automation of cooler when too hot or too cold during scheduled times
setInterval(function () {
    if (schedule.isOpen()) {
        if (fahrenheit_temperature > 78.0) toggleCooler("on");
        else if (fahrenheit_temperature < 73.0) toggleCooler("off");
    }
}, 300000);

function toggleCooler(trigger_event) {
    if (trigger_event == "on") event = "temp_hot";
    else if (trigger_event == "off") event = "temp_cold";
    
    var options = {
      host: 'maker.ifttt.com',
      path: '/trigger/' + event + '/with/key/bhi14KFMBspkb5hqz9P9Y9'
    };

    callback = function(response) {
      var str = '';

      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function (chunk) {
        str += chunk;
      });

      //the whole response has been recieved, so we just print it out here
      response.on('end', function () {
        console.log(str);
      });
    }
    http.request(options, callback).end();
}

// Check temperature and display to LCD 
setInterval(function () {
    a = myAnalogPin.read();
//    console.log("Analog Pin (A0) Output: " + a);
    //Shifting bits to get value between 0 to 1023 (10 bits)
    if (a > 1024) {
        a = a >> 2; //Shift 'a' right two bits
    }
    //console.log("Checking....");

    resistance = (1023 - a) * 100000 / a; //get the resistance of the sensor;
    //console.log("Resistance: "+resistance);
    celsius_temperature = 1 / (Math.log(resistance / 100000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
    //console.log("Celsius Temperature "+celsius_temperature); 
    fahrenheit_temperature = (celsius_temperature * (9 / 5)) + 32;
    myLcd.setCursor(0,0);
    myLcd.write('Temp (F/C):');
    myLcd.setCursor(1,0);
    myLcd.write(fahrenheit_temperature.toFixed(1) + 'F | ' + celsius_temperature.toFixed(1) + 'C');
    console.log(fahrenheit_temperature.toFixed(1) + 'F | ' + celsius_temperature.toFixed(1) + 'C');
}, 500);

/*
Function: startSensorWatch(socket)
Parameters: socket - client communication channel
Description: Read Temperature Sensor and send temperature in degrees of Fahrenheit to socket server
*/
function startSensorWatch(socket) {
    'use strict';
    setInterval(function () {
        // saving CPU cycles by not repeating calculations already done above
//        a = myAnalogPin.read();
////        console.log("Analog Pin (A0) Output: " + a);
//        //Shifting bits to get value between 0 to 1023 (10 bits)
//        if (a > 1024) {
//            a = a >> 2; //Shift 'a' right two bits
//        }
//        //console.log("Checking....");
//        
//        var resistance = (1023 - a) * 100000 / a; //get the resistance of the sensor;
//        //console.log("Resistance: "+resistance);
//        var celsius_temperature = 1 / (Math.log(resistance / 100000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
////        console.log("Celsius Temperature "+celsius_temperature); 
//        var fahrenheit_temperature = (celsius_temperature * (9 / 5)) + 32;
//        console.log("Fahrenheit Temperature: " + fahrenheit_temperature);
        socket.emit("message", fahrenheit_temperature);
    }, 500);
}

console.log("Sample Reading Grove Kit Temperature Sensor");

//Create Socket.io server
var server = http.Server(app);
var io = require('socket.io')(server);

//Attach a 'connection' event handler to the server
io.on('connection', function (socket) {
    'use strict';
    console.log('a user connected');
    //Emits an event along with a message
    socket.emit('connected', 'Welcome');

    //Start watching Sensors connected to Edison board
    startSensorWatch(socket);

    //Attach a 'disconnect' event handler to the socket
    socket.on('disconnect', function () {
        console.log('user disconnected');
    });
});

app.use(express.static(__dirname+'/www/'));

app.get('/', function(req, res) {
    res.sendFile("/home/root/.node_app_slot/www/index.html");
});

server.listen(3000, function() {
    console.log('EdisonTemperature listening on port 3000');
});