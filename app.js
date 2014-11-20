var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
//var db = require('mongojs').connect('sockets', ['users']);

var routes = require('./routes/index');
var users = require('./routes/users');

//#region Server Config

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

var server = app.listen(3000, function () {
	console.log("Listening on 3000");
});

module.exports = server;

//#endregion

//#region Sockets

var io = require('socket.io')(server);

io.on('connection', function (socket) {

	console.log('user connected: ' + socket.handshake.address);

	// Authorisation event
	socket.on('authorise', function (authData) {

		var user = authData.Username;
		var host = socket.handshake.address;

		console.log(user + " - " + host);
		
		if (Users[user]) {

			socket.emit("login response", { Success: false, Message: "User exists" });

			return;
		}

		Users[user] = { Host: host, Socket: socket };

		var allUsers = Object.keys(Users);

		socket.emit("login response", { Success: true, Username: user, Users: allUsers });

		socket.broadcast.emit("user connected", { Username: user, Users: allUsers });
	});

	// Broadcast message event
	socket.on('message broadcast', function (msg) {

		var host = socket.handshake.address;

		console.log(msg.Username + "(" + host + "): " + msg.Message);

		if (!Users[msg.Username])
			return;

		if (host == Users[msg.Username].Host) {
			io.emit('message broadcast', msg);
		}
	});

	// Private message event
	socket.on('message private', function (msg) {

		var from = msg.From;
		var to = msg.To;
		var text = msg.Text;

		if (!Users[to])
			socket.emit('message failed', { Message: "Could not find user" });

		Users[to].Socket.emit('message private', msg);

		//console.log(msg);
	});

	// User disconnected event
	socket.on('disconnect', function () {

		for (var u in Users)
			if (Users[u].Socket == socket) {

				delete Users[u];

				var allUsers = Object.keys(Users);

				io.emit("user disconnected", { Username: u, Users: allUsers });

				console.log(u + ' disconnected');
			} else {
				console.log('user disconnected');
			}
	});
});

var Users = {};

//#endregion

//#region Helpers

var crypto = require('crypto');

var Encryption = {
	GetEncryptedString: function (str) {

		var hmac = crypto.createHmac("sha1", 'auth secret');

		hmac.update(str);

		return hmac.digest("hex");
	}
}

//#endregion