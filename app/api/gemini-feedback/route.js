import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

// Function to handle POST requests for AI-generated feedback
export async function POST(request) {
  try {
    // Parse the request body to get skills, experience, and job description
    const { skills, experience, jobDescription } = await request.json();

    // Make a POST request to Hugging Face API to get the feedback
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: { skills, experience, jobDescription } },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
          "X-Inference-Task": "feature-extraction"  // Specify the task
        },
      }
    );

    // Extract feedback from the response
    const feedback = response.data;

    // Return the feedback as a JSON response
    return new Response(JSON.stringify({ feedback }), { status: 200 });
  } catch (error) {
    // Log and return the error if the request fails
    console.error("Error processing /api/gemini-feedback:", error.response ? error.response.data : error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}