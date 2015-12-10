/* jshint esnext: true */

import { freefallReading, stationaryReading } from "../support";
import Presenter from "../../client/avionics/presenter";

describe("Avionics Presenter", function(){
  describe("of refreshed app", function (){
    var appState = {
      currentReading: null,
      currentFlight: [],
      flightHistory: []
    };
    var presenter = Presenter(appState);

    it("should have a maxFlightTime of 0", function(){
      expect(presenter.maxFlightTime).toBe("0.00 s");
    });
    it("should have a maxAltitude of 0", function(){
      expect(presenter.maxAltitude).toBe("0.00 m");
    });
    it("should have a current Reading of waiting", function(){
      expect(presenter.currentReadout).toEqual("Waiting.");
    });
  });

  describe("of app early flight state", function(){
    var reading = freefallReading(1000);
    var appState = {
      currentFlight: [reading],
      flightHistory: [],
      currentReading: reading
    };
    var presenter = Presenter(appState);

    it("should have a maxFlightTime of .250", function(){
      expect(presenter.maxFlightTime).toBe("0.25 s");
    });
    it("should have a maxAltitude of 0", function(){
      expect(presenter.maxAltitude).toBe("0.00 m");
    });
    it("should have a current Reading of with details", function(){
      expect(presenter.currentReadout).toEqual("[+00.00,  +00.00, -01.00]");
    });
  });
  // describe("in mid flight state", function(){
  //   var state = {
  //     currentFlightReadings: [freefallReading(100), freefallReading(200)],
  //     flightRecords: [],
  //     currentReading: null
  //   };
  //   var presenter = AvionicsPresenter.create(state);
  //   it("should have a maxFlightTime of .250", function(){
  //     expect(presenter.maxFlightTime).toBe(0.350);
  //   });
  //   it("should have a maxAltitude of 0", function(){
  //     expect(presenter.maxAltitude).toBe(0);
  //   });
  // });
  // describe("after flight state", function(){
  //   var state = {
  //     currentFlightReadings: [],
  //     currentReading: null,
  //     flightRecords: [
  //       [freefallReading(100), freefallReading(200)],
  //       [freefallReading(100), freefallReading(300)],
  //       [freefallReading(100), freefallReading(200)]
  //     ]
  //   };
  //   var presenter = AvionicsPresenter.create(state);
  //   it("should have a maxFlightTime of .450", function(){
  //     expect(presenter.maxFlightTime).toBe(0.450);
  //   });
  //   it("should have a maxAltitude of 0", function(){
  //     expect(presenter.maxAltitude).not.toBe(0);
  //   });
  // });
});
