import Presenter from "./view/presenter";
import Display from "./view/display";
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

  this.render = function(projection) {
    var presentation = Presenter(projection);
    var display = getDisplay();

    display.render(presentation);
  }
}
