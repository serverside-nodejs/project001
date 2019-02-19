const express = require('express');
const { check , body } = require('express-validator/check');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login', 
check('email').isEmail().withMessage('Pleae enter a valid email.').normalizeEmail(),
body(
	'password', 
	'Please enter a password with only numbers and text at least 5 characters'
)
.isLength({min: 5}).trim(),
authController.postLogin);

router.post('/signup', 
   [
		check('email')
		.isEmail()
		.withMessage('Pleae enter a valid email.')
		.custom((value, {req}) => {
			// if(value === 'test@gmail.com') {
			// 		throw new Error('This email is forbidden.');
			// }
			// return true;
			console.log(" value customs" + value);
			return User.findOne({email: value})
			.then(userDoc => {
				if(userDoc) {
					return Promise.reject('E-Mail, exisitng, please pick a different one.');
				}
			});
		}).normalizeEmail(),
		body(
			'password', 
			'Please enter a password with only numbers and text at least 5 characters'
		)
		.isLength({min: 5})
		.isAlphanumeric(),
		body('confirmPassword').trim()
		.custom((value, {req}) => {
			if(value !== req.body.password) {
				throw new Error('Passwords have to match!');
			}
			return true;
		}).trim()
   ], 
    authController.postSignup);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;