require("dotenv").config()

// server
const express = require('express')
const ejs = require('ejs')

// db
const mongoose = require('mongoose');
const dbName = "lostDB"

// files
const multer = require('multer');
const fs = require("fs")

// auth
const passport = require('passport');  
const GoogleStrategy = require('passport-google-oauth20').Strategy;  
// session
const session = require('express-session');
const MongoStore = require('connect-mongo');


mongoose.connect((process.env.MONGO ||"mongodb://localhost:27017/") + dbName, {useNewUrlParser: true, useUnifiedTopology: true });

const itemSchema = new mongoose.Schema({
    name: String,
    date: Number,
    url: String,
    file: {
        contentType: String,
        data: Buffer,
    },
    claimed: Boolean,
    claimer: {
        name: String,
        email: String
    }
});

const userSchema = new mongoose.Schema({
    id: String
})

const Item = mongoose.model("item", itemSchema);
const User = mongoose.model("user", userSchema);

const app = express();

const upload = multer({ dest: "/tmp/uploads" })
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))
app.set("view engine", "ejs");

const routes = {
    admin: "/admin",
    lookUp: "/",
    claim: "/claim",
    login: "/login",
    logout: "/logout",
}

const options = {routes: routes, admin: false}


// ************ setting up Google OAuth2.0

// setting up cookies

app.use(session({  
    secret: process.env.SESSION_SECRET || 'default_session_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: (process.env.MONGO ||"mongodb://localhost:27017/") + dbName
    })
}));

app.use(passport.initialize());  
app.use(passport.session());


// what should be stored on browser?
// everything, because i don't wanna store it in database :(
passport.serializeUser((user, done) => {  
    done(null, user);
});
passport.deserializeUser((userDataFromCookie, done) => {  
    done(null, userDataFromCookie);
});

// setting up google auth

passport.use(new GoogleStrategy (  
    {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: (process.env.CALLBACK || 'http://localhost:3000') + '/auth/google/callback',
        scope: ['email', 'profile'],
    },
    (accessToken, refreshToken, profile, cb) => {
        // console.log('Our user authenticated with Google, and Google sent us back this profile info identifying the authenticated user:', profile);
        // can put anything into req.user, we choose to send just the raw profile (i.e. email)

        console.log(profile)
        return cb(null, {id: profile.id, name: profile.name, displayName: profile.displayName, emails: profile.emails});
    },
));

app.get('/auth/google/callback',  
    passport.authenticate('google', { failureRedirect: '/', session: true }),
    (req, res) => {
        console.log('wooo we authenticated, here is our user object:', req.user);
        // res.json(req.user); // idk why they had this
        res.redirect('/');
    }
);

app.get(routes.login, (req, res) => {
    if(!req.isAuthenticated()) {
        res.redirect("/auth/google/callback");
    } else {
        res.redirect("/")
    }
})

app.get(routes.logout, (req, res) => {
    req.logout();
    res.redirect("/");
})








// authentication
const adminAuth = (req, res, next) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user.id}, (err, user) => {
            if(user) {
                next();
            } else {
                res.redirect(routes.lookUp)
            }
        })
    }
    else res.redirect(routes.login)
}

const navAuth = (req, res, next) => {
    if(req.isAuthenticated()) {
        User.findOne({id: req.user.id}, (err, user) => {
            if(user) {
                req.options = {...options, admin: true}
                next();
            } else {
                next();
            }
        })
    }
    else next()
}

// ADMIN-SIDE

app.route(routes.admin)
.get(adminAuth, navAuth, function(req, res) {
    Item.find({claimed: true}, function(err, items) {
        if (!err) {
            //console.log(items);
            Item.find(function(err, allItems) {
                res.render("index", {...req.options, items: items, allItems: allItems});
            })
        } else {
            console.log(err);
        }
    });
})
.post(adminAuth, upload.single("image"), (req, res) => {
    let {name, date, url} = req.body;
    console.log(name, date);
    date = new Date(date).getTime();
    const path = "/tmp/uploads/" + req.file.filename;
    
    const anItem = new Item({
        name: name,
        date: date,
        url: url,
        file: {
            contentType: req.file.mimetype,
            data: fs.readFileSync(path),
        },
        claimed: false,
    })

    anItem.save((err) => {
        if(!err) {
            res.redirect(routes.admin);
        } else console.log(err);
    })

    fs.unlink(path, err => {
        if(err) console.log(err);
    })
})

app.post(routes.admin + "/delete", adminAuth, function({body}, res) {
    const {id} = body;
    
    Item.deleteOne({_id: id}, function(err) {
        if (!err) {
            console.log("successfully deleted!");
            res.redirect(routes.admin);
        } else {
            console.log("not successfully deleted!");
        }
    });
});

// STUDENT-SIDE

app.route(routes.lookUp)
.get(navAuth, (req, res) => {
    Item.find({claimed: false}, function(err, items) {
        if (!err) {
            //console.log(items);
            
            res.render("look-up", {...req.options, items: items});
        } else {
            console.log(err);
        }
    });
})
.post(navAuth, ({body}, res) => {
    let {type, startDate, endDate, ID} = body; // 5ef66b2f7fbba908b779dc9a
    // if no startdate, set startdate to 0
    if(!startDate) startDate = new Date(0); else startDate = new Date(startDate);
    // if no enddate, set enddate to one year from now
    if(!endDate) {const now = new Date(); endDate = new Date(); endDate.setYear(now.getFullYear() + 1)} else endDate = new Date(endDate);
    
    // search for items
    Item.find({"_id": ID, claimed: false, name: { $regex: type, $options: "i" }, date: { $gt: startDate.getTime(), $lt: endDate.getTime() }}, function(err, items) {
        if (!err) {
            console.log(items);
            
            res.render("look-up", {...req.options, items: items});
        } else {
            console.log(err);
        }
    });
});

app.route(routes.claim)
.get(navAuth, (req, res) => {
    res.render("claim", {...req.options, id: ""})
})
.post((req, res) => {
    const {name, email, id} = req.body;
    Item.updateOne({"_id": req.body.id, "claimed": false}, {"$set" : {"claimed": true, "claimer": {"name": name, "email": email}}}, (err, result) => {
        if(err) {
            console.log("something went wrong");
        } else if(result.nModified) {
            console.log("updated!", result)
        } else {
            console.log("not updated", result);
        }

        res.redirect(routes.claim)
    })
})

app.get(navAuth, (req, res) => {
    res.render("claim", {...req.options, id: req.params.id})
})

app.listen(3000, (err) => {
    console.log("connected to port 3000");
})