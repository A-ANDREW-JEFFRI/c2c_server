const { join } = require('path'); 
const express = require('express'); 
const dotenv = require('dotenv'); 
const { readFileSync } = require('fs'); 
const axios = require('axios');
const multer = require('multer');
const cors = require('cors'); 

dotenv.config();

const app = express();

const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST'], 
};

app.use(cors(corsOptions));

const upload = multer({ dest: 'uploads/' });

app.use(express.json());

app.post('/process-image',upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded.' });
    }

    const imagePath = join(__dirname, req.file.path); 

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
          content: [
            {
              type: 'text',
              text: `Please provide the extracted details in plain JSON format without any additional text or formatting or quotes and also you can add other information which are provide: {
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
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });

console.log('OpenAI API Response:', response.data);

    const extractedText = response.data.choices[0].message.content;
console.log(extractedText);
    let parsedData;
    try {
      parsedData = JSON.parse(extractedText);
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      return res.status(400).json({ error: 'Failed to parse extracted data.' });
    }
    unlinkSync(imagePath);
    res.json({ message: 'Data extracted and saved successfully', extractedText });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message || 'Something went wrong'  });
  }
});

 