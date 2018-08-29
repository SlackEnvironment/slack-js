var Buffer = require("buffer/").Buffer;
var should = require("should");
var slack = require("../../index.js");

describe("slots.js", function () {

  var slots = require("../../lib/time/slots.js");

  it("should be ok", function () {
    (slots).should.be.ok;
  });

  it("should be object", function () {
    (slots).should.be.type("object");
  });

  it("should have properties", function () {
    var properties = ["interval", "delegates", "getTime", "getRealTime", "getSlotNumber", "getSlotTime", "getNextSlot", "getLastSlot"];
    properties.forEach(function (property) {
      (slots).should.have.property(property);
    });
  });

  describe(".interval", function () {
    var interval = slots.interval;

    it("should be ok", function () {
      (interval).should.be.ok;
    });

    it("should be number and not NaN", function () {
      (interval).should.be.type("number").and.not.NaN;
    });
  });

  describe(".delegates", function () {
    var delegates = slots.delegates;

    it("should be ok", function () {
      (delegates).should.be.ok;
    });

    it("should be number and not NaN", function () {
      (delegates).should.be.type("number").and.not.NaN;
    });
  });

  describe("#getTime", function () {
    var getTime = slots.getTime;

    it("should be ok", function () {
      (getTime).should.be.ok;
    });

    it("should be a function", function () {
      (getTime).should.be.type("function");
    });

    it("should return epoch time as number, equal to 10", function () {
      var d = 1490101210000;
      var time = getTime(d);
      (time).should.be.type("number").and.equal(10);
    });
  });

  describe("#getRealTime", function () {
    var getRealTime = slots.getRealTime;

    it("should be ok", function () {
      (getRealTime).should.be.ok;
    });

    it("should be a function", function () {
      (getRealTime).should.be.type("function");
    });

    it("should return return real time, convert 10 to 1490101210000", function () {
      var d = 10;
      var real = getRealTime(d);
      (real).should.be.ok;
      (real).should.be.type("number").and.equal(1490101210000);
    });
  });

  describe("#getSlotNumber", function () {
    var getSlotNumber = slots.getSlotNumber;

    it("should be ok", function () {
      (getSlotNumber).should.be.ok;
    });

    it("should be a function", function () {
      (getSlotNumber).should.be.type("function");
    });

    it("should return slot number, equal to 1", function () {
      var slot = getSlotNumber(10);
      (slot).should.be.type("number").and.equal(1);
    });
  });

  describe("#getSlotTime", function () {
    var getSlotTime = slots.getSlotTime;

    it("should be ok", function () {
      (getSlotTime).should.be.ok;
    });

    it("should be function", function () {
      (getSlotTime).should.be.type("function");
    });

    it("should return slot time number, equal to ", function () {
      var slotTime = getSlotTime(19614);
      (slotTime).should.be.ok;
      (slotTime).should.be.type("number").and.equal(156912);
    });
  });

  describe("#getNextSlot", function () {
    var getNextSlot = slots.getNextSlot;

    it("should be ok", function () {
      (getNextSlot).should.be.ok;
    });

    it("should be function", function () {
      (getNextSlot).should.be.type("function");
    });

    it("should return next slot number", function () {
      var nextSlot = getNextSlot();
      (nextSlot).should.be.ok;
      (nextSlot).should.be.type("number").and.not.NaN;
    });
  });

  describe("#getLastSlot", function () {
    var getLastSlot = slots.getLastSlot;

    it("should be ok", function () {
      (getLastSlot).should.be.ok;
    });

    it("should be function", function () {
      (getLastSlot).should.be.type("function");
    });

    it("should return last slot number", function () {
      var lastSlot = getLastSlot(slots.getNextSlot());
      (lastSlot).should.be.ok;
      (lastSlot).should.be.type("number").and.not.NaN;
    });
  });

});
