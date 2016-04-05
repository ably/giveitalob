/* jshint esnext: true */
import "./utils/polyfill";
import Flyer from "./flyer";
import Router from "./router";
import FlyerView from "./flyer/view";
import FlyerUplink from './flyer/uplink';

var router = Router(window.location);

var uplink = FlyerUplink({
  channelName: router.state.channelName
}, window.console);

var flyer = Flyer();

flyer.logger = window.console;
flyer.view = new FlyerView
flyer.uplink = uplink;

function AccelerometerController(global, flyer){
  var gn = new GyroNorm();
  var logger = function(data) {
    console.warn("Gyro log:", data);
  }
  gn.init({ frequency: 10, decimalCounts: 3, logger: logger }).then(function() {
    gn.start(function(data) {
      flyer.newReading(data);
    });
  }).catch(function(e) {
    /* DeviceOrientation or DeviceMotion is not supported by the browser or device */
    flyer.accelerometerNotSupported();
  });
}

var accelerometerController = new AccelerometerController(window, flyer);

function UplinkController(uplink, application){
  uplink.onconnected = function(){
    application.uplinkAvailable({ channelName: uplink.channelName });
  }
  uplink.onconnectionFailed = function(){
    application.uplinkFailed();
  }
  uplink.onconnectionDisconnected = function(){
    application.uplinkDisconnected({ channelName: uplink.channelName });
  }
}
var uplinkController = new UplinkController(uplink, flyer);
export default flyer;
