"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ProductResults from "@/components/product-results";
import { INSTRUCTIONS, TOOLS } from "@/lib/config";
import { BASE_URL, MODEL } from "@/lib/constants";

type ToolCallOutput = {
  response: string;
  [key: string]: any;
};

// Añadir un tipo para el historial de búsqueda
type SearchHistoryItem = {
  id: string;
  timestamp: Date;
  query: string;
  filters: {
    category?: string;
    color?: string;
    maxPrice?: number;
  };
  imageUrl?: string; // Añadir campo para la URL de la imagen
};

export default function EcommerceApp() {
  const [logs, setLogs] = useState<any[]>([]);
  const [toolCall, setToolCall] = useState<any>(null);
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  // Agregar estado para el historial de búsquedas
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const audioTransceiver = useRef<RTCRtpTransceiver | null>(null);
  const tracks = useRef<RTCRtpSender[] | null>(null);

  // Start a new realtime session
  async function startSession() {
    try {
      if (!isSessionStarted) {
        setIsSessionStarted(true);
        // Get an ephemeral session token
        const session = await fetch("/api/session").then((response) =>
          response.json()
        );
        const sessionToken = session.client_secret.value;
        const sessionId = session.id;

        console.log("Session id:", sessionId);

        // Create a peer connection
        const pc = new RTCPeerConnection();

        // Set up to play remote audio from the model
        if (!audioElement.current) {
          audioElement.current = document.createElement("audio");
        }
        audioElement.current.autoplay = true;
        pc.ontrack = (e) => {
          if (audioElement.current) {
            audioElement.current.srcObject = e.streams[0];
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          if (sender) {
            tracks.current = [...(tracks.current || []), sender];
          }
        });

        // Set up data channel for sending and receiving events
        const dc = pc.createDataChannel("oai-events");
        setDataChannel(dc);

        // Start the session using the Session Description Protocol (SDP)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(`${BASE_URL}?model=${MODEL}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/sdp",
          },
        });

        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: await sdpResponse.text(),
        };
        await pc.setRemoteDescription(answer);

        peerConnection.current = pc;
      }
    } catch (error) {
      console.error("Error starting session:", error);
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionStarted(false);
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
    }
    setAudioStream(null);
    setIsListening(false);
    audioTransceiver.current = null;
    setTranscript("");
    setToolCall(null);
  }

  // Grabs a new mic track and replaces the placeholder track in the transceiver
  async function startRecording() {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioStream(newStream);

      // If we already have an audioSender, just replace its track:
      if (tracks.current) {
        const micTrack = newStream.getAudioTracks()[0];
        tracks.current.forEach((sender) => {
          sender.replaceTrack(micTrack);
        });
      } else if (peerConnection.current) {
        // Fallback if audioSender somehow didn't get set
        newStream.getTracks().forEach((track) => {
          const sender = peerConnection.current?.addTrack(track, newStream);
          if (sender) {
            tracks.current = [...(tracks.current || []), sender];
          }
        });
      }

      setIsListening(true);
      console.log("Microphone started.");
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }

  // Replaces the mic track with a placeholder track
  function stopRecording() {
    setIsListening(false);

    // Stop existing mic tracks so the user's mic is off
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop());
    }
    setAudioStream(null);

    // Replace with a placeholder (silent) track
    if (tracks.current) {
      const placeholderTrack = createEmptyAudioTrack();
      tracks.current.forEach((sender) => {
        sender.replaceTrack(placeholderTrack);
      });
    }
  }

  // Creates a placeholder track that is silent
  function createEmptyAudioTrack(): MediaStreamTrack {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    return destination.stream.getAudioTracks()[0];
  }

  // Send a message to the model
  const sendClientEvent = useCallback(
    (message: any) => {
      if (dataChannel) {
        message.event_id = message.event_id || crypto.randomUUID();
        dataChannel.send(JSON.stringify(message));
      } else {
        console.error(
          "Failed to send message - no data channel available",
          message
        );
      }
    },
    [dataChannel]
  );

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    async function handleToolCall(output: any) {
      try {
        const toolCall = {
          name: output.name,
          arguments: output.arguments,
        };
        console.log("Tool call received:", toolCall);
        
        // Asegurar que los argumentos son un string JSON válido
        let args;
        try {
          args = typeof toolCall.arguments === 'string' 
            ? JSON.parse(toolCall.arguments) 
            : toolCall.arguments;
          console.log("Parsed arguments:", args);
        } catch (e) {
          console.error("Failed to parse tool call arguments:", e);
          args = {};
        }
        
        // Actualizar el toolCall con los argumentos parseados
        const validatedToolCall = {
          name: toolCall.name,
          arguments: typeof toolCall.arguments === 'string' ? toolCall.arguments : JSON.stringify(toolCall.arguments)
        };
        
        setToolCall(validatedToolCall);
        console.log("Setting toolCall to:", validatedToolCall);

        // Añadir al historial de búsquedas cuando se filtra productos
        if (toolCall.name === "filter_products" && args) {
          // Obtener la URL de la imagen basada en los filtros de búsqueda
          let imageUrl = "/images/default-product.jpg"; // Imagen por defecto
          
          // Importar el mismo conjunto de datos de productos del componente ProductResults
          const mockProducts = [
            { name: "Classic Running Sneakers", category: "sneakers", color: "red", price: 79.99, imageUrl: "/images/red-sneakers.jpg" },
            { name: "Premium Training Shoes", category: "sneakers", color: "red", price: 99.99, imageUrl: "/images/red-sneakers-2.jpg" },
            { name: "Lightweight Running Shoes", category: "sneakers", color: "red", price: 89.99, imageUrl: "/images/red-sneaker-3.jpg" },
            { name: "Casual Canvas Shoes", category: "sneakers", color: "blue", price: 49.99, imageUrl: "/images/blue-sneakers.jpg" },
            { name: "Cotton T-Shirt", category: "shirts", color: "pink", price: 19.99, imageUrl: "/images/pink-shirt-men.jpg" },
            { name: "Designer Luxury Shirt", category: "shirts", color: "black", price: 129.99, imageUrl: "/images/black-gucci-shirt-men.jpg" },
            { name: "Classic Oxford Shirt", category: "shirts", color: "white", price: 49.99, imageUrl: "/images/white-shirt-men.jpg" },
            { name: "Leather Jacket", category: "jackets", color: "black", price: 149.99, imageUrl: "/images/black-jacket.jpg" },
            { name: "Winter Parka", category: "jackets", color: "black", price: 199.99, imageUrl: "/images/winter-parka-black.jpg" },
          ];
          
          // Mapeo de términos en español a inglés para categoría y color
          const categoryMapping: Record<string, string> = {
            "zapatillas": "sneakers",
            "zapatilla": "sneakers",
            "tenis": "sneakers",
            "calzado deportivo": "sneakers",
            "camisas": "shirts",
            "camisa": "shirts",
            "playera": "shirts",
            "polera": "shirts",
            "remera": "shirts",
            "chaquetas": "jackets",
            "chaqueta": "jackets",
            "abrigo": "jackets",
            "chamarra": "jackets"
          };
          
          const colorMapping: Record<string, string> = {
            "rojas": "red",
            "rojo": "red",
            "azules": "blue",
            "azul": "blue",
            "blancas": "white",
            "blanco": "white",
            "negras": "black",
            "negro": "black",
            "rosadas": "pink",
            "rosa": "pink",
            "rosado": "pink"
          };
          
          // Convertir argumentos a sus equivalentes en inglés para la búsqueda
          const category = args.category ? 
            (categoryMapping[args.category.toLowerCase()] || args.category.toLowerCase()) : '';
          const color = args.color ? 
            (colorMapping[args.color.toLowerCase()] || args.color.toLowerCase()) : '';
          
          // Filtrar productos según los mismos criterios del carrusel
          let filtered = [...mockProducts];
          
          if (category) {
            filtered = filtered.filter(p => p.category.toLowerCase() === category);
          }
          
          if (color) {
            filtered = filtered.filter(p => p.color && p.color.toLowerCase() === color);
          }
          
          if (args.max_price) {
            filtered = filtered.filter(p => p.price <= args.max_price);
          }
          
          // Obtener la URL de la imagen del primer producto filtrado
          if (filtered.length > 0 && filtered[0].imageUrl) {
            imageUrl = filtered[0].imageUrl;
            console.log("Using image from filtered product:", imageUrl);
          }
          
          const newHistoryItem: SearchHistoryItem = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            query: transcript,
            filters: {
              category: args.category || undefined,
              color: args.color || undefined,
              maxPrice: args.max_price || undefined
            },
            imageUrl: imageUrl // Usar la imagen del producto filtrado
          };
          
          setSearchHistory(prev => [newHistoryItem, ...prev]);
        }

        // For filter_products function
        const toolCallOutput: ToolCallOutput = {
          response: `Tool call ${toolCall.name} executed successfully.`,
        };

        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: output.call_id,
            output: JSON.stringify(toolCallOutput),
          },
        });

        // Force a model response
        sendClientEvent({
          type: "response.create",
        });
      } catch (error) {
        console.error("Error handling tool call:", error);
      }
    }

    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "response.done") {
          const output = event.response.output[0];
          
          // Verificar que output existe antes de añadirlo a los logs
          if (output && typeof output === 'object') {
            setLogs((prev) => [output, ...prev]);
            
            // Handle transcription
            if (output?.type === "text") {
              setTranscript((prev) => prev + output.text);
            }
            
            // Handle function calls
            if (output?.type === "function_call") {
              handleToolCall(output);
            }
          } else {
            console.warn("Received empty or invalid output:", output);
          }
        }
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setIsListening(true);
        setLogs([]);
        setTranscript("");
        setToolCall(null);
        
        // Send session config
        const sessionUpdate = {
          type: "session.update",
          session: {
            tools: TOOLS,
            instructions: INSTRUCTIONS,
          },
        };
        sendClientEvent(sessionUpdate);
        console.log("Session update sent:", sessionUpdate);
      });
    }
  }, [dataChannel, sendClientEvent, transcript]);

  const handleConnectClick = async () => {
    if (isSessionActive) {
      console.log("Stopping session.");
      stopSession();
    } else {
      console.log("Starting session.");
      startSession();
    }
  };

  const handleMicToggleClick = async () => {
    if (isListening) {
      console.log("Stopping microphone.");
      stopRecording();
    } else {
      console.log("Starting microphone.");
      startRecording();
    }
  };
  
  const handleResetClick = () => {
    stopSession();
    setToolCall(null);
    setLogs([]);
    setSearchHistory([]);
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="p-4 max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-3">
            {/* Modern Robot SVG Icon */}
            <div className="w-16 h-16 relative">
              <svg
                viewBox="0 0 64 64"
                className="w-full h-full"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Robot Head */}
                <rect
                  x="16"
                  y="12"
                  width="32"
                  height="24"
                  rx="6"
                  fill="url(#robotGradient)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                
                {/* Antenna */}
                <line
                  x1="32"
                  y1="12"
                  x2="32"
                  y2="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="32"
                  cy="6"
                  r="2"
                  fill="#10b981"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                
                {/* Eyes */}
                <circle cx="24" cy="22" r="3" fill="#3b82f6" />
                <circle cx="40" cy="22" r="3" fill="#3b82f6" />
                <circle cx="24" cy="22" r="1.5" fill="white" />
                <circle cx="40" cy="22" r="1.5" fill="white" />
                
                {/* Mouth/Speaker */}
                <rect
                  x="28"
                  y="28"
                  width="8"
                  height="4"
                  rx="2"
                  fill="currentColor"
                  opacity="0.3"
                />
                <line x1="30" y1="30" x2="34" y2="30" stroke="currentColor" strokeWidth="1" />
                
                {/* Body */}
                <rect
                  x="20"
                  y="36"
                  width="24"
                  height="20"
                  rx="4"
                  fill="url(#robotBodyGradient)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                
                {/* Chest Panel */}
                <rect
                  x="26"
                  y="42"
                  width="12"
                  height="8"
                  rx="2"
                  fill="currentColor"
                  opacity="0.1"
                />
                <circle cx="29" cy="45" r="1" fill="#10b981" />
                <circle cx="32" cy="45" r="1" fill="#f59e0b" />
                <circle cx="35" cy="45" r="1" fill="#ef4444" />
                
                {/* Arms */}
                <rect
                  x="12"
                  y="38"
                  width="6"
                  height="12"
                  rx="3"
                  fill="url(#robotGradient)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <rect
                  x="46"
                  y="38"
                  width="6"
                  height="12"
                  rx="3"
                  fill="url(#robotGradient)"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                
                {/* Voice/Sound Waves */}
                <path
                  d="M 8 24 Q 4 24 4 20 Q 4 16 8 16"
                  stroke="#10b981"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.7"
                />
                <path
                  d="M 56 24 Q 60 24 60 20 Q 60 16 56 16"
                  stroke="#10b981"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.7"
                />
                <path
                  d="M 6 28 Q 0 28 0 20 Q 0 12 6 12"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />
                <path
                  d="M 58 28 Q 64 28 64 20 Q 64 12 58 12"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  fill="none"
                  opacity="0.5"
                />

                {/* Gradients */}
                <defs>
                  <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="robotBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Voice Shopping Assistant</h1>
          </div>
          <p className="text-[var(--text-secondary)]">Navigate our catalog using your voice - try saying &quot;Show me red sneakers&quot;</p>
        </header>
        
        {/* Sección principal - Carrusel primero */}
        <section className="mb-8">
          {toolCall?.name === "filter_products" ? (
            <ProductResults toolCall={toolCall} />
          ) : (
            <ProductResults toolCall={null} />
          )}
        </section>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-1">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg shadow-md border border-[var(--border-color)]">
              <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Your Voice Request</h2>
              
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleConnectClick}
                  className={`px-3 py-1.5 rounded-full font-medium ${
                    isSessionActive
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white"
                  }`}
                >
                  {isSessionActive ? "Disconnect" : "Connect"}
                </button>
                
                {isSessionActive && (
                  <button
                    onClick={handleMicToggleClick}
                    className={`px-3 py-1.5 rounded-full font-medium ${
                      isListening
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-green-500 hover:bg-green-600 text-white"
                    }`}
                  >
                    {isListening ? "Mute" : "Speak"}
                  </button>
                )}
                
                <button
                  onClick={handleResetClick}
                  className="px-3 py-1.5 rounded-full font-medium bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Reset
                </button>
              </div>
              
              {transcript && (
                <div className="mt-3 p-2 bg-[var(--bg-tertiary)] rounded-md">
                  <p className="text-sm text-[var(--text-secondary)]">{transcript}</p>
                </div>
              )}
            </div>
          </div>
          
          <div>
            {/* Session Log Section */}
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg shadow-md border border-[var(--border-color)]">
              <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Session Log</h2>
              <div className="overflow-y-auto max-h-[250px]">
                {logs && logs.length > 0 ? (
                  logs
                    .filter(log => log && log.type === "function_call") // Filtrar solo function_call
                    .map((log, index) => (
                      <div key={index} className="mb-3 p-2 border-b border-[var(--border-color)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1 flex justify-between">
                          <span>{log.type}</span>
                          <span className="text-[var(--text-muted)]">{index + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-gray-700 px-2 py-0.5 rounded-full text-xs font-medium text-gray-300">function</span>
                            <p className="font-medium">{log.name}</p>
                          </div>
                          <pre className="text-xs bg-[var(--bg-tertiary)] p-2 mt-1 rounded overflow-x-auto text-[var(--text-secondary)]">
                            {log.arguments}
                          </pre>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-[var(--text-muted)] italic text-center py-4">
                    No function calls yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Historial de búsquedas */}
        {searchHistory.length > 0 && (
          <div className="mt-6 bg-[var(--bg-secondary)] p-4 rounded-lg shadow-md border border-[var(--border-color)]">
            <h2 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">Search History</h2>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {searchHistory.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--card-highlight)] transition-colors"
                >
                  <div className="flex items-start">
                    {/* Imagen del producto */}
                    {item.imageUrl && (
                      <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 mr-3 bg-[var(--card-bg)] border border-[var(--border-color)]">
                        <img 
                          src={item.imageUrl} 
                          alt="Product image"
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-[var(--bg-tertiary)]">
                                <span class="text-xs text-[var(--text-muted)]">No image</span>
                              </div>
                            `;
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="flex-grow">
                      <p className="text-sm text-[var(--text-muted)]">
                        {item.timestamp.toLocaleTimeString()}
                      </p>
                      <p className="font-medium text-[var(--text-primary)]">{item.query}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {item.filters.category && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                            {item.filters.category}
                          </span>
                        )}
                        {item.filters.color && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                            {item.filters.color}
                          </span>
                        )}
                        {item.filters.maxPrice && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                            &lt; ${item.filters.maxPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 