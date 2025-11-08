const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// === Settings ===
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'neura_secret_fallback',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true for HTTPS
}));

// === MongoDB Connect ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.log('❌ DB Connection Failed');
  console.log('Error:', err.message);
  console.log('Check: MONGO_URI, Network Access (0.0.0.0/0), Password encoding');
});

// === Multer (File Upload) ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// === Models ===
const User = require('./models/User');
const Course = require('./models/Course');
const Note = require('./models/Note');

// === Middleware ===
const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

// === Helper: Pass User to All Views ===
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// === Routes ===

// Home
app.get('/', (req, res) => {
  res.render('index');
});

// Login / Register
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await new User({ username, password: hashed }).save();
    res.redirect('/login');
  } catch (err) {
    res.send('Username already exists!');
  }
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
  res.render('courses', { courses });
});

// Add Course (Admin)
app.get('/admin/add-course', requireLogin, (req, res) => {
  res.render('add-course');
});

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
  res.redirect(`/notes/${courseId}`);
});

app.get('/download/:id', requireLogin, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).send('Note not found');
  res.download(note.filePath);
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Neura chal raha hai: http://localhost:${PORT}`);
});