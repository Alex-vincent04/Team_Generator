const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamgenerator';
let db;

async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGODB_URI);
        db = client.db();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

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
        const photo = req.file ? `/uploads/${req.file.filename}` : null;
        
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
            updateData.photo = `/uploads/${req.file.filename}`;
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

// Start Server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});