const canvas = document.querySelector("#heroCanvas");
const ctx = canvas.getContext("2d");
let width = 0;
let height = 0;
let dpr = 1;
let points = [];

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.max(42, Math.min(92, Math.floor(width / 18)));
  points = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.18,
    r: 1 + Math.random() * 2.1,
    hue: index % 3
  }));
}

function draw(time = 0) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";

  for (const p of points) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -20) p.x = width + 20;
    if (p.x > width + 20) p.x = -20;
    if (p.y < -20) p.y = height + 20;
    if (p.y > height + 20) p.y = -20;
  }

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    for (let j = i + 1; j < points.length; j += 1) {
      const b = points[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 128) continue;
      const alpha = (1 - distance / 128) * 0.18;
      ctx.strokeStyle = `rgba(125, 170, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const p of points) {
    const pulse = 0.55 + Math.sin(time * 0.0015 + p.x * 0.01) * 0.22;
    const color = p.hue === 0 ? "112, 161, 255" : p.hue === 1 ? "79, 208, 141" : "183, 140, 255";
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 28 * pulse);
    glow.addColorStop(0, `rgba(${color}, 0.42)`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 28 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${color}, 0.9)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
requestAnimationFrame(draw);
