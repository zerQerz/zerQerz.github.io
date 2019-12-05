var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/recorder', function(req, res, next) {
  res.render('recorder');
});

module.exports = router;
