const express = require('express')
const ejs = require('ejs')
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require("fs")

mongoose.connect("mongodb://localhost:27017/lostDB", {useNewUrlParser: true, useUnifiedTopology: true });

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

const Item = mongoose.model("item", itemSchema);

const app = express();

const upload = multer({ dest: "/tmp/uploads" })
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))
app.set("view engine", "ejs");

// ADMIN-SIDE

app.route("/")
.get(function(req, res) {
    Item.find({claimed: true}, function(err, items) {
        if (!err) {
            //console.log(items);
            
            res.render("index", {items: items});
        } else {
            console.log(err);
        }
    });
})
.post(upload.single("image"), (req, res) => {
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
            res.redirect("/");
        } else console.log(err);
    })

    fs.unlink(path, err => {
        if(err) console.log(err);
    })
})

app.post("/delete", function({body}, res) {
    const {id} = body;
    
    Item.deleteOne({_id: id}, function(err) {
        if (!err) {
            console.log("successfully deleted!");
            res.redirect("/");
        }
    });
});

// STUDENT-SIDE

app.route("/look-up")
.get((req, res) => {
    Item.find({claimed: false}, function(err, items) {
        if (!err) {
            //console.log(items);
            
            res.render("look-up", {items: items});
        } else {
            console.log(err);
        }
    });
})
.post(({body}, res) => {
    let {type, startDate, endDate, ID} = body; // 5ef66b2f7fbba908b779dc9a
    // if no startdate, set startdate to 0
    if(!startDate) startDate = new Date(0); else startDate = new Date(startDate);
    // if no enddate, set enddate to one year from now
    if(!endDate) {const now = new Date(); endDate = new Date(); endDate.setYear(now.getFullYear() + 1)} else endDate = new Date(endDate);
    
    // search for items
    Item.find({"_id": ID, claimed: false, name: { $regex: type, $options: "i" }, date: { $gt: startDate.getTime(), $lt: endDate.getTime() }}, function(err, items) {
        if (!err) {
            console.log(items);
            
            res.render("look-up", {items: items});
        } else {
            console.log(err);
        }
    });
});

app.route("/claim")
.get((req, res) => {
    res.render("claim", {id: ""})
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

        res.redirect("/claim")
    })
})

app.get((req, res) => {
    res.render("claim", {id: req.params.id})
})

app.listen(3000, (err) => {
    console.log("connected to port 3000");
})