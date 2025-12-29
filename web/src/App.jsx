import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { GameEngine, defaults, BOARD } from "./gameLogic";

const SPEEDS = [
  { label: "1x", interval: 800, steps: 1 },
  { label: "2x", interval: 450, steps: 1 },
  { label: "5x", interval: 180, steps: 2 },
  { label: "Instant", interval: 30, steps: 8 },
];

function Controls({ config, setConfig, onStart, onStop, onPause, running, paused, speedIdx, setSpeedIdx }) {
  return (
    <div className="panel">
      <h2>Simulation Controls</h2>
      <div className="grid">
        <div>
          <label>Players</label>
          <input
            type="number"
            min="2"
            max="8"
            value={config.players}
            onChange={(e) => setConfig((c) => ({ ...c, players: Number(e.target.value) }))}
            disabled={running}
          />
        </div>
        <div>
          <label>Starting Tokens</label>
          <input
            type="number"
            min="1"
            max="100000"
            value={config.startingTokens}
            onChange={(e) => setConfig((c) => ({ ...c, startingTokens: Number(e.target.value) }))}
            disabled={running}
          />
        </div>
        <div>
          <label>Rounds</label>
          <input
            type="number"
            min="1"
            max="10000"
            value={config.rounds}
            onChange={(e) => setConfig((c) => ({ ...c, rounds: Number(e.target.value) }))}
            disabled={running || config.noCap}
          />
        </div>
        <div>
          <label>Decks</label>
          <input
            type="number"
            min="1"
            max="8"
            value={config.decks}
            onChange={(e) => setConfig((c) => ({ ...c, decks: Number(e.target.value) || 1 }))}
            disabled={running}
          />
        </div>
        <div>
          <label>Fee Multiplier</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={config.feeMultiplier}
            onChange={(e) => setConfig((c) => ({ ...c, feeMultiplier: Math.max(1, Number(e.target.value) || 1) }))}
            disabled={running}
          />
        </div>
      </div>
      <div className="controls" style={{ marginTop: 12 }}>
        <button onClick={onStart} disabled={running}>
          Start
        </button>
        <button className="secondary" onClick={onPause} disabled={!running}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="danger" onClick={onStop} disabled={!running}>
          Stop
        </button>
        {SPEEDS.map((s, idx) => (
          <button
            key={s.label}
            className={idx === speedIdx ? "" : "secondary"}
            onClick={() => setSpeedIdx(idx)}
            disabled={!running}
          >
            {s.label}
          </button>
        ))}
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.noCap}
            onChange={(e) => setConfig((c) => ({ ...c, noCap: e.target.checked }))}
            disabled={running}
          />
          <span>No Round Cap</span>
        </label>
      </div>
    </div>
  );
}

function Track({ board, progress, stabled, lastRoll }) {
  const maxLen = Math.max(...Object.values(board));
  return (
    <div className="panel track-panel">
      <div className="track-header-row">
        <h2>Track</h2>
        <div className="dice-row inline">
          <Die value={(lastRoll && lastRoll.d1) || 1} />
          <Die value={(lastRoll && lastRoll.d2) || 1} />
          <div className="muted" style={{ marginLeft: 8 }}>
            {lastRoll ? `Rolled ${lastRoll.sum}` : "Waiting..."}
          </div>
        </div>
      </div>
      <div className="track">
        <div className="track-labels">
          <div className="scratch">Stabled</div>
          <div className="start">Starting Gate</div>
          <div className="finish">Finish</div>
        </div>
        {Object.entries(board).map(([horse, needed]) => {
          const val = Number(horse);
          const prog = progress?.[val] ?? 0;
          const isStabled = stabled.includes(val);
          const fee = isStabled ? stabled.indexOf(val) + 1 : null;
          const dots =
            isStabled && prog < 0
              ? []
              : Array.from({ length: needed }).map((_, idx) => {
                  const step = idx + 1;
                  const active = step <= prog && !isStabled;
                  return <div key={idx} className={`dot ${active ? "active" : ""}`} title={`${step}/${needed}`} />;
                });
          return (
            <div key={horse} className="lane">
              <div className="lane-label">
                <div className="pill">Horse {horse}</div>
                <div className="muted">Needs {needed}</div>
              </div>
              <div className="scratch-cell">{isStabled ? `Fee ${fee}` : ""}</div>
              <div className="dots">{dots}</div>
              <div className="finish-cell">{prog >= needed && !isStabled ? "🏁" : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Players({ players }) {
  return (
    <div className="panel">
      <h2>Players</h2>
      <div className="players">
        {players.map((p) => (
          <div key={p.id} className={`player-block ${p.eliminated ? "eliminated" : ""}`}>
            <div className="player-row">
              <div>
                <div style={{ fontWeight: 700 }}>Player {p.id}</div>
                {p.eliminated && <div className="muted">Eliminated</div>}
              </div>
              <div className="pill">{p.tokens} tokens</div>
            </div>
            <div className="hand">
              {(p.hand || []).length === 0 ? (
                <div className="muted">No cards</div>
              ) : (
                <div className="cards">
                  {p.hand.map((card, idx) => (
                    <Card key={`${p.id}-${idx}-${card.rank}-${card.suit}`} card={card} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ card }) {
  const suitSymbols = {
    Hearts: "♥",
    Diamonds: "♦",
    Clubs: "♣",
    Spades: "♠",
  };
  const isRed = card.suit === "Hearts" || card.suit === "Diamonds";
  return (
    <div className={`card ${isRed ? "red" : ""}`}>
      <div className="card-corner">{card.rank}</div>
      <div className="card-suit">{suitSymbols[card.suit] || card.suit[0]}</div>
      <div className="card-corner bottom">{card.rank}</div>
    </div>
  );
}

function PotPanel({ pot, stage, round, lastEvent }) {
  return (
    <div className="panel">
      <h2>Status</h2>
      <div className="pot">Pot: {pot}</div>
      <div className="muted" style={{ marginTop: 6 }}>
        Round: {round} • Stage: {stage}
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="muted">Last event</div>
        <div>{lastEvent}</div>
      </div>
    </div>
  );
}

function Die({ value }) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => setAnimKey((k) => k + 1), [value]);
  return (
    <div key={`${animKey}-${value}`} className="die bounce">
      {value}
    </div>
  );
}

function HistoryChart({ history }) {
  const hasData = history && Object.keys(history).length > 0;
  const maxLen = hasData ? Math.max(...Object.values(history).map((arr) => arr.length)) : 0;
  const data =
    hasData && maxLen > 0
      ? Array.from({ length: maxLen }).map((_, idx) => {
          const point = { round: idx };
          for (const [playerId, arr] of Object.entries(history)) {
            point[`P${playerId}`] = arr[idx] ?? arr[arr.length - 1];
          }
          return point;
        })
      : [];
  const colors = ["#42c6ff", "#f6c452", "#8ef6d8", "#ff8f8f", "#c4a0ff", "#6ee7ff", "#ffd166"];
  const playerKeys = hasData ? Object.keys(history).map((id) => `P${id}`) : [];
  return (
    <div className="panel chart-panel">
      <h2>Tokens by Round</h2>
      {data.length === 0 ? (
        <div className="placeholder">Chart will appear once the first round completes.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 10, left: 0, right: 12, bottom: 0 }}>
            <CartesianGrid stroke="#1f2940" vertical={false} />
            <XAxis dataKey="round" stroke="#94a1c0" />
            <YAxis stroke="#94a1c0" />
            <Tooltip
              contentStyle={{ background: "#ffffff", borderColor: "#d6d6d6" }}
              labelFormatter={(label) => `Round: ${label}`}
              labelStyle={{ color: "#000", fontWeight: 700 }}
            />
            <Legend />
            {playerKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[idx % colors.length]} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(defaults);
  const [simState, setSimState] = useState(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [log, setLog] = useState([]);
  const engineRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!running || paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const speed = SPEEDS[speedIdx];
    timerRef.current = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      let snapshot = null;
      for (let i = 0; i < speed.steps; i += 1) {
        snapshot = engine.tick();
        if (snapshot.stage === "done") break;
      }
      if (snapshot) {
        setSimState(snapshot);
        setLog((prev) => {
          const next = [...prev, snapshot.lastEvent];
          if (next.length > 200) next.shift();
          return next;
        });
        if (snapshot.stage === "done") {
          setRunning(false);
        }
      }
    }, speed.interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, paused, speedIdx]);

  const start = () => {
    const engine = new GameEngine(config);
    engineRef.current = engine;
    const snapshot = engine.tick(); // start round
    setSimState(snapshot);
    setLog([snapshot.lastEvent]);
    setRunning(true);
    setPaused(false);
  };

  const pause = () => setPaused((p) => !p);

  const stop = () => {
    setRunning(false);
    setPaused(false);
    engineRef.current = null;
    setSimState(null);
    setLog([]);
  };

  const board = useMemo(() => simState?.board ?? BOARD, [simState]);

  return (
    <div className="app">
      <h1>Horse Racing Simulation</h1>
      <Controls
        config={config}
        setConfig={setConfig}
        onStart={start}
        onPause={pause}
        onStop={stop}
        running={running}
        paused={paused}
        speedIdx={speedIdx}
        setSpeedIdx={setSpeedIdx}
      />
      <div className="track-wrap">
        <Track
          board={board}
          progress={simState?.progress}
          stabled={simState?.stabled ?? []}
          lastRoll={simState?.lastRoll}
        />
      </div>
      <div className="row-panels">
        <PotPanel
          pot={simState?.pot ?? 0}
          stage={simState?.stage ?? "idle"}
          round={simState?.round ?? 1}
          lastEvent={simState?.lastEvent ?? "Ready to start."}
        />
        <Players players={simState?.players ?? []} />
        <HistoryChart history={simState?.history} />
      </div>
      <div className="panel">
        <h2>Log</h2>
        <div className="log">
          {log.map((entry, idx) => (
            <div key={idx} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
