const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const BusinessPartner = require("../models/BusinessPartner");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;

        // Find user by Google ID
        let user = await BusinessPartner.findOne({ 
          where: { google_id: googleId } 
        });

        if (!user && email) {
          // Find user by Email if not found by Google ID
          user = await BusinessPartner.findOne({ 
            where: { user_ad: email } 
          });
          
          if (user) {
            user.google_id = googleId;
            await user.save();
          }
        }

        if (!user) {
          // Explicitly reject unrecognized users
          return done(null, false, { message: "No account associated with this Google account." });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
