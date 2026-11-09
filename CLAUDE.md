# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no build step, no package.json, no tests, no linter. The README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly in a browser, or serve the directory (e.g. `python3 -m http.server`) and visit it.

## Architecture

Three files: `index.html` (DOM + canvases `#board` 300x600 and `#next-canvas` 120x120), `style.css`, and `game.js` (all logic, loaded as a classic script, `'use strict'`).

`game.js` is a single-file, global-state game:

- **State** lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`), all (re)initialized in `init()`, which is also the restart handler.
- **Board** is a `ROWS x COLS` (20x10) 2D array of ints; `0` is empty, `1-7` index into both `COLORS` and `PIECES` (the same index identifies the piece type, and the cell values inside each `PIECES` shape matrix are that index). Adding a piece means updating both arrays and the `Math.random() * 7` in `randomPiece()`.
- **Game loop**: `loop(ts)` is a `requestAnimationFrame` loop that accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`, then calls `draw()`. Pause and game-over stop it via `cancelAnimationFrame(animId)`; unpausing restarts it by calling `loop` directly after resetting `lastTime`.
- **Piece lifecycle**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current`, generates a new `next`, and calls `endGame()` if the spawn position collides. `clearLines()` also owns level and speed progression (level = lines/10 + 1; `dropInterval = max(100, 1000 - (level-1)*90)`) and scoring (`LINE_SCORES[cleared] * level`; soft drop +1/cell, hard drop +2/cell).
- **Collision / rotation**: `collide(shape, ox, oy)` is the single collision check (walls, floor, board; rows above the top are allowed). `tryRotate()` rotates clockwise only, with horizontal wall kicks `[0, -1, 1, -2, 2]`; there are no vertical kicks.
- **Input**: one `keydown` listener at the bottom handles everything via `e.code`; `P` works while paused, other keys are ignored when paused or game over.
- **Rendering**: `drawBlock(context, x, y, colorIndex, size, alpha)` is shared by the main board, ghost piece (alpha 0.2), and the next-piece preview.
