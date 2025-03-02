"use client";
import "./globals.css";
import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/webpack";
import axios from "axios";
GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";

export default function Home() {
  const [resume, setResume] = useState(null);
  const hiddenFileInput = useRef(null);
  const [skills, setSkills] = useState([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linked, setLinked] = useState("");
  const [errMessage, setErrMessage] = useState("");
  const [parsedData, setParsedData] = useState({ skills: "", experience: "", education: "" });
  const [jobDescription, setJobDescription] = useState("");
  const [matchingCandidates, setMatchingCandidates] = useState([]);
  
  // Gemini integration state
  const [aiSummary, setAiSummary] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");

  const searchCandidates = async () => {
    try {
      const jd = parsedData.experience || '';  // Use experience as job description if available
      if (!jd) {
        console.error("Job description is missing");
        return;
      }
  
      const response = await fetch('/api/searchCandidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });
  
      const data = await response.json();
      setMatchingCandidates(data.candidates);
    } catch (error) {
      console.error("Error searching for candidates:", error);
    }
  };

  const handleSubmit = async () => {
    if (!name || !email || !linked || !parsedData.skills) {
      console.error("Missing required fields!");
      return;
    }
  
    // Always use the extracted experience as the job description
    const candidateJobDescription = parsedData.experience;
  
    const candidateData = {
      name,
      email,
      linked,
      skills: parsedData.skills,
      experience: parsedData.experience,
      education: parsedData.education,
      jobDescription: candidateJobDescription,
    };
  
    console.log("Submitting candidate data:", candidateData);
  
    try {
      const response = await fetch('/api/pinecone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: { candidateData } }), // Ensure the data is wrapped in a 'parameters' key
      });
  
      console.log("Raw response:", response);
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server responded with error:", response.status, response.statusText);
        console.error("Error body:", errorText);
        return;
      }
  
      const result = await response.json();
      console.log("Successfully upserted vector:", result);
    } catch (error) {
      console.error("Error submitting data:", error);
    }
  };

  const handleChange = async (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
      }

      setResume(file);

      const reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onload = async () => {
        const typedArray = new Uint8Array(reader.result);

        try {
          const pdf = await getDocument(typedArray).promise;
          let extractedText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item) => item.str).join(" ");
            extractedText += pageText + "\n";
          }

          console.log("Extracted Text:", extractedText);
          const extractedData = extractedResumeInfo(extractedText);
          setParsedData(extractedData);
        } catch (error) {
          console.error("Error parsing PDF:", error);
        }
      };
    }
  };

  const extractedResumeInfo = (text) => {
    return {
      skills: extractSection(text, "Skills"),
      experience: extractSection(text, "Experience"),
      education: extractSection(text, "Education"),
    };
  };

  const extractSection = (text, sectionName) => {
    const regex = new RegExp(`${sectionName}\\s*:?\\s*(.*?)(?=\\n[A-Z][a-z]|$)`, "is");
    const match = text.match(regex);
    return match ? match[1].trim() : "Not Found";
  };

  const handleClick = () => {
    hiddenFileInput.current.click();
  };

  const addSkill = () => {
    if (input.trim() !== "") {
      if (skills.length < 5) {
        setSkills((prev) => [...prev, input.trim()]);
        setInput("");
        setErrMessage("");
      } else {
        setErrMessage("You can only add up to 5 skills.");
      }
    } else {
      setErrMessage("Enter a skill.");
    }
  };

  const deleteSkill = (indexDel) => {
    setSkills(skills.filter((_, index) => index !== indexDel));
  };

  // --- Gemini functions ---
  const fetchAISummary = async () => {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: parsedData.experience }),
      });
      const data = await response.json();
      setAiSummary(data.summary);
    } catch (error) {
      console.error("Error fetching AI summary:", error);
    }
  };

  const fetchAIFeedback = async () => {
    try {
      const response = await fetch('/api/gemini-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: parsedData.skills, experience: parsedData.experience, jobDescription }),
      });
      const data = await response.json();
      setAiFeedback(data.feedback);
    } catch (error) {
      console.error("Error fetching AI feedback:", error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center">Candidate Application Form</h1><br></br>

        <form className="space-y-4">
          <label htmlFor="name" className="text-lg font-medium">Enter your name:</label><br></br>
          <input 
            type="text" 
            id="name"
            value={name}
            onChange={(e)=> setName(e.target.value)} 
            className="border-2 border-black p-3 w-full text-lg rounded-md" /><br></br>

          <label htmlFor="email" className="text-lg font-medium">Enter your email:</label><br></br>
          <input 
            type="email" 
            id="email" 
            value={email}
            onChange={(e)=> setEmail(e.target.value)} 
            className="border-2 border-black p-3 w-full text-lg rounded-md" /><br></br>

          <label htmlFor="LinkedIn" className="text-lg font-medium">Enter your LinkedIn:</label><br></br>
          <input 
            type="url" 
            id="LinkedIn" 
            value={linked}
            onChange={(e)=> setLinked(e.target.value)} 
            className="border-2 border-black p-3 w-full text-lg rounded-md" /><br></br>

          {/* Resume Upload */}
          <label className="text-lg font-medium">Upload Your Resume:</label><br></br>
          <input 
            type="file"
            ref={hiddenFileInput}
            onChange={handleChange}
            accept=".pdf"
            style={{ display: "none" }}
          />
          <button type="button" onClick={handleClick} className="bg-blue-500 text-white px-5 py-3 rounded-md text-lg">
            Upload Resume
          </button><br></br>

          {/* Removed display of extracted resume info */}

          {/* Skills Input */}
          <label className="text-lg font-medium">Add 5 of your best Skills:</label><br></br>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="For example: HTML"
              className="border-2 border-gray-300 p-3 w-full text-lg rounded-md"
            />
            <button type="button" onClick={addSkill} className="bg-green-500 text-white px-7 py-1 rounded-md text-lg whitespace-nowrap">
              Add Skill
            </button>
          </div>

          {errMessage && <p className="text-red-500">{errMessage}</p>}

          {/* Skill Tags */}
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.map((skill, index) => (
              <div key={index} className="bg-gray-200 text-black px-4 py-2 rounded-md flex items-center text-lg">
                <p>{skill}</p>
                <button
                  type="button"
                  onClick={() => deleteSkill(index)}
                  className="ml-2 text-red-500 font-bold"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button 
            type="button" 
            onClick={handleSubmit} 
            className="bg-blue-500 text-white px-5 py-3 rounded-md text-lg mt-4"
          >
            Submit
          </button>

          <div>
            <h2 className="text-2xl font-bold">Search for Candidates</h2>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Enter job description"
              className="border p-2 w-full"
            />
            <button onClick={searchCandidates} className="bg-blue-500 text-white px-5 py-3 rounded-md mt-3">
              Find Matching Candidates
            </button>

            {matchingCandidates.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mt-4">Top Matches:</h3>
                <ul>
                  {matchingCandidates.map((candidate, index) => (
                    <li key={index} className="border p-3 my-2">
                      <p><strong>Name:</strong> {candidate.name}</p>
                      <p><strong>Email:</strong> {candidate.email}</p>
                      <p><strong>Skills:</strong> {candidate.skills}</p>
                      <p><strong>Experience:</strong> {candidate.experience}</p>
                      <p><strong>Education:</strong> {candidate.education}</p>
                      <p><strong>Match Score:</strong> {candidate.score?.toFixed(2) || "N/A"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Uploaded Resume Info */}
          {resume && <p className="text-green-600">Uploaded: {resume.name}</p>}
        </form>

        {/* Gemini Integration Buttons */}
        <div className="mt-6">
          <button 
            type="button" 
            onClick={fetchAISummary} 
            className="bg-blue-500 text-white px-5 py-3 rounded-md text-lg"
          >
            Generate AI Summary
          </button>
          {aiSummary && <p className="mt-4 p-3 bg-gray-200 rounded-md">{aiSummary}</p>}

          <button 
            type="button" 
            onClick={fetchAIFeedback} 
            className="bg-green-500 text-white px-5 py-3 rounded-md text-lg mt-4"
          >
            Get AI Feedback
          </button>
          {aiFeedback && <p className="mt-4 p-3 bg-yellow-200 rounded-md">{aiFeedback}</p>}
        </div>
      </div>
    </div>
  );
}