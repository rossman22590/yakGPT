import { useEffect, useRef } from "react";
import { genAudio } from "@/stores/ElevenLabs";
import { useChatStore } from "@/stores/ChatStore";
import { usePlayerStore } from "@/stores/PlayerStore";

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

const AudioStreamPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const apiKey11Labs = useChatStore((state) => state.apiKey11Labs);
  const ttsText = useChatStore((state) => state.ttsText);
  const voiceId = useChatStore((state) => state.settingsForm.voice_id) || DEFAULT_VOICE;

  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.play();
      } else {
        audio.pause();
      }
    }
  }, [isPlaying]);

  const initialRender = useRef(true);
  useEffect(() => {
    const audio = audioRef.current;
    // Do not play audio on initial render
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (!ttsText || !apiKey11Labs) {
      return;
    }

    const fetchAndPlayAudioStream = async () => {
      try {
        const audioStream = await genAudio({
          apiKey: apiKey11Labs,
          text: ttsText,
          voiceId,
        });

        if (!audio) {
          return;
        }

        // Create a MediaSource object
        const mediaSource = new MediaSource();
        audio.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener("sourceopen", () => {
          const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

          // Read and process the audio stream
          const processStream = async (
            streamReader: ReadableStreamDefaultReader<Uint8Array>
          ) => {
            const { done, value } = await streamReader.read();

            if (done) {
              // Signal that we've processed all available data
              if (!sourceBuffer.updating) {
                mediaSource.endOfStream();
              } else {
                sourceBuffer.addEventListener(
                  "updateend",
                  () => {
                    mediaSource.endOfStream();
                  },
                  { once: true }
                );
              }
            } else {
              const appendAndUpdate = (chunkValue: Uint8Array) => {
                sourceBuffer.appendBuffer(chunkValue);
                processStream(streamReader);
              };

              // Append the data to the source buffer
              if (sourceBuffer.updating) {
                sourceBuffer.addEventListener(
                  "updateend",
                  () => {
                    appendAndUpdate(value);
                  },
                  { once: true }
                );
              } else {
                appendAndUpdate(value);
              }
            }
          };

          const streamReader = audioStream.getReader();
          processStream(streamReader);
        });

        audio.addEventListener("canplay", () => {
          setIsPlaying(true);
        });
        audio.addEventListener("ended", () => {
          setIsPlaying(false);
        });
      } catch (error) {
        console.error(error);
      }
    };

    fetchAndPlayAudioStream();
  }, [apiKey11Labs, ttsText, voiceId, setIsPlaying]);

  return <audio ref={audioRef} playsInline />;
};

export default AudioStreamPlayer;
