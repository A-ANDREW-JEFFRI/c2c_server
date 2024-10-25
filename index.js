const { join } = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const os = require('os');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// CORS options
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));

// Configure multer to use the OS temporary directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp'); // Vercel's temporary storage directory
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

app.use(express.json());

// Define the POST route
app.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded.' });
    }

    // Store the image temporarily in the `/tmp` directory
    const imagePath = join('/tmp', req.file.originalname);
    const base64Image = readFileSync(imagePath).toString('base64');

    const apiKey = process.env.OPENAI_API_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Please provide the extracted details in plain JSON format without any additional text or formatting or quotes. Here is an example input: {
            "name": "John Doe",
            "company_name": "Example Inc.",
            "phone": "123-456-7890",
            "email": "john.doe@example.com",
            "address": "123 Main St, Anytown, USA",
            "website": "www.example.com",
            "job_title": "Software Engineer",
            "linkedin": "https://linkedin.com/in/johndoe"
          }`
        },
        {
          role: 'user',
          content: `Attached image data: data:image/png;base64,${base64Image}`
        }
      ],
      max_tokens: 300
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });

    console.log('OpenAI API Response:', response.data);

    const extractedText = response.data.choices[0].message.content;
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      return res.status(400).json({ error: 'Failed to parse extracted data.' });
    }

    // Serve the image temporarily via a base64 URL for display or immediate use
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // Clean up the uploaded file after processing
    unlinkSync(imagePath);

    res.json({ message: 'Data extracted successfully', extractedData: parsedData, imageUrl });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

// Export the API route
module.exports = app;

// Vercel requires a default export to run your API
exports.handler = app;
