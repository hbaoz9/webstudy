import { useCallback, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { GameCenterView } from "../../features/games/components/GameCenterView";
import { MillionaireGameView } from "../../features/games/components/MillionaireGameView";
import { OAnQuanGameView } from "../../features/games/components/OAnQuanGameView";
import { PenaltyQuizGameView } from "../../features/games/components/PenaltyQuizGameView";
import { WordCatchGameView } from "../../features/games/components/WordCatchGameView";
import {
  GAME_IDS,
  clearGameProgress,
  loadGameProgress,
  recordGameResult,
} from "../../features/games/gameStorage";
import type { GameId, GameProgressMap } from "../../features/games/types";

function isValidGameId(value: string | undefined): value is GameId {
  return Boolean(value && GAME_IDS.includes(value as GameId));
}

export default function StudentGamesPage() {
  const { session } = useAuth();
  if (!session || session.role !== "student") return null;
  return <GameSession key={session.userId} userId={session.userId} playerName={session.name || "Học sinh"} />;
}

function GameSession({ userId, playerName }: { userId: string; playerName: string }) {
  const { gameId } = useParams<{ gameId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const chapterFromQuery = searchParams.get("chapter") || "all";
  const [selectedChapterId, setSelectedChapterId] = useState(chapterFromQuery);
  const [progress, setProgress] = useState<GameProgressMap>(() =>
    loadGameProgress(userId),
  );

  const handleSelectChapter = (nextChapterId: string) => {
    setSelectedChapterId(nextChapterId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextChapterId === "all") next.delete("chapter");
      else next.set("chapter", nextChapterId);
      return next;
    });
  };

  const handleLaunchGame = (targetGameId: GameId) => {
    const query = selectedChapterId !== "all" ? `?chapter=${encodeURIComponent(selectedChapterId)}` : "";
    navigate(`/student/games/${targetGameId}${query}`);
  };

  const handleBackToCenter = () => {
    const query = selectedChapterId !== "all" ? `?chapter=${encodeURIComponent(selectedChapterId)}` : "";
    navigate(`/student/games${query}`);
  };

  const handleRecordResult = useCallback(
    (
      activeGameId: GameId,
      result: {
        score: number;
        maxScore: number;
        won: boolean;
        summary: string;
        chapterId?: string;
      },
    ) => {
      const updated = recordGameResult(userId, {
        gameId: activeGameId,
        ...result,
      });
      setProgress(updated);
    },
    [userId],
  );

  const handleClearHistory = () => {
    setProgress(clearGameProgress(userId));
  };

  if (isValidGameId(gameId)) {
    switch (gameId) {
      case "millionaire":
        return (
          <MillionaireGameView
            initialChapterId={selectedChapterId}
            playerName={playerName}
            onBack={handleBackToCenter}
            onRecordResult={(res) => handleRecordResult("millionaire", res)}
          />
        );
      case "word-catch":
        return (
          <WordCatchGameView
            initialChapterId={selectedChapterId}
            onBack={handleBackToCenter}
            onRecordResult={(res) => handleRecordResult("word-catch", res)}
          />
        );
      case "penalty-quiz":
        return (
          <PenaltyQuizGameView
            initialChapterId={selectedChapterId}
            onBack={handleBackToCenter}
            onRecordResult={(res) => handleRecordResult("penalty-quiz", res)}
          />
        );
      case "o-an-quan":
        return (
          <OAnQuanGameView
            initialChapterId={selectedChapterId}
            onBack={handleBackToCenter}
            onRecordResult={(res) => handleRecordResult("o-an-quan", res)}
          />
        );
    }
  }

  return (
    <GameCenterView
      progress={progress}
      selectedChapterId={selectedChapterId}
      onSelectChapterId={handleSelectChapter}
      onLaunchGame={handleLaunchGame}
      onClearHistory={handleClearHistory}
    />
  );
}
