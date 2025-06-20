function updatePlayerStats() {
  const cells = bingoCardDiv.querySelectorAll(".bingo-cell");
  const totalCells = cells.length; // number of songs in the card
  // Count marked cells
  const totalMarked = Array.from(cells).filter(cell => cell.classList.contains("marked")).length;
  // Update marked count display
  markedCountSpan.textContent = `${totalMarked} / ${totalCells}`;

  // Compute number of complete rows (each row has 'cols' songs)
  const cols = 5;
  const rows = Math.ceil(totalCells / cols);
  let lines = 0;
  for (let r = 0; r < rows; r++) {
    let markedInRow = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < totalCells && cells[idx].classList.contains("marked")) {
        markedInRow++;
      }
    }
    if (markedInRow === cols) lines++;
  }
  linesCountSpan.textContent = lines;

  // Show line or bingo message
  if (totalMarked === totalCells) {
    // Full bingo
    winMessageDiv.textContent = "¡BINGO!";
    winMessageDiv.classList.remove("hidden");
    showMessage("¡BINGO! Has completado todas las canciones.", "success");
  } else if (lines > 0) {
    // At least one completed line
    winMessageDiv.textContent = "¡LÍNEA!";
    winMessageDiv.classList.remove("hidden");
    showMessage(`¡LÍNEA! Has completado ${lines} línea${lines > 1 ? "s" : ""}.`, "info");
  } else {
    // No line or bingo
    winMessageDiv.classList.add("hidden");
  }
}