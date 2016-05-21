import Presenter from "./view/presenter";
import Display from "./view/display";
import AlertDisplay from "../alert/display";
import Phone from "../lib/phone";

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
}
