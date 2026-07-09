require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error("Please provide an email: node makeAdmin.js <email>");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`User ${email} not found.`);
  } else {
    user.isAdmin = true;
    await user.save();
    console.log(`Successfully made ${email} an admin!`);
  }
  mongoose.disconnect();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
