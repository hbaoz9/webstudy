import { useEffect, useRef, useState } from "react";

export { getYouTubeVideoId } from "../../utils/youtube";

import type { AnswerOption } from "../../types/question";

type Checkpoint = {
  id: string;
  atSeconds: number;
  prompt: string;
  options?: Record<AnswerOption, string>;
  correctOption?: AnswerOption;
};

const EMPTY_CHECKPOINTS: Checkpoint[] = [];

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  destroy: () => void;
};

export type VideoEditorControl = {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  pause: () => void;
};

type EditorProps = {
  authoring?: boolean;
  onClock?: (seconds: number, duration: number) => void;
  onController?: (control: VideoEditorControl | null) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: { origin: string; playsinline: number; autoplay: number };
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as YouTubeWindow;
  const available = youtubeWindow.YT;

  if (available?.Player) return Promise.resolve(available);

  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      let settled = false;
      let script: HTMLScriptElement | null = null;
      const fail = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        apiPromise = null;
        script?.remove();
        reject(new Error(
          "Không tải được trình phát YouTube. Hãy kiểm tra kết nối hoặc thử lại.",
        ));
      };
      const timeout = window.setTimeout(fail, 15000);
      youtubeWindow.onYouTubeIframeAPIReady = () => {
        if (settled) return;
        const api = youtubeWindow.YT;
        if (!api?.Player) {
          fail();
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve(api);
      };

      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        )
      ) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = fail;
        document.head.appendChild(script);
      }
    });
  }

  return apiPromise;
}

export default function InteractiveVideoPlayer({
  videoId,
  checkpoints = EMPTY_CHECKPOINTS,
  title = "Video bài học",
  authoring = false, onClock, onController,
}: {
  videoId: string;
  checkpoints?: Checkpoint[];
  title?: string;
} & EditorProps) {
  const [attempt, setAttempt] = useState(0);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return (
      <p role="alert" className="text-sm text-red-600">
        Liên kết video YouTube không hợp lệ.
      </p>
    );
  }
  // Đổi video/câu hỏi hoặc thử lại sẽ tạo phiên player mới và dọn phiên cũ.
  return (
    <VideoPlayerSession
      key={JSON.stringify([videoId, authoring ? [] : checkpoints, title, attempt, authoring])}
      videoId={videoId}
      authoring={authoring} onClock={onClock} onController={onController}
      checkpoints={checkpoints}
      title={title}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function VideoPlayerSession({ videoId, checkpoints, title, onRetry, authoring = false, onClock, onController }: {
  videoId: string;
  checkpoints: Checkpoint[];
  title: string;
  onRetry: () => void;
} & EditorProps) {
  const onClockRef = useRef(onClock);
  const onControllerRef = useRef(onController);
  onClockRef.current = onClock;
  onControllerRef.current = onController;
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pausedForQuestionRef = useRef(false);
  const shownIdsRef = useRef(new Set<string>());
  const loadedRef = useRef(false);

  const [activeQuestion, setActiveQuestion] = useState<Checkpoint | null>(null);
  const [selectedOption, setSelectedOption] = useState<AnswerOption | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const interactive = authoring || checkpoints.some(
    (item) => item.options && item.correctOption,
  );
  // loadVideos có thể trả mảng mới cùng nội dung; không khởi tạo lại player.
  const checkpointKey = JSON.stringify(checkpoints);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !loadedRef.current) {
        setLoading(false);
        setError("Video tải quá lâu. Bạn có thể thử lại hoặc mở trên YouTube.");
      }
    }, 15000);
    if (!interactive) {
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
    }

    const readyQuestions = checkpoints
      .filter((item) => item.options && item.correctOption)
      .sort((a, b) => a.atSeconds - b.atSeconds);

    const mount = document.createElement("div");
    containerRef.current?.appendChild(mount);

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;

        playerRef.current = new api.Player(mount, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            autoplay: 0,
          },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              window.clearTimeout(timeout);
              loadedRef.current = true;
              setLoading(false);
              setError("");
              containerRef.current?.querySelector("iframe")?.setAttribute("title", title);
              playerRef.current = target;
              if (authoring) onControllerRef.current?.({
                getCurrentTime: () => target.getCurrentTime(),
                seekTo: (seconds) => target.seekTo(seconds, true),
                pause: () => target.pauseVideo(),
              });

              intervalId = window.setInterval(() => {
                if (authoring) {
                  onClockRef.current?.(target.getCurrentTime(), target.getDuration());
                  return;
                }
                if (pausedForQuestionRef.current) return;

                const currentTime = target.getCurrentTime();
                if (!Number.isFinite(currentTime)) return;

                const nextQuestion = readyQuestions.find(
                  (item) =>
                    !shownIdsRef.current.has(item.id) &&
                    currentTime >= item.atSeconds,
                );

                if (!nextQuestion) return;

                shownIdsRef.current.add(nextQuestion.id);
                pausedForQuestionRef.current = true;
                target.pauseVideo();
                setSelectedOption(null);
                setActiveQuestion(nextQuestion);
              }, 250);
            },
            onError: () => {
              if (cancelled) return;
              window.clearTimeout(timeout);
              if (intervalId !== undefined) window.clearInterval(intervalId);
              onControllerRef.current?.(null);
              setLoading(false);
              setError("YouTube chưa phát được video này. Video có thể không cho phép nhúng; hãy thử mở trên YouTube.");
            },
          },
        });
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          window.clearTimeout(timeout);
          setLoading(false);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Không mở được trình phát.",
          );
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (authoring) onControllerRef.current?.(null);
      playerRef.current?.destroy();
      playerRef.current = null;
      containerRef.current?.replaceChildren();
    };
  }, [videoId, checkpointKey, interactive, title, authoring]);

  const continueVideo = () => {
    setActiveQuestion(null);
    setSelectedOption(null);
    pausedForQuestionRef.current = false;
    playerRef.current?.playVideo();
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-video min-h-[200px] w-full overflow-hidden rounded-xl bg-slate-100">
        {loading && (
          <p role="status" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-100 text-sm text-secondary">
            Đang tải video…
          </p>
        )}
        {interactive ? (
          <div ref={containerRef} className="absolute inset-0" />
        ) : (
          <iframe
            title={title}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=0&playsinline=1`}
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => {
              loadedRef.current = true;
              setLoading(false);
              setError("");
            }}
            onError={() => {
              loadedRef.current = true;
              setLoading(false);
              setError("Không tải được video. Hãy thử lại hoặc mở trên YouTube.");
            }}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>

      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={onRetry} className="text-sm font-bold text-emerald">
            Thử tải lại video
          </button>
        </div>
      )}
      <p className="text-sm text-secondary">
        Nếu không xem được tại đây,{" "}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-emerald underline"
        >
          mở trên YouTube
        </a>.
      </p>

      {activeQuestion && (
        <section className="rounded-xl border border-emerald/30 bg-emerald/5 p-4">
          <h4 className="font-extrabold text-ink">{activeQuestion.prompt}</h4>

          <div className="mt-3 space-y-2">
            {(["A", "B", "C", "D"] as const).map((option) => (
              <label
                key={option}
                className="flex min-w-0 items-center gap-3 rounded-lg bg-white p-3 text-sm text-ink"
              >
                <input
                  type="radio"
                  name={`video-question-${activeQuestion.id}`}
                  checked={selectedOption === option}
                  onChange={() => setSelectedOption(option)}
                  className="shrink-0 accent-emerald"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {option}. {activeQuestion.options?.[option]}
                </span>
              </label>
            ))}
          </div>

          {selectedOption && (
            <p role="status" className="mt-3 text-sm font-bold text-ink">
              {selectedOption === activeQuestion.correctOption
                ? "Chính xác! Bạn có thể xem tiếp video."
                : "Chưa đúng, hãy thử lựa chọn khác."}
            </p>
          )}

          <button
            type="button"
            disabled={selectedOption !== activeQuestion.correctOption}
            onClick={continueVideo}
            className="mt-4 rounded-full bg-emerald px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xem tiếp
          </button>
        </section>
      )}
    </div>
  );
}
