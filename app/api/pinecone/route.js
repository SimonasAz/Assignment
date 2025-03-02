import dotenv from 'dotenv';
dotenv.config();
import { Pinecone } from '@pinecone-database/pinecone';
import axios from 'axios';

// Initialize Pinecone client with API key
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Function to sanitize text by trimming and replacing multiple spaces with a single space
const sanitizeText = (text) => text.trim().replace(/\s+/g, " ");

// Function to get sentence embedding using Hugging Face API
const getSentenceEmbedding = async (sentence) => {
  try {
    // Sanitize and truncate the sentence to 128 characters
    let sanitizedSentence = sanitizeText(sentence)
      .replace(/[\u2022\uf0a7]/g, '-')  // Replace bullet characters
      .substring(0, 128);              // Shorten input to 128 characters

    const payload = { inputs: sanitizedSentence };

    // Make a POST request to Hugging Face API to get the embedding
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      payload,
      { 
        headers: { 
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`, 
          "Content-Type": "application/json",
          "X-Inference-Task": "feature-extraction"  // Force feature extraction
        }
      }
    );
    console.log("Embedding:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error in getSentenceEmbedding:", error.response ? error.response.data : error.message);
    throw new Error("Embedding generation failed.");
  }
};

// Function to handle POST requests
export async function POST(request) {
  try {
    const requestBody = await request.json();
    console.log("Received request body:", requestBody);

    // If 'parameters' exists, this is candidate submission/upsert
    if (requestBody.parameters) {
      const { name, email, linked, skills, experience, education, jobDescription } = requestBody.parameters.candidateData;
      if (!jobDescription) {
        return new Response(JSON.stringify({ error: "Job description is required" }), { status: 400 });
      }
      // Get embedding for the job description
      const embedding = await getSentenceEmbedding(jobDescription);
      const id = `${name}-${Date.now()}`;
      const vector = {
        id,
        values: embedding[0].embedding,
        metadata: { name, email, linked, skills, experience, education, jobDescription }
      };
      // Upsert the vector into Pinecone index
      await index.upsert({ vectors: [vector] });
      return new Response(JSON.stringify({ message: "Candidate upserted successfully" }), { status: 200 });
    } else {
      // Otherwise, treat as candidate search using jobDescription
      const { jobDescription } = requestBody;
      if (!jobDescription) {
        return new Response(JSON.stringify({ error: "Job description is required" }), { status: 400 });
      }
      // Get embedding for the job description
      const embedding = await getSentenceEmbedding(jobDescription);
      // Query Pinecone index for matching candidates
      const queryResults = await index.query({
        vector: embedding[0].embedding,
        topK: 5,
        includeMetadata: true,
      });
      // Map query results to candidate objects
      const candidates = queryResults.matches?.map(match => ({
        name: match.metadata.name,
        email: match.metadata.email,
        skills: match.metadata.skills,
        experience: match.metadata.experience,
        education: match.metadata.education,
        score: match.score
      })) || [];
      return new Response(JSON.stringify({ candidates }), { status: 200 });
    }
  } catch (error) {
    console.error("Error processing /api/pinecone:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}