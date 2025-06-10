import React, { useCallback, useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
import { SimliClient } from "simli-client";
import VideoBox from "./Components/VideoBox";
import cn from "./utils/TailwindMergeAndClsx";
import IconExit from "@/media/IconExit";
import IconSparkleLoader from "@/media/IconSparkleLoader";
import { on } from "events";
import VideoPopupPlayer from "./Components/video-player";




interface SimliOpenAIProps {
  simli_faceid: string;
  openai_voice: "alloy"|"ash"|"ballad"|"coral"|"echo"|"sage"|"shimmer"|"verse";
  openai_model: string;
  initialPrompt: string;
  onStart: () => void;
  onClose: () => void;
  showDottedFace: boolean;
}

const simliClient = new SimliClient();

const SimliOpenAI: React.FC<SimliOpenAIProps> = ({
  simli_faceid,
  openai_voice,
  openai_model,
  initialPrompt,
  onStart,
  onClose,
  showDottedFace,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isAvatarVisible, setIsAvatarVisible] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [userMessage, setUserMessage] = useState("...");
  const [showPopup, setShowPopup] = useState(false);
  const [videoName, setVideoName] = useState<string | null>(null);  
  const [email, setEmail] = useState("");
  const [userid, setUserId] = useState("questions"); //namespace

const emailRef = useRef(email);
const useridRef = useRef(userid);

useEffect(() => {
  emailRef.current = email;
}, [email]);

useEffect(() => {
  useridRef.current = userid;
}, [userid]);

  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  console.log("Submitted email:", emailRef.current);
  // Add your submission logic here
};

  // Refs for various components and states
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const openAIClientRef = useRef<RealtimeClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isFirstRun = useRef(true);

  // New refs for managing audio chunk delay
  const audioChunkQueueRef = useRef<Int16Array[]>([]);
  const isProcessingChunkRef = useRef(false);

  /**
   * Initializes the Simli client with the provided configuration.
   */
  const initializeSimliClient = useCallback(() => {
    if (videoRef.current && audioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: simli_faceid,
        handleSilence: true,
        maxSessionLength: 30600, // in seconds
        maxIdleTime: 30600, // in seconds
        videoRef: videoRef.current,
        audioRef: audioRef.current,
        enableConsoleLogs: true,
      };

      simliClient.Initialize(SimliConfig as any);
      console.log("Simli Client initialized");
    }
  }, [simli_faceid]);


  


  /**
   * Initializes the OpenAI client, sets up event listeners, and connects to the API.
   */
  const initializeOpenAIClient = useCallback(async () => {
    try {
      console.log("Initializing OpenAI client...");
      openAIClientRef.current = new RealtimeClient({
        model: openai_model,
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowAPIKeyInBrowser: true,
      });

      await openAIClientRef.current.updateSession({
        instructions: initialPrompt,
        voice: openai_voice,
        turn_detection: { type: "server_vad" },
        input_audio_transcription: { model: "whisper-1" },
      });

      // --------- TOOLS ----------

      // Fetches all the questions for the given userid
      openAIClientRef.current.addTool(
  {
    name: 'get_question_set',
    description: 'Fetches the question set for the current user.',
    parameters: {
      type: 'object',
      properties: {}, // No external input required
    },
    
  },
  async () => {
    const result = await fetch("https://holoagent.app.n8n.cloud/webhook/questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userid:useridRef.current, email:emailRef.current }), // Accessing from component state
    });
    console.log("Using email:", emailRef.current);
    const json = await result.text();
    return json;
  }
);



      // Scores the user after the interview is finished
      openAIClientRef.current.addTool(
        {
          name: 'set_final_score',
          description:
            'Scores the interviee based on the answers given by the user. Score is between 0 to 100. Use this tool when the interview is finished. ',
          parameters: {
            type: 'object',
            properties: {
              score: {
                type: 'string',
                description: 'This is the score that this llm will give to the user based on the answers given by the user.Give a score between 0 to 100',
              },
              feedback: {
                type: 'string',
                description: 'This is the final feedback after the interview. ',
              },
              question: {
                type: 'string',
                description: 'These are all the questions that were asked. This llm will give score based on these question',
              },
              answer: {
                type: 'string',
                description: 'These are all the answers that was given by the user. This llm will give score based on these answer',
              },
              

            },
            required: ['score','feedback','question','answer'],
          },
        },
        async ({ score,feedback,question,answer}: { score: string,question:string,answer:string,feedback:string }) => {
          const result = await fetch("https://holoagent.app.n8n.cloud/webhook/setscore", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ score,feedback,question,answer,userid:emailRef.current }), // Accessing from component state
          });
        
          const json = await result.text();
          // setVideoName(video_url);
          // if (videoName !== null) {
            
          // setShowPopup(true);}

          return json;
        }
      );

      // Set up event listeners
      openAIClientRef.current.on(
        "conversation.updated",
        handleConversationUpdate
      );

      openAIClientRef.current.on(
        "conversation.interrupted",
        interruptConversation
      );

      openAIClientRef.current.on(
        "input_audio_buffer.speech_stopped",
        handleSpeechStopped
      );
      // openAIClientRef.current.on('response.canceled', handleResponseCanceled);

      
      await openAIClientRef.current.connect().then(() => {
        console.log("OpenAI Client connected successfully");
        openAIClientRef.current?.createResponse();
        startRecording();
      });

      setIsAvatarVisible(true);
    } catch (error: any) {
      console.error("Error initializing OpenAI client:", error);
      setError(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }, [initialPrompt]);

  /**
   * Handles conversation updates, including user and assistant messages.
   */
  const handleConversationUpdate = useCallback((event: any) => {
    console.log("Conversation updated:", event);
    const { item, delta } = event;

    if (item.type === "message" && item.role === "assistant") {
      console.log("Assistant message detected");
      if (delta && delta.audio) {
        const downsampledAudio = downsampleAudio(delta.audio, 24000, 16000);
        audioChunkQueueRef.current.push(downsampledAudio);
        if (!isProcessingChunkRef.current) {
          processNextAudioChunk();
        }
      }
    } else if (item.type === "message" && item.role === "user") {
      setUserMessage(item.content[0].transcript);
    }
  }, []);

  /**
   * Handles interruptions in the conversation flow.
   */
  const interruptConversation = () => {
    console.warn("User interrupted the conversation");
    simliClient?.ClearBuffer();
    openAIClientRef.current?.cancelResponse("");
  };

  /**
   * Processes the next audio chunk in the queue.
   */
  const processNextAudioChunk = useCallback(() => {
    if (
      audioChunkQueueRef.current.length > 0 &&
      !isProcessingChunkRef.current
    ) {
      isProcessingChunkRef.current = true;
      const audioChunk = audioChunkQueueRef.current.shift();
      if (audioChunk) {
        const chunkDurationMs = (audioChunk.length / 16000) * 1000; // Calculate chunk duration in milliseconds

        // Send audio chunks to Simli immediately
        simliClient?.sendAudioData(audioChunk as any);
        console.log(
          "Sent audio chunk to Simli:",
          chunkDurationMs,
          "Duration:",
          chunkDurationMs.toFixed(2),
          "ms"
        );
        isProcessingChunkRef.current = false;
        processNextAudioChunk();
      }
    }
  }, []);

  /**
   * Handles the end of user speech.
   */
  const handleSpeechStopped = useCallback((event: any) => {
    console.log("Speech stopped event received", event);
  }, []);

  /**
   * Applies a simple low-pass filter to prevent aliasing of audio
   */
  const applyLowPassFilter = (
    data: Int16Array,
    cutoffFreq: number,
    sampleRate: number
  ): Int16Array => {
    // Simple FIR filter coefficients
    const numberOfTaps = 31; // Should be odd
    const coefficients = new Float32Array(numberOfTaps);
    const fc = cutoffFreq / sampleRate;
    const middle = (numberOfTaps - 1) / 2;

    // Generate windowed sinc filter
    for (let i = 0; i < numberOfTaps; i++) {
      if (i === middle) {
        coefficients[i] = 2 * Math.PI * fc;
      } else {
        const x = 2 * Math.PI * fc * (i - middle);
        coefficients[i] = Math.sin(x) / (i - middle);
      }
      // Apply Hamming window
      coefficients[i] *=
        0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (numberOfTaps - 1));
    }

    // Normalize coefficients
    const sum = coefficients.reduce((acc, val) => acc + val, 0);
    coefficients.forEach((_, i) => (coefficients[i] /= sum));

    // Apply filter
    const result = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < numberOfTaps; j++) {
        const idx = i - j + middle;
        if (idx >= 0 && idx < data.length) {
          sum += coefficients[j] * data[idx];
        }
      }
      result[i] = Math.round(sum);
    }

    return result;
  };

  /**
   * Downsamples audio data from one sample rate to another using linear interpolation
   * and anti-aliasing filter.
   *
   * @param audioData - Input audio data as Int16Array
   * @param inputSampleRate - Original sampling rate in Hz
   * @param outputSampleRate - Target sampling rate in Hz
   * @returns Downsampled audio data as Int16Array
   */
  const downsampleAudio = (
    audioData: Int16Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array => {
    if (inputSampleRate === outputSampleRate) {
      return audioData;
    }

    if (inputSampleRate < outputSampleRate) {
      throw new Error("Upsampling is not supported");
    }

    // Apply low-pass filter to prevent aliasing
    // Cut off at slightly less than the Nyquist frequency of the target sample rate
    const filteredData = applyLowPassFilter(
      audioData,
      outputSampleRate * 0.45, // Slight margin below Nyquist frequency
      inputSampleRate
    );

    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.floor(audioData.length / ratio);
    const result = new Int16Array(newLength);

    // Linear interpolation
    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < filteredData.length) {
        const a = filteredData[index];
        const b = filteredData[index + 1];
        result[i] = Math.round(a + fraction * (b - a));
      } else {
        result[i] = filteredData[index];
      }
    }

    return result;
  };

  /**
   * Starts audio recording from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    try {
      console.log("Starting audio recording...");
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const source = audioContextRef.current.createMediaStreamSource(
        streamRef.current
      );
      processorRef.current = audioContextRef.current.createScriptProcessor(
        2048,
        1,
        1
      );

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        let sum = 0;

        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          audioData[i] = Math.floor(sample * 32767);
          sum += Math.abs(sample);
        }

        openAIClientRef.current?.appendInputAudio(audioData);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      setIsRecording(true);
      console.log("Audio recording started");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone. Please check your permissions.");
    }
  }, []);

  /**
   * Stops audio recording from the user's microphone
   */
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    console.log("Audio recording stopped");
  }, []);

  /**
   * Handles the start of the interaction, initializing clients and starting recording.
   */
  const handleStart = useCallback(async () => {
    setIsLoading(true);
    setError("");
    onStart();

    try {
      console.log("Starting...");
      initializeSimliClient();
      await simliClient?.start();
      eventListenerSimli();
    } catch (error: any) {
      console.error("Error starting interaction:", error);
      setError(`Error starting interaction: ${error.message}`);
    } finally {
      setIsAvatarVisible(true);
      setIsLoading(false);
    }
  }, [onStart]);

  /**
   * Handles stopping the interaction, cleaning up resources and resetting states.
   */
  const handleStop = useCallback(() => {
    console.log("Stopping interaction...");
    setIsLoading(false);
    setError("");
    stopRecording();
    setIsAvatarVisible(false);
    simliClient?.close();
    openAIClientRef.current?.disconnect();
    if (audioContextRef.current) {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    stopRecording();
    onClose();
    console.log("Interaction stopped");
  }, [stopRecording]);

  /**
   * Simli Event listeners
   */
  const eventListenerSimli = useCallback(() => {
    if (simliClient) {
      simliClient?.on("connected", () => {
        console.log("SimliClient connected");
        // Initialize OpenAI client
        initializeOpenAIClient();
      });

      simliClient?.on("disconnected", () => {
        console.log("SimliClient disconnected");
        openAIClientRef.current?.disconnect();
        if (audioContextRef.current) {
          audioContextRef.current?.close();
        }
      });
    }
  }, []);


  return (
    <>
      {/* Fullscreen Background Video Layer */}
      {isAvatarVisible && videoName && (
        <video
          src={`${videoName}`}
          autoPlay
          onEnded={() => setVideoName(null)}
          className="fixed inset-0 z-40 w-full h-full object-cover transition-all duration-700 ease-in-out"
        />
      )}
  
      {/* Avatar Wrapper - Responsive Stage */}
      <div
        className={cn(
          "transition-all duration-700 ease-in-out z-50",
          isAvatarVisible && videoName
            ? "fixed bottom-4 right-4 w-[400px] h-[400px] bg-black/10 rounded-xl flex items-center justify-center overflow-hidden shadow-xl"
            : "flex justify-center items-center h-[calc(100vh-150px)] w-full relative"
        )}
      >
        <div
          className={cn(
            "transition-transform duration-700 ease-in-out",
            isAvatarVisible && videoName
              ? "scale-75 origin-center"
              : "scale-100"
          )}
        >
          <VideoBox video={videoRef} audio={audioRef} />
        </div>
      </div>
  
      {/* Close Button for Video */}
      {isAvatarVisible && videoName && (
        <button
          onClick={() => setVideoName(null)}
          className="fixed top-4 right-4 text-white bg-black/50 hover:bg-black rounded-full px-3 py-1 text-xl z-50 transition-all duration-300"
        >
          ✕
        </button>
      )}
  
     {/* Interaction Buttons */}
<div className="flex flex-col items-center z-10 relative">
  {!isAvatarVisible ? (
    <>
      {/* Email Form */}
      <form className="w-full flex flex-col items-center" onSubmit={handleEmailSubmit}>
        <label htmlFor="email" className="text-white mb-2 font-abc-repro-mono font-bold">
          Enter your email:
        </label>
        <input
          
          id="email"
          name="email"
          required
          className="w-full h-[40px] px-4 mb-4 rounded-[8px] text-black"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="w-full h-[40px] bg-simliblue text-white rounded-[8px] transition-all duration-300 hover:bg-white hover:text-black"
        >
          Submit
        </button>
      </form>

      {/* Test Interaction Button */}
      <button
        onClick={handleStart}
        disabled={isLoading}
        className={cn(
          "w-full h-[52px] mt-4 disabled:bg-[#343434] disabled:text-white disabled:hover:rounded-[100px] bg-simliblue text-white py-3 px-6 rounded-[100px] transition-all duration-300 hover:text-black hover:bg-white hover:rounded-sm",
          "flex justify-center items-center"
        )}
      >
        {isLoading ? (
          <IconSparkleLoader className="h-[20px] animate-loader" />
        ) : (
          <span className="font-abc-repro-mono font-bold w-[164px]">
            Test Interaction
          </span>
        )}
      </button>
    </>
  ) : (
          <div className="flex items-center gap-4 w-full mt-4">
            <button
              onClick={() => {
                handleStop();
                setVideoName(null);
              }}
              className="group text-white flex-grow bg-red hover:rounded-sm hover:bg-white h-[52px] px-6 rounded-[100px] transition-all duration-300"
            >
              <span className="font-abc-repro-mono group-hover:text-black font-bold w-[164px] transition-all duration-300">
                Stop Interaction
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
  


 
};

export default SimliOpenAI;
