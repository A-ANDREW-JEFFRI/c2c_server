const { Sequelize, DataTypes } = require('sequelize');
const { join } = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { readFileSync, unlink } = require('fs');
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
    cb(null, os.tmpdir());
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

    const imagePath = join(os.tmpdir(), req.file.originalname);
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

    // Clean up the uploaded file after processing
    unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete the file:', err);
    });

    res.json({ message: 'Data extracted and saved successfully', extractedData: parsedData });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

module.exports = app;

exports.handler = app;
