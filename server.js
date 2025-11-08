const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// EJS + Static Files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected (Atlas)'))
  .catch(err => console.log('❌ DB Error:', err));

// Multer (File Upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Models Import
const User = require('./models/User');
const Course = require('./models/Course');
const Note = require('./models/Note');

// Middleware: Login Check
const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// Routes
app.get('/', (req, res) => res.render('index'));

app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await new User({ username, password: hashed }).save();
  res.redirect('/login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user;
    res.redirect('/courses');
  } else {
    res.send('❌ Wrong username or password');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Courses
app.get('/courses', requireLogin, async (req, res) => {
  const courses = await Course.find();
  res.render('courses', { courses, user: req.session.user });
});

// Add Course (Admin only – simple)
app.get('/admin/add-course', requireLogin, (req, res) => res.render('add-course'));
app.post('/admin/add-course', requireLogin, async (req, res) => {
  const { title, description, liveLink } = req.body;
  await new Course({ title, description, liveLink }).save();
  res.redirect('/courses');
});

// Notes
app.get('/notes/:courseId', requireLogin, async (req, res) => {
  const notes = await Note.find({ courseId: req.params.courseId });
  const course = await Course.findById(req.params.courseId);
  res.render('notes', { notes, course });
});

app.post('/upload-note', requireLogin, upload.single('noteFile'), async (req, res) => {
  const { courseId } = req.body;
  await new Note({
    courseId,
    filePath: req.file.path,
    uploadedBy: req.session.user.username
  }).save();
  res.redirect('/notes/' + courseId);
});

app.get('/download/:id', requireLogin, async (req, res) => {
  const note = await Note.findById(req.params.id);
  res.download(note.filePath);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Neura chal raha hai: http://localhost:${PORT}`);
});