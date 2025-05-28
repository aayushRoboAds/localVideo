"use client";
import React, { use, useEffect, useState } from "react";
import SimliOpenAI from "./SimliOpenAI";
import DottedFace from "./Components/DottedFace";
import SimliHeaderLogo from "./Components/Logo";
import Navbar from "./Components/Navbar";
import Image from "next/image";
import GitHubLogo from "@/media/github-mark-white.svg";

interface avatarSettings {
  name: string;
  openai_voice: "alloy"|"ash"|"ballad"|"coral"|"echo"|"sage"|"shimmer"|"verse";
  openai_model: string;
  simli_faceid: string;
  initialPrompt: string;
}

// Customize your avatar here
const avatar: avatarSettings = {
  name: "Mohammad",
  openai_voice: "ash",
  openai_model: "gpt-4o-realtime-preview-2024-12-17", // Use "gpt-4o-mini-realtime-preview-2024-12-17" for cheaper and faster responses or gpt-4o-realtime-preview-2024-12-17
  simli_faceid: "d9c1545a-daca-4b46-bf5e-2245b634f406",
  initialPrompt:
    //"You are a friendly and helpful assistant. You are designed to assist users with their queries and provide information about the products in the knowledge base. While searching for information, use filler words like 'um' and 'uh' to make your speech sound more natural. Provide information when you are searching and speak our as you recieve the information. ",
    "Current user ID is 'ppp'. You are a real estate agent. You have to find details about the properties in the knowledge base. You have to send query and user ID to RAG and fetch answer to speak and video to play. You are friendly and helpful. . You are designed to assist users with their queries and provide information about the products in the knowledge base. While searching for information, use filler words like 'um' and 'uh' to make your speech sound more natural. Provide information when you are searching and speak out as you receive the information.",
    //"Current user ID is 'pizza'. Wait for user to start. Act like a pizza salesman. Call tool to find the right video of the product to play at a time. Find details and play one relevant video while talking about it.  You have to send query and user ID to RAG and fetch answer to speak and video to play.  You are designed to assist users with their queries and provide information about the products in the knowledge base. While searching for information, use filler words to make your speech sound more natural. Provide information when you are intend to search or searching the knowledge base and speak out as you receive the information.",
};

const Demo: React.FC = () => {
  const [showDottedFace, setShowDottedFace] = useState(true);

  const onStart = () => {
    console.log("Setting setshowDottedface to false...");
    setShowDottedFace(false);
  };

  const onClose = () => {
    console.log("Setting setshowDottedface to true...");
    setShowDottedFace(true);
  };

  return (
    <div className="bg-black min-h-screen flex flex-col items-center justify-center font-abc-repro text-sm text-white p-8">
      {/* 
        If you'd like a custom logo at the top, uncomment and place your logo component:
        
        <div className="my-6">
          <Image
            src={MyCustomLogo}
            alt="Custom Logo"
            width={150}
            height={50}
            priority
            className="mx-auto"
          />
        </div>
      */}

      <div className="flex flex-col items-center gap-6 bg-effect15White p-6 pb-[40px] rounded-xl w-full">
      <SimliOpenAI
        openai_voice={avatar.openai_voice}
        openai_model={avatar.openai_model}
        simli_faceid={avatar.simli_faceid}
        initialPrompt={avatar.initialPrompt}
        onStart={onStart}
        onClose={onClose}
        showDottedFace={showDottedFace}
      />
    </div>
  </div>
);
};

export default Demo;
