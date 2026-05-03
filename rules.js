function islegalmove(from, to) {
  let piece = boardstate[from.row][from.col];
  if (piece === null) {
    return false;
  }