import Presenter from "./view/presenter";
import Display from "./view/display";
import AlertDisplay from "../alert/display";
import Phone from "../lib/phone";
import Guage from "../lib/guage";

import { Config } from '../config';
import { throttle } from "../utils/fn";

export default function FlyerView() {
  var memoized = {};

  var getDisplay = function() {
    if (!memoized.display) {
      var $flyer = $('.flyer');
      memoized.display = new Display($flyer);
    }
    return memoized.display;
  }

  var getAlertDisplay = function() {
    if (!memoized.alertDisplay) {
      memoized.alertDisplay = AlertDisplay();
    }
    return memoized.alertDisplay;
  }

  var getPhone = function() {
    if (!memoized.phone) {
      memoized.phone = new Phone();
    }
    return memoized.phone;
  }

  var getGuage = function() {
    if (!memoized.guage) {
      memoized.guage = new Guage();
    }
    return memoized.guage;
  }

  var renderPhoneMovement = function(reading) {
    getGuage().setMomentum(reading);
  }

  var renderPhoneOrientation = function(position) {
    getPhone().setOrientation(position);
  }

  this.render = function(projection) {
    var presentation = Presenter(projection);
    var display = getDisplay();
    var alertDisplay = getAlertDisplay();

    display.render(presentation);

    var alertMessage = projection.alert;
    if (alertMessage) {
      alertDisplay.message = alertMessage;
      alertDisplay.active = true;
    } else {
      alertDisplay.active = false;
    }
  }

  this.renderPhoneMovement = throttle(renderPhoneMovement.bind(this), Config.readingPublishLimit);
  this.renderPhoneOrientation = throttle(renderPhoneOrientation.bind(this), Config.readingPublishLimit);
}
