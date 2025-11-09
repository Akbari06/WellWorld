import React, { useEffect, useRef, useState } from 'react';
import './DinosaurGame.css';

const DinosaurGame = ({ isMaster, masterIdle, onGameEnd }) => {
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Game state
  const dinoRef = useRef({
    x: 50,
    y: 150,
    width: 40,
    height: 40,
    velocityY: 0,
    jumping: false,
    groundY: 150
  });
  
  const obstaclesRef = useRef([]);
  const gameSpeedRef = useRef(5);
  const scoreRef = useRef(0);

  const animationFrameIdRef = useRef(null);
  
  useEffect(() => {
    // Don't start game if master, not idle, or game over
    if (isMaster || !masterIdle || gameOver) {
      // Reset game state when master becomes active
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (isMaster || !masterIdle) {
        setGameOver(false);
        setGameStarted(false);
      }
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 200;
    
    const dino = dinoRef.current;
    
    // Initialize game
    const initGame = () => {
      dino.y = dino.groundY;
      dino.velocityY = 0;
      dino.jumping = false;
      obstaclesRef.current = [];
      gameSpeedRef.current = 5;
      scoreRef.current = 0;
      setScore(0);
      setGameOver(false);
      setGameStarted(true);
    };
    
    // Draw ground
    const drawGround = () => {
      ctx.fillStyle = '#535353';
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
      
      // Draw ground lines
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, canvas.height - 20);
        ctx.lineTo(i + 10, canvas.height - 20);
        ctx.stroke();
      }
    };
    
    // Draw dinosaur
    const drawDino = () => {
      ctx.fillStyle = '#535353';
      // Body
      ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
      // Head
      ctx.fillRect(dino.x + 25, dino.y - 10, 15, 15);
      // Legs
      const legOffset = Math.sin(Date.now() / 100) * 5;
      ctx.fillRect(dino.x + 5, dino.y + dino.height, 8, 10);
      ctx.fillRect(dino.x + 25, dino.y + dino.height + legOffset, 8, 10);
    };
    
    // Draw obstacles (cacti)
    const drawObstacles = () => {
      ctx.fillStyle = '#535353';
      obstaclesRef.current.forEach(obstacle => {
        // Cactus body
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        // Cactus branches
        if (obstacle.height > 30) {
          ctx.fillRect(obstacle.x - 5, obstacle.y + 10, 8, 15);
          ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y + 15, 8, 12);
        }
      });
    };
    
    // Update game
    const update = () => {
      // Stop if master is no longer idle or game is over
      if (!masterIdle || isMaster || gameOver) {
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        return;
      }
      
      // Clear canvas
      ctx.fillStyle = '#f7f7f7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update dinosaur
      if (dino.jumping) {
        dino.velocityY += 0.8; // Gravity
        dino.y += dino.velocityY;
        
        if (dino.y >= dino.groundY) {
          dino.y = dino.groundY;
          dino.velocityY = 0;
          dino.jumping = false;
        }
      }
      
      // Update obstacles
      obstaclesRef.current = obstaclesRef.current.map(obstacle => ({
        ...obstacle,
        x: obstacle.x - gameSpeedRef.current
      })).filter(obstacle => obstacle.x + obstacle.width > 0);
      
      // Spawn new obstacles
      if (Math.random() < 0.005) {
        const height = 20 + Math.random() * 30;
        obstaclesRef.current.push({
          x: canvas.width,
          y: canvas.height - 20 - height,
          width: 15,
          height: height
        });
      }
      
      // Check collisions
      let collisionDetected = false;
      obstaclesRef.current.forEach(obstacle => {
        if (
          dino.x < obstacle.x + obstacle.width &&
          dino.x + dino.width > obstacle.x &&
          dino.y < obstacle.y + obstacle.height &&
          dino.y + dino.height > obstacle.y
        ) {
          collisionDetected = true;
        }
      });
      
      if (collisionDetected) {
        setGameOver(true);
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        return;
      }
      
      // Update score
      scoreRef.current += 0.1;
      setScore(Math.floor(scoreRef.current));
      
      // Increase speed over time
      gameSpeedRef.current = Math.min(5 + scoreRef.current / 100, 15);
      
      // Draw everything
      drawGround();
      drawDino();
      drawObstacles();
      
      // Draw score
      ctx.fillStyle = '#535353';
      ctx.font = '20px Arial';
      ctx.fillText(`Score: ${Math.floor(scoreRef.current)}`, 10, 30);
      
      animationFrameIdRef.current = requestAnimationFrame(update);
    };
    
    // Jump function
    const jump = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.type === 'click') {
        e.preventDefault();
        if (!dino.jumping && !gameOver && masterIdle && !isMaster) {
          dino.velocityY = -15;
          dino.jumping = true;
        }
      }
    };
    
    // Start game
    initGame();
    animationFrameIdRef.current = requestAnimationFrame(update);
    
    // Event listeners
    window.addEventListener('keydown', jump);
    canvas.addEventListener('click', jump);
    
    return () => {
      window.removeEventListener('keydown', jump);
      canvas.removeEventListener('click', jump);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [masterIdle, isMaster, gameOver]);
  
  const handleClose = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setGameOver(true);
    setGameStarted(false);
    if (onGameEnd) {
      onGameEnd();
    }
  };

  if (isMaster || !masterIdle) {
    return null;
  }
  
  return (
    <div className="dinosaur-game-container">
      <div className="dinosaur-game-wrapper">
        <button
          className="dinosaur-game-close-button"
          onClick={handleClose}
          title="Close game"
        >
          ×
        </button>
        <div className="dinosaur-game-header">
          <h3>Master is idle - Play the Dinosaur Game!</h3>
          <p>Press SPACE or click to jump</p>
        </div>
        <canvas ref={canvasRef} className="dinosaur-canvas" />
        {gameOver && (
          <div className="dinosaur-game-over">
            <p>Game Over!</p>
            <p>Final Score: {Math.floor(score)}</p>
            <button
              className="dinosaur-game-restart-button"
              onClick={() => {
                setGameOver(false);
                setGameStarted(false);
                setScore(0);
                obstaclesRef.current = [];
                gameSpeedRef.current = 5;
                scoreRef.current = 0;
              }}
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DinosaurGame;

