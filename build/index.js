var Resource, Sleep,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Resource = require('./resource');

module.exports = Sleep = (function(_super) {
  __extends(Sleep, _super);

  function Sleep() {
    return Sleep.__super__.constructor.apply(this, arguments);
  }

  return Sleep;

})(Resource);
