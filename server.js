const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
// PORT is kept for local development, ignored by Vercel
const PORT = process.env.PORT || 3000; 

// ✅ FIX: Define the static path to the 'public' folder. 
// This requires index.html, style.css, and script.js to be moved there.
const staticPath = path.join(__dirname, 'public'); 

// Middleware
app.use(cors());
app.use(express.json());

// --------------------------------------------------------
// FRONTEND SERVING FIX (Resolves "Cannot GET /" and 404s for static files)
// --------------------------------------------------------

// 1. Serve static files (CSS, JS, images, index.html) from the 'public' directory
app.use(express.static(staticPath));

// 2. Define the route for the root path ('/') to serve the index.html file
app.get('/', (req, res) => {
    // Send the index.html file from the public directory
    res.sendFile(path.join(staticPath, 'index.html'));
});

// ----------------------------------------------------------------------
// File Upload Configuration (Using memory storage for Vercel compatibility)
// ----------------------------------------------------------------------

// Using memory storage to prevent disk write errors on Vercel's read-only filesystem
const storage = multer.memoryStorage(); 

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// ----------------------------------------------------------------------
// MongoDB Connection and Management (Serverless friendly)
// ----------------------------------------------------------------------

// MONGODB_URI is read from Vercel environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamgenerator';
let db;

async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db();
        console.log('Connected to MongoDB');
    } catch (error) {
        // Now handles auth and SSL/DNS errors gracefully
        console.error('MongoDB connection error:', error);
        throw new Error('Database connection failed.'); 
    }
}

// ----------------------------------------------------------------------
// Connection Middleware (Ensures DB connection on cold start)
// ----------------------------------------------------------------------

app.use(async (req, res, next) => {
    if (!db) {
        try {
            await connectDB();
            next();
        } catch (error) {
            // Send a 500 error if the connection fails
            res.status(500).json({ error: 'Internal Server Error: Database unavailable.' });
        }
    } else {
        next();
    }
});

// ----------------------------------------------------------------------
// API Routes 
// ----------------------------------------------------------------------

// Get all persons
app.get('/api/persons', async (req, res) => {
    try {
        const persons = await db.collection('persons').find().toArray();
        res.json(persons);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create person
app.post('/api/persons', upload.single('photo'), async (req, res) => {
    try {
        const { name, stats } = req.body;
        // NOTE: File upload requires external storage solution for persistence
        const photo = req.file ? `Buffer_in_Memory:${req.file.size}` : null;
        
        const person = {
            name,
            stats: JSON.parse(stats),
            photo, 
            createdAt: new Date()
        };
        
        const result = await db.collection('persons').insertOne(person);
        res.status(201).json({ ...person, _id: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update person
app.put('/api/persons/:id', upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, stats } = req.body;
        
        const updateData = {
            name,
            stats: JSON.parse(stats),
            updatedAt: new Date()
        };
        
        if (req.file) {
            updateData.photo = `Buffer_in_Memory:${req.file.size}`;
        }
        
        const result = await db.collection('persons').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Person not found' });
        }
        
        res.json({ message: 'Person updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete person
app.delete('/api/persons/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.collection('persons').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Person not found' });
        }
        
        res.json({ message: 'Person deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all saved teams
app.get('/api/teams', async (req, res) => {
    try {
        const teams = await db.collection('savedTeams').find().sort({ createdAt: -1 }).toArray();
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save teams
app.post('/api/teams', async (req, res) => {
    try {
        const { teams } = req.body;
        
        const savedTeam = {
            teams,
            createdAt: new Date()
        };
        
        const result = await db.collection('savedTeams').insertOne(savedTeam);
        res.status(201).json({ ...savedTeam, _id: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete saved team
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.collection('savedTeams').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Saved team not found' });
        }
        
        res.json({ message: 'Saved team deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------------------------
// VERCEL COMPATIBILITY FIX: Export the Express app instance

// This is the handler Vercel executes.
module.exports = app;