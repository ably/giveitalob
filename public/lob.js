var Lob = (function () { 'use strict';

    function create$1(prefix) {
        prefix = "[" + prefix + "]";
        var notices = [prefix];
        return {
            info: function () {
                var _ = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _[_i - 0] = arguments[_i];
                }
                var args = Array.prototype.slice.call(arguments);
                console.info.apply(console, notices.concat(args));
            },
            warn: function () {
                var _ = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    _[_i - 0] = arguments[_i];
                }
                var args = Array.prototype.slice.call(arguments);
                console.warn.apply(console, notices.concat(args));
            },
            // error: function(..._){
            //   var args = Array.prototype.slice.call(arguments);
            //   console.error.apply(console, notices.concat(args));
            // }
            error: function (e) { throw e; }
        };
    }
    var DefaultLogger = {
        info: function () {
            var a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                a[_i - 0] = arguments[_i];
            }
            null;
        },
        warn: function () {
            var a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                a[_i - 0] = arguments[_i];
            }
            null;
        },
        // error logging should be used for errors and in development these should be thrown
        error: function (e) { throw e; }
    };
    var NullLogger = {
        info: function () {
            var a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                a[_i - 0] = arguments[_i];
            }
            null;
        },
        warn: function () {
            var a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                a[_i - 0] = arguments[_i];
            }
            null;
        },
        error: function () {
            var a = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                a[_i - 0] = arguments[_i];
            }
            null;
        },
    };

    // Raise Error for circular calls
    function Dispatcher(handlers, world) {
        this.dispatch = function () {
            var args = arguments;
            handlers.forEach(function (handler) {
                try {
                    handler.apply({}, args);
                }
                catch (e) {
                    world.error(e);
                }
            });
            if (handlers.length == 0) {
                world.warn.apply(world, args);
            }
            else {
                world.info.apply(world, args);
            }
        };
        this.register = function (handler) {
            return new Dispatcher(handlers.concat(handler), world);
        };
    }
    ;
    function create$2(world) {
        if (world === void 0) { world = DefaultLogger; }
        return new Dispatcher([], world);
    }
    ;

    function create(filter, logger) {
        if (logger === void 0) { logger = NullLogger; }
        var action;
        var dispatcher = create$2(logger);
        action = function (minutiae) {
            var noDetailWithAction = arguments.length == 0;
            try {
                if (noDetailWithAction) {
                    dispatcher.dispatch();
                }
                else {
                    dispatcher.dispatch(filter(minutiae));
                }
            }
            catch (e) {
                logger.error(e);
            }
        };
        action.register = function (handler) {
            dispatcher = dispatcher.register(handler);
        };
        return action;
    }
    ;

    var FREEFALL_LIMIT = 4;
    var Reading = {
        freefall: function (reading) {
            var a = reading.acceleration;
            var magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
            return magnitude < FREEFALL_LIMIT;
        }
    };
    var DEFAULT = Object.freeze({
        currentFlightReadings: [],
        currentReading: null,
        flightRecords: []
    });
    function handleReset(_state) {
        if (_state === void 0) { _state = DEFAULT; }
        return DEFAULT;
    }
    ;
    function handleNewReading(reading, state) {
        if (state === void 0) { state = DEFAULT; }
        var flightRecords = state.flightRecords;
        var currentFlightReadings = state.currentFlightReadings;
        if (Reading.freefall(reading)) {
            currentFlightReadings = currentFlightReadings.concat(reading);
        }
        else if (currentFlightReadings[0]) {
            flightRecords = flightRecords.concat([currentFlightReadings]);
            currentFlightReadings = [];
        }
        return {
            currentFlightReadings: currentFlightReadings,
            currentReading: reading,
            flightRecords: flightRecords
        };
    }
    ;

    function StateStore(logger) {
        if (logger === void 0) { logger = DefaultLogger; }
        var state;
        var dispatcher = create$2(logger);
        function dispatch(store) {
            dispatcher.dispatch(store);
        }
        var store = {
            resetReadings: function () {
                state = handleReset(state);
                dispatch(store);
                return store;
            },
            newReading: function (reading) {
                state = handleNewReading(reading, state);
                dispatch(store);
                return store;
            },
            getState: function () {
                return state;
            },
            register: function (callback) {
                dispatcher = dispatcher.register(callback);
                dispatch(store);
                return store;
            }
        };
        store.resetReadings(); // DEBT untested effect
        return store;
    }

    // TODO currently untested
    function throttle(fn, threshhold, scope) {
        threshhold = threshhold || 250;
        var last, deferTimer;
        return function () {
            var context = scope || this;
            var now = Date.now(), args = arguments;
            if (last && now < last + threshhold) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
                    last = now;
                    fn.apply(context, args);
                }, threshhold);
            }
            else {
                last = now;
                fn.apply(context, args);
            }
        };
    }
    // TODO currently untested
    function round(precision) {
        return function (value) {
            return parseFloat(value.toFixed(precision));
        };
    }

    var DEVICEMOTION = "devicemotion";
    var THROTTLE_RATE = 100; function Accelerometer(actions) {
        function reportDeviceMotionEvent(deviceMotionEvent) {
            var raw = deviceMotionEvent.accelerationIncludingGravity;
            if (typeof raw.x === "number") {
                actions.newReading({ acceleration: { x: raw.x, y: raw.y, z: raw.z }, timestamp: Date.now() });
            }
            else {
                actions.badReading(raw);
            }
        }
        var throttledReport = throttle(reportDeviceMotionEvent, THROTTLE_RATE);
        return {
            start: function () {
                window.addEventListener(DEVICEMOTION, throttledReport);
            }
        };
    }

    // All code relating to manipulations requiring a document, element or window node.
    // DEBT untested
    function ready(fn) {
        if (document.readyState !== "loading") {
            fn();
        }
        else {
            document.addEventListener("DOMContentLoaded", fn);
        }
    }

    /**
     * Copyright 2014 Craig Campbell
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     *
     * GATOR.JS
     * Simple Event Delegation
     *
     * @version 1.2.4
     *
     * Compatible with IE 9+, FF 3.6+, Safari 5+, Chrome
     *
     * Include legacy.js for compatibility with older browsers
     *
     *             .-._   _ _ _ _ _ _ _ _
     *  .-''-.__.-'00  '-' ' ' ' ' ' ' ' '-.
     * '.___ '    .   .--_'-' '-' '-' _'-' '._
     *  V: V 'vv-'   '_   '.       .'  _..' '.'.
     *    '=.____.=_.--'   :_.__.__:_   '.   : :
     *            (((____.-'        '-.  /   : :
     *                              (((-'\ .' /
     *                            _____..'  .'
     *                           '-._____.-'
     */
    var _matcher;
    var _level = 0;
    var _id = 0;
    var _handlers = {};
    var _gatorInstances = {};
    function _addEvent(gator, type, callback) {
        // blur and focus do not bubble up but if you use event capturing
        // then you will get them
        var useCapture = type == 'blur' || type == 'focus';
        gator.element.addEventListener(type, callback, useCapture);
    }
    function _cancel(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    /**
     * returns function to use for determining if an element
     * matches a query selector
     *
     * @returns {Function}
     */
    function _getMatcher(element) {
        if (_matcher) {
            return _matcher;
        }
        if (element.matches) {
            _matcher = element.matches;
            return _matcher;
        }
        if (element.webkitMatchesSelector) {
            _matcher = element.webkitMatchesSelector;
            return _matcher;
        }
        if (element.mozMatchesSelector) {
            _matcher = element.mozMatchesSelector;
            return _matcher;
        }
        if (element.msMatchesSelector) {
            _matcher = element.msMatchesSelector;
            return _matcher;
        }
        if (element.oMatchesSelector) {
            _matcher = element.oMatchesSelector;
            return _matcher;
        }
        // if it doesn't match a native browser method
        // fall back to the gator function
        _matcher = Gator.matchesSelector;
        return _matcher;
    }
    /**
     * determines if the specified element matches a given selector
     *
     * @param {Node} element - the element to compare against the selector
     * @param {string} selector
     * @param {Node} boundElement - the element the listener was attached to
     * @returns {void|Node}
     */
    function _matchesSelector(element, selector, boundElement) {
        // no selector means this event was bound directly to this element
        if (selector == '_root') {
            return boundElement;
        }
        // if we have moved up to the element you bound the event to
        // then we have come too far
        if (element === boundElement) {
            return;
        }
        // if this is a match then we are done!
        if (_getMatcher(element).call(element, selector)) {
            return element;
        }
        // if this element did not match but has a parent we should try
        // going up the tree to see if any of the parent elements match
        // for example if you are looking for a click on an <a> tag but there
        // is a <span> inside of the a tag that it is the target,
        // it should still work
        if (element.parentNode) {
            _level++;
            return _matchesSelector(element.parentNode, selector, boundElement);
        }
    }
    function _addHandler(gator, event, selector, callback) {
        if (!_handlers[gator.id]) {
            _handlers[gator.id] = {};
        }
        if (!_handlers[gator.id][event]) {
            _handlers[gator.id][event] = {};
        }
        if (!_handlers[gator.id][event][selector]) {
            _handlers[gator.id][event][selector] = [];
        }
        _handlers[gator.id][event][selector].push(callback);
    }
    function _removeHandler(gator, event, selector, callback) {
        // if there are no events tied to this element at all
        // then don't do anything
        if (!_handlers[gator.id]) {
            return;
        }
        // if there is no event type specified then remove all events
        // example: Gator(element).off()
        if (!event) {
            for (var type in _handlers[gator.id]) {
                if (_handlers[gator.id].hasOwnProperty(type)) {
                    _handlers[gator.id][type] = {};
                }
            }
            return;
        }
        // if no callback or selector is specified remove all events of this type
        // example: Gator(element).off('click')
        if (!callback && !selector) {
            _handlers[gator.id][event] = {};
            return;
        }
        // if a selector is specified but no callback remove all events
        // for this selector
        // example: Gator(element).off('click', '.sub-element')
        if (!callback) {
            delete _handlers[gator.id][event][selector];
            return;
        }
        // if we have specified an event type, selector, and callback then we
        // need to make sure there are callbacks tied to this selector to
        // begin with.  if there aren't then we can stop here
        if (!_handlers[gator.id][event][selector]) {
            return;
        }
        // if there are then loop through all the callbacks and if we find
        // one that matches remove it from the array
        for (var i = 0; i < _handlers[gator.id][event][selector].length; i++) {
            if (_handlers[gator.id][event][selector][i] === callback) {
                _handlers[gator.id][event][selector].splice(i, 1);
                break;
            }
        }
    }
    function _handleEvent(id, e, type) {
        if (!_handlers[id][type]) {
            return;
        }
        var target = e.target || e.srcElement, selector, match, matches = {}, i = 0, j = 0;
        // find all events that match
        _level = 0;
        for (selector in _handlers[id][type]) {
            if (_handlers[id][type].hasOwnProperty(selector)) {
                match = _matchesSelector(target, selector, _gatorInstances[id].element);
                if (match && Gator.matchesEvent(type, _gatorInstances[id].element, match, selector == '_root', e)) {
                    _level++;
                    _handlers[id][type][selector].match = match;
                    matches[_level] = _handlers[id][type][selector];
                }
            }
        }
        // stopPropagation() fails to set cancelBubble to true in Webkit
        // @see http://code.google.com/p/chromium/issues/detail?id=162270
        e.stopPropagation = function () {
            e.cancelBubble = true;
        };
        for (i = 0; i <= _level; i++) {
            if (matches[i]) {
                for (j = 0; j < matches[i].length; j++) {
                    if (matches[i][j].call(matches[i].match, e) === false) {
                        Gator.cancel(e);
                        return;
                    }
                    if (e.cancelBubble) {
                        return;
                    }
                }
            }
        }
    }
    /**
     * binds the specified events to the element
     *
     * @param {string|Array} events
     * @param {string} selector
     * @param {Function} callback
     * @param {boolean=} remove
     * @returns {Object}
     */
    function _bind(events, selector, callback, remove) {
        // fail silently if you pass null or undefined as an alement
        // in the Gator constructor
        if (!this.element) {
            return;
        }
        if (!(events instanceof Array)) {
            events = [events];
        }
        if (!callback && typeof (selector) == 'function') {
            callback = selector;
            selector = '_root';
        }
        var id = this.id, i;
        function _getGlobalCallback(type) {
            return function (e) {
                _handleEvent(id, e, type);
            };
        }
        for (i = 0; i < events.length; i++) {
            if (remove) {
                _removeHandler(this, events[i], selector, callback);
                continue;
            }
            if (!_handlers[id] || !_handlers[id][events[i]]) {
                Gator.addEvent(this, events[i], _getGlobalCallback(events[i]));
            }
            _addHandler(this, events[i], selector, callback);
        }
        return this;
    }
    /**
     * Gator object constructor
     *
     * @param {Node} element
     */
    function Gator(element, id) {
        // called as function
        if (!(this instanceof Gator)) {
            // only keep one Gator instance per node to make sure that
            // we don't create a ton of new objects if you want to delegate
            // multiple events from the same node
            //
            // for example: Gator(document).on(...
            for (var key in _gatorInstances) {
                if (_gatorInstances[key].element === element) {
                    return _gatorInstances[key];
                }
            }
            _id++;
            _gatorInstances[_id] = new Gator(element, _id);
            return _gatorInstances[_id];
        }
        this.element = element;
        this.id = id;
    }
    /**
     * adds an event
     *
     * @param {string|Array} events
     * @param {string} selector
     * @param {Function} callback
     * @returns {Object}
     */
    Gator.prototype.on = function (events, selector, callback) {
        return _bind.call(this, events, selector, callback);
    };
    /**
     * removes an event
     *
     * @param {string|Array} events
     * @param {string} selector
     * @param {Function} callback
     * @returns {Object}
     */
    Gator.prototype.off = function (events, selector, callback) {
        return _bind.call(this, events, selector, callback, true);
    };
    Gator.matchesSelector = function () { };
    Gator.cancel = _cancel;
    Gator.addEvent = _addEvent;
    Gator.matchesEvent = function () {
        return true;
    };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Gator;
    }
    var Events = Gator;

    // Interfaces are where user interaction is transformed to domain interactions
    // There is only one interface in this application, this one the avionics interface
    // It can therefore be set up to run on the document element
    var AvionicsInterface = (function () {
        function AvionicsInterface($root, app) {
            this.$root = $root;
            this.app = app;
            var events = Events($root, null);
            events.on("click", "[data-command~=reset]", function (evt) {
                app.resetReadings();
            });
        }
        return AvionicsInterface;
    })();
    function create$3($root, app) {
        return new AvionicsInterface($root, app);
    }
    // export default AvionicsInterface

    function readingsDuration(readings) {
        if (!readings[0]) {
            return 0;
        }
        var last = readings.length;
        var t0 = readings[0].timestamp;
        var t1 = readings[last - 1].timestamp;
        // DEBT Magic number that make sense when sample rate is every 250ms
        return (t1 + 250 - t0) / 1000;
    }
    function altitudeForFreefallDuration(duration) {
        // Altitude Calculation
        // SUVAT
        // s = vt - 0.5 * a * t^2
        // input
        // s = s <- desired result
        // u = ? <- not needed
        // v = 0 <- stationary at top
        // a = - 9.81 <- local g
        // t = flightTime/2 time to top of arc
        // s = 9.81 * 1/8 t^2
        var t = duration;
        return round(2)(9.81 / 8 * t * t);
    }
    function format(i) {
        var padding = "00000";
        var str = i.toFixed(2);
        return padding.substring(0, padding.length - str.length) + str;
    }
    function create$5(state) {
        return Object.create({}, {
            maxFlightTime: {
                get: function () {
                    var flights = state.flightRecords.concat([state.currentFlightReadings]);
                    var flightDurations = flights.map(readingsDuration);
                    return Math.max.apply(null, flightDurations);
                }
            },
            maxAltitude: {
                get: function () {
                    var flightDurations = state.flightRecords.map(readingsDuration);
                    var max = Math.max.apply(null, [0].concat(flightDurations));
                    return altitudeForFreefallDuration(max);
                }
            },
            currentReading: {
                get: function () {
                    if (!state.currentReading) {
                        return "Waiting.";
                    }
                    ;
                    var acceleration = state.currentReading.acceleration;
                    var x = acceleration.x;
                    var y = acceleration.y;
                    var z = acceleration.z;
                    return "[" + [format(x), format(y), format(z)].join(", ") + "]";
                }
            }
        });
    }

    function Display($root) {
        var $flightTime = $root.querySelector("[data-hook~=flight-time]");
        var $maxAltitude = $root.querySelector("[data-hook~=max-altitude]");
        var $currentReading = $root.querySelector("[data-hook~=current-reading]");
        function render(presentation) {
            $flightTime.innerHTML = presentation.maxFlightTime + "s";
            $maxAltitude.innerHTML = presentation.maxAltitude + "m";
            $currentReading.innerHTML = presentation.currentReading;
        }
        ;
        return {
            update: function (store) {
                var state = store.getState();
                var presenter = create$5(state);
                render(presenter);
            }
        };
    }

    function Avionics($root, world) {
        if ($root == void 0) {
            return;
        } // Use double equal comparison to catch null and undefined;
        world.getAccelerometer().start();
        var ui = create$3($root, world.actions);
        var display = Display($root);
        world.store.register(display.update);
        return {
            display: display,
            ui: ui
        };
    }
    ;

    function Controller($root, app) {
        var events = Events($root, null);
        events.on("click", function (evt) {
            app.closeNotice();
        });
    }

    function View($root) {
        var $display = $root.querySelector("[data-display~=notice]");
        return {
            update: function (store) {
                var message = store.getState();
                if (message) {
                    $display.innerHTML = message;
                    $root.classList.add("active");
                }
                else {
                    $root.classList.remove("active");
                }
            }
        };
    }

    function Component($root, world) {
        if ($root == void 0) {
            return;
        } // Use double equal comparison to catch null and undefined;
        var controller = Controller($root, world.actions);
        var display = View($root);
        world.noticeStore.register(display.update);
    }

    console.log("Starting boot ...");
    var actions = {
        newReading: create(function (a) { return a; }, create$1("New Reading")),
        resetReadings: create(function () { null; }, create$1("Reset")),
        submitFlightLog: create(function () { null; }, create$1("Submit Flight log")),
        failedConnection: create(function (reason) { return reason; }, create$1("Failed Connection")),
        badReading: create(function (reading) { return reading; }, create$1("Bad Reading")),
        closeNotice: create(function (reading) { return reading; }, create$1("Notice Closed")),
    };
    var store = StateStore();
    actions.resetReadings.register(store.resetReadings);
    actions.newReading.register(store.newReading);
    var accelerometer = Accelerometer(actions);
    function NoticeStore(logger) {
        if (logger === void 0) { logger = DefaultLogger; }
        var BAD_READING = "Could not read the data from this device. Please try again on a mobile with working accelerometer.";
        var state, store;
        var dispatcher = create$2(logger);
        function dispatch(store) {
            dispatcher.dispatch(store);
        }
        function notify(message) {
            state = message;
            dispatch(store);
        }
        function closeNotice() {
            state = null;
            dispatch(store);
        }
        store = {
            badReading: notify.bind({}, BAD_READING),
            closeNotice: closeNotice,
            getState: function () {
                return state;
            },
            register: function (callback) {
                dispatcher = dispatcher.register(callback);
                dispatch(store);
                return store;
            }
        };
        store.closeNotice();
        return store;
    }
    var noticeStore = NoticeStore();
    actions.badReading.register(noticeStore.badReading);
    actions.closeNotice.register(noticeStore.closeNotice);
    var App = {
        actions: actions,
        store: store,
        noticeStore: noticeStore,
        getAccelerometer: function () {
            return accelerometer;
        }
    };
    ready(function () {
        var $avionics = document.querySelector("[data-interface~=avionics]");
        var avionics = Avionics($avionics, App);
        var $notice = document.querySelector("[data-component~=notice]");
        var notice = Component($notice, App);
    });

    return App;

})();
//# sourceMappingURL=lob.js.map