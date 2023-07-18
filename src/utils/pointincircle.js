// pointincircle
export default function point_in_circle(ptx, pty, cx, cy, crad) {
  let dx = Math.abs(ptx - cx)
  let dy = Math.abs(pty - cy)
  return (dx*dx + dy*dy) < crad*crad
}
