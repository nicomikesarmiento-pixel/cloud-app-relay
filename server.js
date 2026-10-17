const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
// Napakahalaga: Sinasabi nito na sundin ang port na ibinibigay ng Render o mag-default sa 3000
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const STORAGE_DIR = path.join(__dirname, 'cloud_vault');
fs.ensureDirSync(STORAGE_DIR);

// 1. Gumawa ng Secure at Hiwalay na Session para sa bawat user/link
app.post('/api/create-session', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Kailangan ng link' });

    try {
        const sessionId = crypto.randomBytes(8).toString('hex');
        const filename = `app_${sessionId}.apk`;
        const filePath = path.join(STORAGE_DIR, filename);

        // Pag-download sa Cloud gamit ang Android Phone User-Agent (Fake Phone simulation)
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        writer.on('finish', () => {
            res.json({
                success: true,
                securePath: `/api/get-app/${sessionId}/${filename}`
            });
        });

        writer.on('error', (err) => {
            console.error('Writer Error:', err);
            res.status(500).json({ error: 'Bigo ang pagkuha ng file sa ibinigay na link.' });
        });

    } catch (err) {
        console.error('Download Error:', err.message);
        res.status(500).json({ error: 'May mali sa hininging URL o hindi ma-access.' });
    }
});

// 2. Pagbibigay ng File sa User at Kusang Pagbubura (Auto-Delete) pagkatapos
app.get('/api/get-app/:sessionId/:filename', (req, res) => {
    const { sessionId, filename } = req.params;
    const filePath = path.join(STORAGE_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Ang file ay wala na o nabura na para sa seguridad.');
    }

    res.download(filePath, filename, (err) => {
        if (!err) {
            console.log(`[AUTO-CLEANUP] Naibigay na ang file kay sesyon ${sessionId}. Binubura na sa cloud storage...`);
            setTimeout(() => {
                fs.remove(filePath).catch(e => console.error(e));
            }, 5000);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Cloud Server ay aktibo sa port ${PORT}`);
});
