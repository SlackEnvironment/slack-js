var Buffer = require("buffer/").Buffer;
var should = require("should");
var slack = require("../index.js");

describe("Slack JS", function () {

	it("should be ok", function () {
		(slack).should.be.ok;
	});

	it("should be object", function () {
		(slack).should.be.type("object");
	});

	it("should have properties", function () {
		var properties = ["transaction", "signature", "vote", "delegate", "crypto"];

		properties.forEach(function (property) {
			(slack).should.have.property(property);
		});
	});

});
