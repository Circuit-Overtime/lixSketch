const express = require('express');
const fs = require('fs');
const cors = require('cors');
const Fuse = require('fuse.js');
const rateLimit = require('express-rate-limit');

const PORT = 3000;
const app = express();

app.use(cors());


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/search', limiter);

let metadata = {};
let fuse = null;

// Load and index metadata
function loadMetadata() {
    const raw = fs.readFileSync('./metadata.json', 'utf-8');
    metadata = JSON.parse(raw);

    const dataArray = Object.keys(metadata).map(filename => ({
        filename,
        ...metadata[filename]
    }));

    const options = {
        includeScore: true,
        threshold: 0.4,
        keys: ['filename', 'keywords', 'description', 'category']
    };

    fuse = new Fuse(dataArray, options);
    console.log(`✅ Reloaded ${dataArray.length} icons`);
}

loadMetadata();

// Watch for changes in metadata.json and reload index
fs.watchFile('./metadata.json', { interval: 1000 }, () => {
    console.log('🔁 Detected metadata.json change, reloading...');
    loadMetadata();
});

// Search endpoint
app.get('/search', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);

    const results = fuse.search(q);
    const top = results.slice(0, 30).map(r => r.item);

    res.json(top);
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Icon search API running on http://localhost:${PORT}`);
});
