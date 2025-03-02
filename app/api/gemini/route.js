import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

// Function to handle POST requests for AI-generated summary
export async function POST(request) {
  try {
    // Parse the request body to get the text to be summarized
    const { text } = await request.json();

    // Make a POST request to Hugging Face API to get the summary
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
          "X-Inference-Task": "summarization"  // Specify the task
        },
      }
    );

    // Extract summary from the response
    const summary = response.data;

    // Return the summary as a JSON response
    return new Response(JSON.stringify({ summary }), { status: 200 });
  } catch (error) {
    // Log and return the error if the request fails
    console.error("Error processing /api/gemini:", error.response ? error.response.data : error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}