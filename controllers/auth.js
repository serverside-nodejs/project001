const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');

const transporter = nodemailer.createTransport(sendgridTransport({
	auth: {
		api_key:'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'
	}
}));


exports.getLogin = (req, res, next) => {
	let message = req.flash('error');
	if(message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}
  res.render('auth/login', {
    path: '/login',
		pageTitle: 'Login',
		errorMessage: message,
		oldInput: {
			email: '',
			password: ''
		},
		validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
	let message = req.flash('error');
	if(message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}
	res.render('auth/signup', {
		path: '/signup',
		pageTitle: 'Signup',
		errorMessage: message,
		oldInput: {
			email: '',
			password: '',
			confirmPassword: ''
		},
		validationErrors: []
	});
};

exports.postLogin = (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	const error = validationResult(req);
	console.log(error.array());
	if(!error.isEmpty()) {
		return res.status(422).render('auth/login', {
			path: '/login',
			pageTitle: 'Login',
			errorMessage: error.array()[0].msg,
			oldInput: {
				email: email,
				password: password
			},
			validationErrors: error.array()
		});
	}
  	User.findOne({email: email})
    .then(user => {
		if(!user) {
			return res.status(422).render('auth/login', {
				path: '/login',
				pageTitle: 'Login',
				errorMessage: 'Invalid email or password.',
				oldInput: {
					email: email,
					password: password
				},
				validationErrors: []
			});
		}

		bcrypt
		.compare(password, user.password)
		.then(doMatch => {
			if(doMatch) {
				req.session.isLoggedIn = true;
				req.session.user = user;
				return req.session.save(err => {
					console.log(err);
					 res.redirect('/');
				});
			}
			return res.status(422).render('auth/login', {
				path: '/login',
				pageTitle: 'Login',
				errorMessage: 'Invalid email or password.',
				oldInput: {
					email: email,
					password: password
				},
				validationErrors: error.array()
			});
		}).catch(error => {
			console.log(error);
			
		})
    })
    .catch(err => {
		const error = new Error(err);
		error.httpStatusCode = 500;
		return next(error);
	});
};

exports.postSignup = (req, res, next) => {
  	const email = req.body.email;
	const password = req.body.password;
	const confirmPassword = req.body.password;
	const error = validationResult(req);
	if(!error.isEmpty()) {
		console.log(error.array());
		return res.status(422).render('auth/signup', {
			path: '/signup',
			pageTitle: 'Signup',
			errorMessage: error.array()[0].msg,
			oldInput: {
				email: email,
				password: password,
				confirmPassword: confirmPassword
			},
			validationErrors: error.array()
		});
	}
	
	bcrypt.hash(password, 12)
	.then(hashPassword => {
		const user = new User({
			email: email, 
			password: hashPassword,
			cart: {items: []}
		});
		return user.save();
	})
	.then(result => {
		res.redirect('/login');
		return transporter.sendMail({
			to: email,
			from: 'seyha@node.completed.com',
			subject: 'Signup Succeeded!',
			html: '<h1>You successfully sign up!</h1>'
		});
	}).catch(error => {
		console.log(error);
	});
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
	let message = req.flash('error');
	if(message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}
  res.render('auth/reset', {
    path: '/reset',
		pageTitle: 'Reset Password',
		errorMessage: message
  });
};

exports.postReset = (req, res, next) => {
	crypto.randomBytes(32, (err, buffer) => {
		if(err) {
			return res.redirect('/reset');
		}
		const token = buffer.toString('hex');
		User.findOne({email: req.body.email})
		.then(user => {
			if(!user) {
				req.flash('error', 'No Account with this email.');
				return res.redirect('/reset');
			}
			user.resetToken = token;
			user.resetTokenExpiration = Date.now() + 3600000;
			return user.save();
		})
		.then(result => {
			res.redirect('/');
			transporter.sendMail({
				to: req.body.email,
				from: 'seyha@node.completed.com',
				subject: 'Reset Password',
				html: `
					<p> You requested a password reset.</p>
					<p>
						Click this <a href="http:localhost:3000/reset/${token}">link</a> to reset a new password.
					</p>
				`
			});
		})
		.catch(err => {
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		 });
	});
};

exports.getNewPassword = (req, res, next) => {
	const token = req.params.token;
	User.findOne({resetToken: token, resetTokenExpiration: {$gt: Date.now() }})
	.then(user => {
		let message = req.flash('error');
		if(message.length > 0) {
			message = message[0];
		} else {
			message = null;
		}
		res.render('auth/new-password', {
			path: '/new-password',
			pageTitle: 'Reset Password',
			errorMessage: message,
			userId: user._id.toString(),
			passwordToken: token
		});
	});
};

exports.postNewPassword = (req, res, next) => {
	const newPassword = req.body.password;
	const userId = req.body.userId;
	const passwordToken = req.body.passwordToken;
	let resetUser;
	User.findOne({
		resetToken: passwordToken, 
		resetTokenExpiration: {$gt: Date.now() },
		_id: userId
	})
	.then(user => {
		resetUser = user;
		return bcrypt.hash(newPassword, 12);
	})
	.then(hashPassword => {
		resetUser.password = hashPassword
		resetUser.resetToken = undefined;
		resetUser.resetTokenExpiration = undefined;
		return resetUser.save();
	})
	.then(result => {
		res.redirect('/login');
	})
	.catch(err => {
		const error = new Error(err);
		error.httpStatusCode = 500;
		return next(error);
    });

};