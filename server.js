const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
// PORT is no longer strictly necessary for Vercel deployment, but can remain for local testing
const PORT = process.env.PORT || 3000; 

// Middleware
app.use(cors());
app.use(express.json());
// ⚠️ WARNING: These static file serving lines are generally not effective 
// for persistent file storage/serving in Vercel Serverless Functions.
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ----------------------------------------------------------------------
// File Upload Configuration
// ⚠️ WARNING: Disk Storage will not work for persistent storage on Vercel.
// Use multer.memoryStorage() temporarily, and plan to use an external service (S3/Vercel Blob) later.

// Using memory storage to prevent immediate errors on Vercel's read-only filesystem
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
// MongoDB Connection and Management

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamgenerator';
let db;

async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db();
        console.log('Connected to MongoDB');
    } catch (error) {
        // In a serverless environment, avoid process.exit(1). Let the function fail gracefully.
        console.error('MongoDB connection error:', error);
        throw new Error('Database connection failed.'); 
    }
}

// ----------------------------------------------------------------------
// NEW: Connection Middleware (for Serverless environment)

// This middleware ensures the DB connection is established before processing any request.
app.use(async (req, res, next) => {
    // If the 'db' variable is not set (first invocation or cold start), connect.
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
        // NOTE: req.file is a Buffer in memory now, not a file path.
        // For persistence, you MUST upload this buffer to S3/Blob storage.
        const photo = req.file ? `Buffer_in_Memory:${req.file.size}` : null;
        
        const person = {
            name,
            stats: JSON.parse(stats),
            photo, // Storing the photo buffer size, pathing will fail.
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
            // NOTE: File upload requires external storage solution.
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

// Removed the app.listen() call.
// This is the line that tells Vercel's Serverless Runtime what to execute.
module.exports = app;