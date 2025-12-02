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
// This requires index.html, style.css, and script.js to be MOVED there.
const staticPath = path.join(__dirname, 'public'); 

// Middleware
app.use(cors());
app.use(express.json());

// --------------------------------------------------------
// FRONTEND SERVING FIX (Resolves 404s for static assets)
// --------------------------------------------------------

// 1. Serve static files (CSS, JS, images, index.html) from the 'public' directory
app.use(express.static(staticPath));

// 2. Define the route for the root path ('/') to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// ----------------------------------------------------------------------
// File Upload Configuration (Ignored in API routes for stability)
// ----------------------------------------------------------------------

// Keep storage defined, but its use in API routes is removed.
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } /* ... fileFilter ... */ });

// ----------------------------------------------------------------------
// MongoDB Connection and Management (Serverless friendly)
// ----------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamgenerator';
let db;

async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw new Error('Database connection failed.'); 
    }
}

// ----------------------------------------------------------------------
// Connection Middleware
// ----------------------------------------------------------------------

app.use(async (req, res, next) => {
    if (!db) {
        try {
            await connectDB();
            next();
        } catch (error) {
            res.status(500).json({ error: 'Internal Server Error: Database unavailable.' });
        }
    } else {
        next();
    }
});

// ----------------------------------------------------------------------
// API Routes (File upload handling removed for stability)
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
// FIX: File upload middleware removed; added robust stats parsing
app.post('/api/persons', async (req, res) => {
    try {
        const { name, stats } = req.body;
        
        let parsedStats;
        if (!stats) {
             return res.status(400).json({ error: 'Missing player stats in request.' });
        }
        try {
            parsedStats = JSON.parse(stats);
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid format for player stats. Must be valid JSON string.' });
        }
        
        const photo = null; 
        
        const person = {
            name,
            stats: parsedStats, 
            photo, 
            createdAt: new Date()
        };
        
        const result = await db.collection('persons').insertOne(person);
        res.status(201).json({ ...person, _id: result.insertedId }); 

    } catch (error) {
        console.error('Database Error saving person:', error.message);
        res.status(500).json({ error: error.message || 'Unknown database error saving person.' });
    }
});

// Update person
// FIX: File upload middleware removed
app.put('/api/persons/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, stats } = req.body;
        
        const updateData = {
            name,
            stats: JSON.parse(stats),
            updatedAt: new Date()
        };
        
        // Removed file update logic here.
        
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

module.exports = app;