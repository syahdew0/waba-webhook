const express = require("express");

module.exports = function rawBody() {
  return express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  });
};
