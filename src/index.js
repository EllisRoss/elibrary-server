const express = require('express');
const app = express();
const cors = require('cors');
const port = 3001;
const mongo = require('mongodb');
const cookieParser = require('cookie-parser');


const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
}
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({extended: true}));
app.use(express.json());


let db;
mongo.MongoClient.connect('mongodb://localhost:27017/', {useUnifiedTopology: true}, function (err, client) {
    if (err) {
        throw err;
    }
    db = client.db('elibrary');
});


app.post('/auth/login', async (req, res) => {
    let data = {
        resultCode: 0,
        messages: [],
    }
    console.log(req.body);
    let user = await db.collection('users').findOne({login: req.body.login, password: req.body.password});
    if (user && user.login == req.body.login && user.password == req.body.password) {
        console.log("Credentials Match");
        res.cookie('uid', user._id.toString(), {
            httpOnly: false
        });
        console.log(req.cookies);
    } else {
        data.messages.push("Wrong Credentials");
        console.log("Wrong Credentials");
        data.resultCode = 1;
    }
    //console.log(req.session);
    //console.log(`path '/auth/login', ${req.cookies.uid}`);
    res.send(data);
});

app.get('/auth/me', async (req, res) => {
    //console.log(`path '/auth/me', ${req.cookies.uid}`);
    let data = {
        login: null,
        isAdmin: false,
        resultCode: 0,
    }
    let userID = new mongo.ObjectID(req.cookies.uid);
    let user;
    if (req.cookies.uid) {
        user = await db.collection('users').findOne({_id: userID});
    }
    if (user) {
        //console.log("path \'/auth/me\',User Match");
        //console.log(user)
        data.login = user.login;
        if (user.isAdmin) {
            data.isAdmin = true;
        }
        res.send(data);
    } else {
        //console.log("path \'/auth/me\', User does not Match");
        data.resultCode = 1;
        res.send(data);
    }
})

app.delete('/auth/login', (req, res) => {
    let data = {
        resultCode: 0,
        messages: [],
    }
    res.clearCookie('uid');
    res.send(data);
})

app.post('/auth/registration', async (req, res) => {
    let newUser = {
        login: req.body.login,
        password: req.body.password,
        readBooks: [],
    }

    console.log(req.body);

    await db.collection('users').findOne({login: newUser.login}, (err, result) => {
        if (!err) {
            if (!result) {
                db.collection('users').insertOne(newUser, (err) => {
                    if (!err) {
                        console.log('Added user');
                    } else {
                        console.log(err.message);
                    }
                });
                res.sendStatus(201);
            } else {
                console.log('User is already exist');
                res.sendStatus(406);
            }
        } else {
            console.log(err);
        }
    });
});

app.get('/profile/readBooks', async (req, res) => {
    let data = {
        readBooks: null,
        resultCode: 0,
    }
    let userID = new mongo.ObjectID(req.cookies.uid);
    let user;
    if (req.cookies.uid) {
        user = await db.collection('users').findOne({_id: userID});
    }
    data.readBooks = [...user.readBooks];
    if (data.readBooks) {
        console.log(data);
        res.send(data);
    } else {
        data.resultCode = 1;
        res.send(data);
    }
});

app.get('/library/books', (req, res) => {
    db.collection('books').find().toArray(function (err, result) {
        if (err) {
            throw err;
        }
        res.send(result);
    });
});

app.get('/library/book-reader/:bookId', async (req, res) => {
    console.log(req.cookies);
    let userID = new mongo.ObjectID(req.cookies.uid);
    let bookId = req.params['bookId'];

    let user;
    if (req.cookies.uid) {
        user = await db.collection('users').findOne({_id: userID});
    }
    if (!user.readBooks.includes(bookId)) {
        db.collection('users').update({_id: userID}, {$push: {readBooks: bookId}});
    }

    res.sendfile(`src/books/${bookId}.pdf`);
});


// ADD BOOK
const multer = require('multer');
const upload = multer({dest: 'src/temp/books'}).single('bookFile');
const fs = require('fs');

const addBookAPI = {
    uploadFileMove(file, ISBN) {
        let oldPath = `src/temp/books/${file.filename}`
        let newPath = `src/books/${ISBN}.pdf`
        fs.rename(oldPath, newPath, (err) => {
            if (err) throw err;
            console.log('Rename complete!');
        });
    },

    addBook(book) {
        if (book) {
            let newBook = {
                title: book.title,
                author: book.author,
                year: Number(book.year),
                about: book.about,
                keyWords: book.keyWords.split(","),
                ISBN: Number(book.ISBN),
            }

            db.collection('books').insertOne(newBook, (err, result) => {
                if (!err) {
                    console.log('Inserted');
                }
            });
        }
    }
}

app.post('/library/add-book', upload, async (req, res) => {
    await db.collection('books').findOne({ISBN: Number(req.body.ISBN)}, (err, result) => {
        if (!err) {
            if (!result) {
                console.log(result);
                addBookAPI.addBook(req.body);
                addBookAPI.uploadFileMove(req.file, req.body.ISBN);
                res.sendStatus(201);
            } else {
                console.log('Not insert, book is already exist');
                res.sendStatus(406);
            }
        } else {
            console.log(err);
        }
    });
})
// END ADD BOOK


app.listen(port, () => {
});