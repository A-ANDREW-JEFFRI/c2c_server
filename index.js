const { join } = require('path'); 
const express = require('express'); 
const dotenv = require('dotenv'); 
const { readFileSync, unlinkSync } = require('fs'); 
const axios = require('axios');
const multer = require('multer');
const cors = require('cors'); 
const os = require('os');

dotenv.config();

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));

// Configure multer to store files in the `/tmp` directory (for Vercel)
const upload = multer({ dest: '/tmp' }); 

app.use(express.json());

// Define the POST route
app.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded.' });
    }

    // Define the path to the image in the /tmp directory
    const imagePath = join('/tmp', req.file.filename);

    // Read image as base64
    const base64Image = readFileSync(imagePath).toString('base64');

    // Set headers and payload for the OpenAI API request
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

    // Make the POST request to OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });

    // Log the API response
    console.log('OpenAI API Response:', response.data);

    // Extract the content from the response
    const extractedText = response.data.choices[0].message.content;

    // Parse the extracted JSON data if available
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      return res.status(400).json({ error: 'Failed to parse extracted data.' });
    }

    // Clean up the uploaded file after processing
    unlinkSync(imagePath);

    // Return the extracted data and base64 image URL to the client
    const imageUrl = `data:image/png;base64,${base64Image}`;
    res.json({ message: 'Data extracted successfully', extractedData: parsedData, imageUrl });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
});

// Export the API route (required for Vercel)
module.exports = app;

// Vercel requires a default export to run your API
exports.handler = app;
