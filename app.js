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
    }
});

const Item = mongoose.model("item", itemSchema);

const app = express();

const upload = multer({ dest: "/tmp/uploads" })
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"))
app.set("view engine", "ejs");

app.route("/")
.get(function(req, res) {
    Item.find(function(err, items) {
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
        }
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

app.route("/look-up")
.get((req, res) => {
    Item.find(function(err, items) {
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
    if(ID) {
        Item.findById(ID, (err, items) => {
            if (!err) {
                if(items) {
                    console.log(items);
                    res.render("look-up", {items: [items]});
                } else {
                    console.log(items);
                    res.render("look-up", {items: []});
                }
            } else {
                console.log(err);
                res.render("look-up", {items: []});
            }
        })
    } else {
        if(!startDate) startDate = new Date(0); else startDate = new Date(startDate);
        if(!endDate) {const now = new Date(); endDate = new Date(); endDate.setYear(now.getFullYear() + 1)} else endDate = new Date(endDate);
        console.log(startDate);
        Item.find({name: { $regex: type, $options: "i" }, date: { $gt: startDate.getTime(), $lt: endDate.getTime() }}, function(err, items) {
            if (!err) {
                console.log(items);
                
                res.render("look-up", {items: items});
            } else {
                console.log(err);
            }
        });
    }
});

app.listen(3000, (err) => {
    console.log("connected to port 3000");
})